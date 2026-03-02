.PHONY: dev dev-redis build test lint typecheck docker clean

dev:
	bun run docker:dev

dev-redis:
	bun run docker:dev:redis

build:
	bun run build

test:
	bun run test

lint:
	bun run lint

typecheck:
	bun run typecheck

docker:
	bun run docker:build

clean:
	bun run clean
