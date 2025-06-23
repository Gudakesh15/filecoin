const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting ProofVault deployment to Filecoin Calibration testnet...\n");
    

    
    // Get the deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    
    // Check deployer balance
    const balance = await deployer.getBalance();
    console.log("💰 Account balance:", hre.ethers.utils.formatEther(balance), "FIL\n");
    
    if (balance.lt(hre.ethers.utils.parseEther("0.1"))) {
        console.log("⚠️  Warning: Low balance. You may need more FIL for deployment.");
        console.log("   Get testnet FIL from: https://faucet.calibration.fildev.network/\n");
    }
    
    // Get the contract factory
    console.log("🔨 Getting ProofVault contract factory...");
    const ProofVault = await hre.ethers.getContractFactory("ProofVault");
    
    // Deploy the contract (deployer will be the initial owner)
    console.log("⚡ Deploying ProofVault contract...");
    console.log("   Initial owner will be:", deployer.address);
    
    const proofVault = await ProofVault.deploy(deployer.address);
    
    console.log("⏳ Waiting for deployment confirmation...");
    await proofVault.deployed();
    
    console.log("\n🎉 ProofVault deployed successfully!");
    console.log("📍 Contract address:", proofVault.address);
    console.log("🔗 Transaction hash:", proofVault.deployTransaction.hash);
    console.log("⛽ Gas used:", proofVault.deployTransaction.gasLimit.toString());
    
    // Verify deployment by calling a view function
    console.log("\n🔍 Verifying deployment...");
    try {
        const owner = await proofVault.owner();
        console.log("✅ Contract owner:", owner);
        console.log("✅ Owner matches deployer:", owner === deployer.address);
    } catch (error) {
        console.log("❌ Error verifying deployment:", error.message);
    }
    
    console.log("\n📋 Deployment Summary:");
    console.log("====================================");
    console.log("Contract Name: ProofVault");
    console.log("Network: Filecoin Calibration Testnet");
    console.log("Contract Address:", proofVault.address);
    console.log("Deployer Address:", deployer.address);
    console.log("Transaction Hash:", proofVault.deployTransaction.hash);
    console.log("====================================");
    
    console.log("\n🔗 View on Block Explorer:");
    console.log(`https://calibration.filfox.info/en/address/${proofVault.address}`);
    
    console.log("\n📝 Next Steps:");
    console.log("1. Verify contract on block explorer");
    console.log("2. Test contract functions");
    console.log("3. Update frontend with contract address");
    
    return {
        address: proofVault.address,
        deployer: deployer.address,
        txHash: proofVault.deployTransaction.hash
    };
}

// Handle errors and run the deployment
main()
    .then((result) => {
        console.log(`\n✨ Deployment completed successfully!`);
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Deployment failed:");
        console.error(error);
        process.exit(1);
    }); 