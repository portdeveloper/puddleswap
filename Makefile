SHELL := /bin/bash

.PHONY: setup setup-contracts setup-web test test-contracts test-sdk test-web dev deploy-testnet deploy-uniswap verify-contracts rebalance-testnet deploy-railway-rebalancer sync-artifacts lint format

setup: setup-contracts setup-web

setup-contracts:
	git submodule update --init --recursive
	git submodule status --recursive

setup-web:
	pnpm install
	pnpm --dir sdk build

test: test-contracts test-sdk test-web

test-contracts:
	cd contracts && forge test --no-match-path test/E2ESwap.t.sol

test-sdk:
	pnpm --dir sdk build
	pnpm --dir sdk test

test-web:
	pnpm --dir web test --run

dev:
	pnpm --dir web dev

lint:
	pnpm --dir web lint

format:
	pnpm --dir web format

deploy-testnet:
	bash scripts/deploy-testnet.sh

deploy-uniswap:
	bash scripts/deploy-uniswap.sh

verify-contracts:
	bash scripts/verify-contracts.sh

sync-artifacts:
	node scripts/sync-artifacts.mjs

rebalance-testnet:
	bash scripts/rebalance-testnet-core.sh

deploy-railway-rebalancer:
	bash scripts/deploy-railway-rebalancer.sh
