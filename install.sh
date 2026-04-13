#!/usr/bin/env bash
# =============================================================================
# Chimedeck — Quick-Start Install Script (macOS & Linux)
#
# Usage (one-liner from landing page):
#   curl -fsSL https://your-site.com/install.sh -o /tmp/chimedeck-install.sh && bash /tmp/chimedeck-install.sh
#
# Or via pipe — stdin is preserved via /dev/tty:
#   curl -fsSL https://your-site.com/install.sh | bash
# =============================================================================
set -euo pipefail

# ── Repo to clone ──────────────────────────────────────────────────────────────
# Replace this with your actual repository URL before hosting the script.
REPO_URL="https://github.com/YOUR_ORG/YOUR_REPO.git"
INSTALL_DIR="${INSTALL_DIR:-chimedeck}"

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✔]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✖]${NC} $*"; }
section() { echo -e "\n${BLUE}▶ $*${NC}"; }

# ── Docker ────────────────────────────────────────────────────────────────────
ensure_docker() {
  section "Checking Docker"

  if ! command -v docker &>/dev/null; then
    warn "Docker not found — attempting to install..."

    local os
    os="$(uname -s)"

    case "$os" in
      Darwin)
        if command -v brew &>/dev/null; then
          info "Installing Docker Desktop via Homebrew..."
          brew install --cask docker
        else
          error "Homebrew is required to install Docker on macOS."
          error "Install Homebrew first:  https://brew.sh — then re-run this script."
          exit 1
        fi
        ;;
      Linux)
        if command -v apt &>/dev/null || command -v apt-get &>/dev/null; then
          # Prefer apt (user-facing), fall back to apt-get (scripting)
          local APT
          APT="$(command -v apt 2>/dev/null || command -v apt-get)"
          info "Installing Docker via $APT..."
          sudo "$APT" update -qq
          sudo "$APT" install -y ca-certificates curl gnupg lsb-release
          sudo install -m 0755 -d /etc/apt/keyrings
          curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
            | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
          sudo chmod a+r /etc/apt/keyrings/docker.gpg
          echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
            https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
            | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
          sudo "$APT" update -qq
          sudo "$APT" install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
          sudo systemctl enable --now docker
          sudo usermod -aG docker "$USER" || true
        elif command -v yum &>/dev/null; then
          info "Installing Docker via yum..."
          sudo yum install -y yum-utils
          sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
          sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
          sudo systemctl enable --now docker
          sudo usermod -aG docker "$USER" || true
        else
          error "No supported package manager found (apt / yum)."
          error "Please install Docker manually:  https://docs.docker.com/engine/install/"
          exit 1
        fi
        ;;
      *)
        error "Unsupported OS: $os"
        error "Please install Docker manually:  https://docs.docker.com/get-docker/"
        exit 1
        ;;
    esac

    if ! command -v docker &>/dev/null; then
      error "Docker installation did not complete successfully."
      error "Please install Docker manually:  https://docs.docker.com/get-docker/"
      exit 1
    fi
  fi

  info "Docker found: $(docker --version)"

  # ── Ensure daemon is running ─────────────────────────────────────────────────
  if ! docker info &>/dev/null 2>&1; then
    warn "Docker daemon is not running — attempting to start it..."

    local os
    os="$(uname -s)"

    case "$os" in
      Darwin)
        open -a Docker 2>/dev/null || true
        info "Waiting for Docker Desktop (up to 90 s)..."
        local deadline=$(( SECONDS + 90 ))
        until docker info &>/dev/null 2>&1; do
          if [[ $SECONDS -ge $deadline ]]; then
            error "Docker Desktop did not start within 90 s."
            error "Please open Docker Desktop manually and re-run this script."
            exit 1
          fi
          printf '.'
          sleep 3
        done
        echo ""
        ;;
      Linux)
        if command -v systemctl &>/dev/null; then
          sudo systemctl start docker
        else
          sudo service docker start
        fi
        sleep 3
        if ! docker info &>/dev/null 2>&1; then
          error "Could not start the Docker daemon."
          error "Please start Docker manually and re-run this script."
          exit 1
        fi
        ;;
    esac
  fi

  info "Docker daemon is running."
}

# ── Docker Compose ─────────────────────────────────────────────────────────────
COMPOSE_CMD=""

ensure_compose() {
  if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    error "Docker Compose is not available."
    error "Please install it:  https://docs.docker.com/compose/install/"
    exit 1
  fi
  info "Compose command: $COMPOSE_CMD"
}

# ── Prompt (works when piped through curl | bash) ──────────────────────────────
prompt_required() {
  local var_name="$1"
  local prompt_text="$2"
  local value=""
  while [[ -z "$value" ]]; do
    printf "%s: " "$prompt_text" >/dev/tty
    read -r value </dev/tty
    [[ -z "$value" ]] && warn "This field is required — please enter a value." >/dev/tty
  done
  echo "$value"
}

# ── JWT RS256 key generation ───────────────────────────────────────────────────
JWT_PRIVATE_KEY=""
JWT_PUBLIC_KEY=""

generate_jwt_keys() {
  section "Generating RS256 JWT key pair"

  if ! command -v openssl &>/dev/null; then
    error "openssl is required to generate JWT keys but was not found."
    error "Please install openssl and re-run this script."
    exit 1
  fi

  local tmp_dir
  tmp_dir="$(mktemp -d)"

  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
    -out "$tmp_dir/private.pem" 2>/dev/null
  openssl rsa -pubout -in "$tmp_dir/private.pem" \
    -out "$tmp_dir/public.pem" 2>/dev/null

  # Base64-encode (single line, no newline wrapping)
  JWT_PRIVATE_KEY="$(base64 < "$tmp_dir/private.pem" | tr -d '\n')"
  JWT_PUBLIC_KEY="$(base64 < "$tmp_dir/public.pem" | tr -d '\n')"

  rm -rf "$tmp_dir"
  info "JWT key pair generated."
}

# ── Parse docker-compose.yml ───────────────────────────────────────────────────
parse_compose_values() {
  local compose_file="$1"

  PG_USER="$(grep 'POSTGRES_USER:' "$compose_file" | head -1 | awk '{print $2}' | tr -d '"'\''[:space:]')"
  PG_PASSWORD="$(grep 'POSTGRES_PASSWORD:' "$compose_file" | head -1 | awk '{print $2}' | tr -d '"'\''[:space:]')"
  PG_DB="$(grep 'POSTGRES_DB:' "$compose_file" | head -1 | awk '{print $2}' | tr -d '"'\''[:space:]')"

  # Extract host-side port for localstack (format: "HOST:4566")
  local ls_raw
  ls_raw="$(grep -A10 'localstack:' "$compose_file" | grep '"4566' | grep -oE '[0-9]+:4566' | cut -d: -f1 | head -1)"
  LS_HOST_PORT="${ls_raw:-4566}"

  # Validate
  if [[ -z "$PG_USER" || -z "$PG_PASSWORD" || -z "$PG_DB" ]]; then
    warn "Could not fully parse docker-compose.yml — using defaults (chimedeck/chimedeck/chimedeck_dev)"
    PG_USER="${PG_USER:-chimedeck}"
    PG_PASSWORD="${PG_PASSWORD:-chimedeck}"
    PG_DB="${PG_DB:-chimedeck_dev}"
  fi
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║           Chimedeck — Quick-Start Installer          ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""

  ensure_docker
  ensure_compose

  # ── Clone or update repo ───────────────────────────────────────────────────
  section "Setting up project files"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Directory './$INSTALL_DIR' already exists — pulling latest changes..."
    git -C "$INSTALL_DIR" pull --ff-only
  else
    info "Cloning repository into './$INSTALL_DIR'..."
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi

  cd "$INSTALL_DIR"

  # ── Collect required user input ────────────────────────────────────────────
  section "Configuration"
  echo ""
  echo "  Please enter the platform administrator emails."
  echo "  These accounts will have full admin access to Chimedeck."
  echo ""

  PLATFORM_ADMIN_EMAILS="$(prompt_required \
    "PLATFORM_ADMIN_EMAILS" \
    "  Admin emails (comma-separated, e.g. admin@example.com,cto@example.com)")"

  # ── Parse compose file for DB / storage values ─────────────────────────────
  parse_compose_values "docker-compose.yml"

  # Inside the Docker network, service names are used as hostnames.
  DATABASE_URL="postgresql://${PG_USER}:${PG_PASSWORD}@postgres:5432/${PG_DB}"
  REDIS_URL="redis://redis:6379"
  S3_ENDPOINT="http://localstack:${LS_HOST_PORT}"
  S3_BUCKET="$PG_USER"   # bucket name mirrors the project slug

  # ── Generate JWT keys ──────────────────────────────────────────────────────
  generate_jwt_keys

  # ── Write .env ─────────────────────────────────────────────────────────────
  section "Writing .env"

  cat > .env <<EOF
# Auto-generated by install.sh — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Edit this file to customise your deployment.

# ── Database ──────────────────────────────────────────────────────────────────
# Host is the docker-compose service name "postgres" (resolved inside Docker network).
DATABASE_URL=${DATABASE_URL}

# ── JWT (RS256) ───────────────────────────────────────────────────────────────
JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY}
JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY}

# ── S3 / LocalStack ───────────────────────────────────────────────────────────
# LocalStack runs inside the Docker network — host is the service name "localstack".
S3_BUCKET=${S3_BUCKET}
S3_REGION=us-east-1
S3_ENDPOINT=${S3_ENDPOINT}
S3_AWS_ACCESS_KEY_ID=test
S3_AWS_SECRET_ACCESS_KEY=test
FLAG_USE_LOCAL_STORAGE=true

# ── Redis ─────────────────────────────────────────────────────────────────────
# Host is the docker-compose service name "redis" (resolved inside Docker network).
REDIS_URL=${REDIS_URL}
FLAG_USE_REDIS=true

# ── App ───────────────────────────────────────────────────────────────────────
APP_PORT=3000
NODE_ENV=production

# ── Feature flags ─────────────────────────────────────────────────────────────
FLAG_VIRUS_SCAN_ENABLED=false
FLAG_EMAIL_VERIFICATION_ENABLED=false
FLAG_SES_ENABLED=false
FLAG_OAUTH_GOOGLE_ENABLED=false
FLAG_OAUTH_GITHUB_ENABLED=false
AUTOMATION_SCHEDULER_ENABLED=true
HEALTH_CHECK_ENABLED=true

# ── Email domain restriction ──────────────────────────────────────────────────
# Set to false to allow any email to self-register.
EMAIL_DOMAIN_RESTRICTION_ENABLED=false

# ── Platform admin ────────────────────────────────────────────────────────────
PLATFORM_ADMIN_EMAILS=${PLATFORM_ADMIN_EMAILS}
VITE_PLATFORM_ADMIN_EMAILS=${PLATFORM_ADMIN_EMAILS}

# ── Seed ──────────────────────────────────────────────────────────────────────
SEED_TRELLO=false
EOF

  info ".env written."

  # ── Launch services ────────────────────────────────────────────────────────
  section "Starting services"
  info "Running: $COMPOSE_CMD --profile redis up -d --build"
  $COMPOSE_CMD --profile redis up -d --build

  # ── Wait for health endpoint ───────────────────────────────────────────────
  section "Waiting for app to become ready"
  local port="${APP_PORT:-3000}"
  local deadline=$(( SECONDS + 120 ))

  until curl -sf "http://localhost:${port}/health" &>/dev/null; do
    if [[ $SECONDS -ge $deadline ]]; then
      warn "App did not respond within 120 s."
      warn "Check logs:  $COMPOSE_CMD logs -f app"
      break
    fi
    printf '.'
    sleep 3
  done
  echo ""

  # ── Done ──────────────────────────────────────────────────────────────────
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║  Chimedeck is ready!                                            ║"
  echo "║                                                                 ║"
  echo "║  Open:   http://localhost:${port}                                ║"
  echo "║                                                                 ║"
  echo "║  Useful commands (run from the '${INSTALL_DIR}/' directory):     ║"
  echo "║    Logs:   $COMPOSE_CMD logs -f app                         ║"
  echo "║    Stop:   $COMPOSE_CMD --profile redis down                ║"
  echo "║    Start:  $COMPOSE_CMD --profile redis up -d               ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
  echo ""
}

main "$@"
