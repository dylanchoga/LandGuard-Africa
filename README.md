
# LandGuard Africa

### AI-Powered Blockchain Housing Transparency Platform

LandGuard Africa is a blockchain-powered housing application platform designed to improve transparency, accountability and trust in South Africa's public housing allocation processes.

## Problem Statement

South Africa's RDP housing allocation system faces challenges including corruption, queue-jumping, duplicate allocations and limited transparency.

LandGuard addresses these challenges by creating tamper-evident housing application records that can be independently verified on a public blockchain.

## Core Technologies

- Avalanche Fuji: Blockchain registration and integrity verification
- Binance Web3 Wallet: Digital auditor signatures
- Ollama + Qwen 2.5: AI housing assistance
- React: Frontend
- FastAPI: Backend
- PostgreSQL: Database
- Docker: Application services

## Avalanche Smart Contract

Contract: LandGuardRegistryV2

Network: Avalanche Fuji Testnet

Chain ID: 43113

Contract Address:
0x028628B0414533d7338e6A85536e888758643385

Contract Explorer:
https://testnet.snowtrace.io/address/0x028628B0414533d7338e6A85536e888758643385

Example Successful Transaction:
https://testnet.snowtrace.io/tx/0xfd2a4532f03fbdb3d3b1f6bbabdf8def7dc851c147f443ca3dbcdfdec346f83b

## Smart Contract Functionality

- registerApplication(): Registers application proofs
- updateApplication(): Appends new proof versions
- verifyApplication(): Verifies blockchain commitments
- getApplicationProof(): Retrieves the latest proof
- getApplicationVersionCount(): Returns version count
- getApplicationVersion(): Retrieves historical versions
- setAuthorizedWriter(): Controls registration permissions

## Main Application Features

1. Housing application submission and tracking
2. Automatic blockchain registration on Avalanche Fuji
3. Public blockchain transaction verification
4. Blockchain record integrity checking
5. Binance Wallet digital auditor signatures
6. AI-powered housing assistance and eligibility guidance

## Local Setup

Requirements:
- Docker Desktop
- Ollama
- Binance Wallet browser extension for audit signing
- Avalanche Fuji RPC connectivity

Instructions:
1. Clone this repository.
2. Configure a local .env file using .env.example.
3. Install the Ollama model: ollama pull qwen2.5:3b
4. Start Ollama.
5. Run: docker compose up -d --build
6. Open http://localhost:8080

Blockchain registration requires an authorised Fuji testnet wallet configured locally.

## Basic Tests

Solidity test source code is included in the tests folder.

Tests cover:
- Application registration
- Duplicate registration prevention
- Application version history

Test execution results will be documented after running the tests.

## Competition Demonstration

1. Submit fictional housing applications.
2. Observe automatic Avalanche blockchain registration.
3. Verify transaction hashes on Snowtrace.
4. Verify application record integrity.
5. Digitally sign an audit with Binance Wallet.
6. Demonstrate the AI housing assistant.

## Future Development

- Transparent housing waiting-list management
- Duplicate-allocation detection
- Expanded independent audit capabilities
- Secure cloud deployment

