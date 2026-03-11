#!/bin/sh
set -e

if [ "${SEED_TRELLO}" = "true" ]; then
  echo "[entrypoint] SEED_TRELLO=true — running Trello import seed..."
  bun run db:seed:trello
  echo "[entrypoint] Trello seed complete."
fi

exec "$@"
