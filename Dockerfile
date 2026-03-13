# ── Stage 1: Install all dependencies ──────────────────────────
FROM oven/bun:1.3.5-slim AS deps
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build (Vite client bundle + typecheck) ──────────────────
FROM deps AS build
WORKDIR /app

COPY . .
RUN bun run build:client

# ── Stage 3: Production runtime (minimal image) ────────────────
FROM oven/bun:1.3.5-slim AS production
WORKDIR /app

# Security: non-root user
RUN groupadd --system app && useradd --system --gid app --no-create-home app

# Copy only what production needs
COPY --from=build /app/node_modules  ./node_modules
COPY --from=build /app/package.json  ./package.json
COPY --from=build /app/server        ./server
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/db            ./db
COPY --from=build /app/dist          ./dist
COPY --from=build /app/.env              ./env
COPY entrypoint.sh                   /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER app

ARG PORT=3000
ENV PORT=$PORT
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e "const r = await fetch('http://localhost:' + process.env.PORT + '/health'); process.exit(r.ok ? 0 : 1)"

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bun", "run", "start"]
