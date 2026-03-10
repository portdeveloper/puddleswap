SHELL := /bin/bash

.PHONY: setup setup-contracts setup-web test test-contracts test-web dev deploy-testnet-safe deploy-uniswap-safe rebalance-testnet deploy-railway-rebalancer sync-artifacts lint format

setup: setup-contracts setup-web

setup-contracts:
	cd contracts && forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts Uniswap/v2-core Uniswap/v2-periphery Uniswap/solidity-lib

setup-web:
	pnpm install

test: test-contracts test-web

test-contracts:
	cd contracts && forge test

test-web:
	pnpm --dir web test --run

dev:
	pnpm --dir web dev

lint:
	pnpm --dir web lint

format:
	pnpm --dir web format

deploy-testnet-safe:
	bash scripts/deploy-testnet-safe.sh

deploy-uniswap-safe:
	bash scripts/deploy-uniswap-stock-safe.sh

sync-artifacts:
	node scripts/sync-artifacts.mjs

rebalance-testnet:
	bash scripts/rebalance-testnet-core.sh

deploy-railway-rebalancer:
	bash scripts/deploy-railway-rebalancer.sh
