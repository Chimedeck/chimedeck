#!/bin/bash

# =============================================================================
# Project Initialisation Script
# Clones the Sharetribe web template as a READ-ONLY reference repo.
# Run once after filling in specs/architecture/requirements.md.
# =============================================================================

set -euo pipefail

REPO_URL="git@github.com:journeyhorizon/sharetribe-web-template.git"
SAMPLE_DIR="sample-project"
REQUIREMENTS_FILE="specs/architecture/requirements.md"

# ---------------------------------------------------------------------------
# 1. Validate requirements.md is filled in before doing anything else
# ---------------------------------------------------------------------------
if [[ ! -f "$REQUIREMENTS_FILE" ]]; then
  echo ""
  echo "ERROR: ${REQUIREMENTS_FILE} not found."
  echo ""
  echo "This file should already exist in the repo as a template."
  echo "If it is missing, restore it from git or re-clone the boilerplate."
  echo ""
  exit 1
fi

# Check if any section still contains the placeholder text
if grep -q '(fill in)' "$REQUIREMENTS_FILE"; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║  REQUIREMENTS INCOMPLETE                                            ║"
  echo "╠══════════════════════════════════════════════════════════════════════╣"
  echo "║  ${REQUIREMENTS_FILE} still contains                    ║"
  echo "║  unfilled placeholders \"(fill in)\".                               ║"
  echo "║                                                                     ║"
  echo "║  Please open the file and replace every '(fill in)' with real       ║"
  echo "║  content, then re-run:  bash setup.sh                               ║"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Sections still needing attention:"
  grep -n '(fill in)' "$REQUIREMENTS_FILE" | sed 's/^/  /'
  echo ""
  exit 1
fi

echo ">>> Requirements file looks good."

# ---------------------------------------------------------------------------
# 2. Ensure spec directories exist
# ---------------------------------------------------------------------------
mkdir -p specs/architecture specs/changelog

# ---------------------------------------------------------------------------
# 3. Clone the reference repository
# ---------------------------------------------------------------------------
echo ">>> Cloning ${REPO_URL} into ./${SAMPLE_DIR} (reference only) ..."

if [ -d "$SAMPLE_DIR" ]; then
  echo "Directory '${SAMPLE_DIR}' already exists – skipping clone."
else
  git clone "$REPO_URL" "$SAMPLE_DIR"
  echo ">>> Clone complete."
fi

# ---------------------------------------------------------------------------
# 4. Ensure VS Code MCP configuration exists
# ---------------------------------------------------------------------------
MCP_JSON="$HOME/Library/Application Support/Code/User/mcp.json"

if [[ ! -f "$MCP_JSON" ]]; then
  echo ">>> Creating VS Code MCP config at: ${MCP_JSON}"
  mkdir -p "$(dirname "$MCP_JSON")"
  cat > "$MCP_JSON" <<'EOF'
{
	"servers": {
		"playwright": {
			"command": "npx",
			"args": [
				"@playwright/mcp@latest"
			]
		}
	},
	"inputs": []
}
EOF
  echo ">>> MCP config created."
else
  echo ">>> VS Code MCP config already exists – skipping."
fi

echo ""
echo "============================================================"
echo " Setup complete!"
echo " Reference repo  : $(pwd)/${SAMPLE_DIR}  (read-only)"
echo " Requirements    : $(pwd)/${REQUIREMENTS_FILE}"
echo " Next step       : bash start-agent-loop.sh \"<task description>\""
echo "============================================================"
