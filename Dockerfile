# ── Stage 1: Install all dependencies ──────────────────────────
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build (typecheck; Bun runs TS directly — no transpile) ─────
FROM deps AS build
WORKDIR /app

COPY . .
RUN bun run typecheck

# ── Stage 3: Production runtime (minimal image) ────────────────
FROM oven/bun:1.2-alpine AS production
WORKDIR /app

# Security: non-root user
RUN addgroup --system app && adduser --system --ingroup app app

# Copy only what production needs
COPY --from=build /app/node_modules  ./node_modules
COPY --from=build /app/package.json  ./package.json
COPY --from=build /app/server        ./server
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/db            ./db

USER app

ARG PORT=3000
ENV PORT=$PORT
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:$PORT/health || exit 1

CMD ["bun", "run", "start"]
