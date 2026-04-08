.PHONY: dev dev-redis build test test-e2e test-all lint typecheck docker clean

dev:
	bun run docker:dev

dev-redis:
	bun run docker:dev:redis

build:
	bun run build

test:
	bun run test

test-e2e:
	bun run test:e2e

test-all:
	bash run-all-tests-full.sh

lint:
	bun run lint

typecheck:
	bun run typecheck

docker:
	bun run docker:build

clean:
	bun run clean
