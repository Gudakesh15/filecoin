# ProofVault Deployment Guide

## 🚀 Prerequisites

### 1. Create Environment File
Create a `.env` file in the project root with your private key:

```bash
# Create .env file
touch .env

# Add your private key (DO NOT commit this file!)
echo "PRIVATE_KEY=your_private_key_here" >> .env
```

### 2. Get Testnet FIL
- Visit the Filecoin Calibration faucet: https://faucet.calibration.fildev.network/
- Enter your wallet address
- Request testnet FIL (you'll need at least 0.1 FIL for deployment)

### 3. Verify Network Configuration
Our Hardhat config is already set up for Filecoin Calibration:
- Network: Calibration Testnet
- RPC: https://api.calibration.node.glif.io/rpc/v1
- Chain ID: 314159

## 🔧 Deployment Steps

### 1. Compile Contract
```bash
npx hardhat compile
```

### 2. Deploy to Calibration Testnet
```bash
npx hardhat run scripts/deploy.js --network calibration
```

### 3. Verify Deployment
The deployment script will output:
- Contract address
- Transaction hash
- Block explorer link
- Gas usage info

## 📋 Expected Output
```
🚀 Starting ProofVault deployment to Filecoin Calibration testnet...

📝 Deploying with account: 0x...
💰 Account balance: 1.0 FIL

🔨 Getting ProofVault contract factory...
⚡ Deploying ProofVault contract...
⏳ Waiting for deployment confirmation...

🎉 ProofVault deployed successfully!
📍 Contract address: 0x...
🔗 Transaction hash: 0x...
⛽ Gas used: ...

🔍 Verifying deployment...
✅ Contract owner: 0x...
✅ Owner matches deployer: true

📋 Deployment Summary:
====================================
Contract Name: ProofVault
Network: Filecoin Calibration Testnet
Contract Address: 0x...
Deployer Address: 0x...
Transaction Hash: 0x...
====================================

🔗 View on Block Explorer:
https://calibration.filfox.info/en/address/0x...
```

## 🔍 Post-Deployment Verification

### 1. Check on Block Explorer
Visit the provided Filfox link to verify:
- Contract creation transaction
- Contract bytecode
- Initial state

### 2. Test Contract Functions
You can test the deployed contract using Hardhat console:
```bash
npx hardhat console --network calibration
```

## 🚨 Security Notes

- **NEVER** commit your `.env` file with real private keys
- Use a dedicated wallet for testnet deployments
- Keep private keys secure and never share them
- The `.gitignore` already excludes `.env` files

## 🔗 Useful Links

- [Filecoin Calibration Faucet](https://faucet.calibration.fildev.network/)
- [Filfox Block Explorer](https://calibration.filfox.info/)
- [Beryx Block Explorer](https://beryx.zondax.ch/calibration)
- [Filecoin Documentation](https://docs.filecoin.io/)

## 🆘 Troubleshooting

### "Insufficient Balance" Error
- Get more testnet FIL from the faucet
- Wait for faucet transaction to confirm

### "Network Connection" Error
- Check internet connection
- Verify RPC endpoint is accessible
- Try again in a few minutes

### "Gas Estimation" Error
- Increase gas limit in hardhat.config.cjs
- Ensure contract compiles without errors 