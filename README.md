# 🔐 ProofVault

**Decentralized Document Verification Platform on Filecoin**

ProofVault is a cutting-edge decentralized application that leverages blockchain technology to provide immutable document verification and integrity assurance. Built on the Filecoin Calibration testnet, it offers a trustless, transparent solution for document authentication without relying on centralized authorities.

## 🌟 Features

### 🔒 **Immutable Document Registration**
- Upload documents and generate cryptographic hashes (SHA-256)
- Store document metadata permanently on the Filecoin blockchain
- Generate tamper-proof Content Identifiers (CIDs) for each document
- Automatic timestamp recording for legal and audit trail purposes

### ✅ **Decentralized Verification System**
- **Self-Verification**: Document owners can verify their own uploads
- **Third-Party Verification**: Request verification from trusted parties
- **Multi-Verifier Support**: Multiple independent verifications per document
- **Verification History**: Complete audit trail of all verification activities

### 📊 **Document Vault & Management**
- Intuitive dashboard for managing all registered documents
- Real-time blockchain transaction tracking with live status updates
- Comprehensive document metadata display (hash, CID, timestamps)
- Easy access to verification status and history

### 🔗 **Blockchain Transparency**
- Full transaction hash visibility for every blockchain operation
- Direct links to Filecoin block explorers for independent verification
- Gas-optimized smart contract interactions
- Retry mechanisms for network reliability

### 🌐 **Modern Web3 Integration**
- MetaMask wallet connectivity with Web3Modal v4
- Support for Filecoin Calibration testnet
- Responsive, mobile-friendly interface
- Real-time wallet connection status

## 🏗️ Technology Stack

### **Frontend**
- **React 18** - Modern component-based UI framework
- **Vite** - Lightning-fast build tool and development server
- **Wagmi v2** - Type-safe Ethereum/Filecoin interactions
- **Web3Modal v4** - Universal wallet connection library
- **CSS3** - Custom responsive styling with modern design patterns

### **Blockchain**
- **Solidity ^0.8.19** - Smart contract development
- **Hardhat** - Ethereum development environment
- **Filecoin Calibration Testnet** - Decentralized storage network
- **OpenZeppelin** - Battle-tested smart contract libraries

### **Development Tools**
- **ESLint** - Code quality and consistency
- **Node.js** - Runtime environment
- **npm** - Package management
- **Git** - Version control

## 📋 Prerequisites

Before setting up ProofVault, ensure you have:

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** package manager
- **MetaMask** browser extension - [Install](https://metamask.io/)
- **Git** for version control
- Basic knowledge of Web3 and blockchain concepts

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd filecoin/proofvault
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Network Settings
The application is pre-configured for Filecoin Calibration testnet. Update `src/config/web3.ts` if you need different network settings.

### 4. Get Test FIL Tokens
Visit one of these faucets to get test FIL for transactions:
- [Chainsafe Faucet](https://faucet.calibration.fildev.network/)
- [Glif Faucet](https://faucet.glif.io/)

### 5. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` to access the application.

## 📖 Usage Guide

### **Setting Up Your Wallet**

1. **Install MetaMask**: Download and install MetaMask browser extension
2. **Add Filecoin Calibration Network**:
   - Network Name: `Filecoin Calibration`
   - RPC URL: `https://api.calibration.node.glif.io/rpc/v1`
   - Chain ID: `314159`
   - Currency Symbol: `tFIL`
   - Block Explorer: `https://calibration.filscan.io/`

3. **Get Test Tokens**: Use the faucet links above to get test FIL

### **Registering Documents**

1. **Connect Wallet**: Click "Connect Wallet" and select MetaMask
2. **Upload Document**: 
   - Click "Choose File" and select your document
   - The system automatically generates SHA-256 hash and CID
   - Review the document information
3. **Submit to Blockchain**:
   - Click "Register Document"
   - Confirm the MetaMask transaction
   - Wait for blockchain confirmation
4. **View Registration**: Your document appears in the Document Vault with transaction details

### **Verifying Documents**

#### **Self-Verification**
1. Navigate to your Document Vault
2. Find the document you want to verify
3. Click "Request Verification"
4. Select "Self-Verification"
5. Confirm the transaction in MetaMask

#### **Third-Party Verification**
1. Click "Request Verification" on any document
2. Select "Request Third-Party Verification"
3. Enter the verifier's name/organization
4. Share the verification request with the intended verifier
5. The verifier can then complete the verification process

### **Checking Verification Status**

- **Document Vault**: Shows verification count for each document
- **Verification History**: Click on any document to see detailed verification timeline
- **Blockchain Verification**: Use transaction hashes to verify on Filecoin block explorer

## 🔧 Smart Contract

### **Contract Details**
- **Address**: `0x527C50036dB179c92b87518818618041F640005F`
- **Network**: Filecoin Calibration Testnet
- **Compiler**: Solidity ^0.8.19

### **Core Functions**

```solidity
// Register a new document
function registerDocument(string memory documentHash, string memory cid) external

// Self-verify a document
function selfVerifyDocument(string memory documentHash) external

// Third-party verification
function verifyDocument(string memory documentHash, string memory verifierName) external

// Check if document is verified
function isDocumentVerified(string memory documentHash) external view returns (bool)

// Get all verifications for a document
function getDocumentVerifications(string memory documentHash) external view returns (Verification[] memory)
```

### **Events**
- `DocumentRegistered(string indexed documentHash, string cid, address indexed owner, uint256 timestamp)`
- `DocumentVerified(string indexed documentHash, address indexed verifier, string verifierName, uint256 timestamp)`

## 📁 Project Structure

```
proofvault/
├── contracts/
│   └── ProofVault.sol              # Main smart contract
├── src/
│   ├── components/
│   │   ├── CIDDisplay.jsx          # Content identifier display
│   │   ├── DocumentVault.jsx       # Document management dashboard
│   │   ├── FileUpload.jsx          # File upload and registration
│   │   ├── VerificationInterface.jsx # Document verification UI
│   │   ├── VerificationRequest.jsx  # Verification request handling
│   │   ├── VerificationQueue.jsx   # Verification status tracking
│   │   ├── WalletConnection.jsx    # Web3 wallet integration
│   │   └── providers/
│   │       └── Web3Provider.tsx    # Web3 context provider
│   ├── config/
│   │   └── web3.ts                 # Blockchain configuration
│   ├── utils/
│   │   ├── blockchainService.js    # Smart contract interactions
│   │   └── retryUtils.js           # Network retry logic
│   ├── App.jsx                     # Main application component
│   └── main.jsx                    # Application entry point
├── scripts/
│   └── deploy.cjs                  # Contract deployment script
├── hardhat.config.cjs              # Hardhat configuration
├── package.json                    # Dependencies and scripts
└── README.md                       # This file
```

## 🛠️ Development

### **Available Scripts**

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Compile smart contracts
npx hardhat compile

# Deploy contracts (testnet)
npx hardhat run scripts/deploy.cjs --network calibration

# Run local Hardhat node
npx hardhat node
```

### **Smart Contract Development**

1. **Compile Contracts**:
   ```bash
   npx hardhat compile
   ```

2. **Run Tests**:
   ```bash
   npx hardhat test
   ```

3. **Deploy to Testnet**:
   ```bash
   npx hardhat run scripts/deploy.cjs --network calibration
   ```

4. **Verify Contract** (optional):
   ```bash
   npx hardhat verify --network calibration <CONTRACT_ADDRESS>
   ```

### **Frontend Development**

The frontend uses a modular component architecture:

- **Web3Provider.tsx**: Manages wallet connections and blockchain state
- **Components**: Self-contained UI components with accompanying CSS
- **Services**: Utility functions for blockchain interactions
- **Config**: Network and application configuration

## 🧪 Testing

### **Manual Testing Checklist**

- [ ] Wallet connection/disconnection
- [ ] File upload and hash generation
- [ ] Document registration on blockchain
- [ ] Transaction hash storage and display
- [ ] Self-verification process
- [ ] Third-party verification requests
- [ ] Document vault display and filtering
- [ ] Responsive design on mobile devices

### **Test Network Setup**

The application is configured for Filecoin Calibration testnet:
- **Chain ID**: 314159
- **RPC**: https://api.calibration.node.glif.io/rpc/v1
- **Explorer**: https://calibration.filscan.io/

## 🚀 Deployment

### **Frontend Deployment**

1. **Build the Application**:
   ```bash
   npm run build
   ```

2. **Deploy to Static Hosting**:
   - Upload `dist/` folder to your hosting provider
   - Ensure proper routing for SPA (Single Page Application)
   - Configure HTTPS for Web3 wallet security

### **Popular Hosting Options**
- **Vercel**: Zero-config deployment with Git integration
- **Netlify**: Continuous deployment with build optimization
- **IPFS**: Decentralized hosting for full Web3 experience
- **GitHub Pages**: Free static hosting for public repositories

### **Smart Contract Deployment**

The contract is already deployed on Filecoin Calibration. For mainnet deployment:

1. Update `hardhat.config.cjs` with mainnet settings
2. Deploy with sufficient FIL for gas fees
3. Update frontend configuration with new contract address
4. Thoroughly test all functionality before public release

## 🔐 Security Considerations

### **Smart Contract Security**
- ✅ Reentrancy protection with OpenZeppelin's ReentrancyGuard
- ✅ Access control for sensitive functions
- ✅ Input validation and proper error handling
- ✅ Gas optimization to prevent DoS attacks
- ✅ Event logging for transparency

### **Frontend Security**
- ✅ Secure Web3 integration with established libraries
- ✅ Client-side validation before blockchain calls
- ✅ Proper error handling and user feedback
- ✅ No private key storage or handling

### **Best Practices**
- Always verify contract addresses before transactions
- Use official wallet extensions (MetaMask)
- Keep private keys secure and never share them
- Verify all transactions before signing
- Use testnet for development and testing

## 🤝 Contributing

We welcome contributions to ProofVault! Here's how you can help:

### **Getting Started**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and ensure code quality
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### **Development Guidelines**
- Follow existing code style and conventions
- Add comments for complex logic
- Update documentation for new features
- Test thoroughly on testnet before submitting
- Include descriptive commit messages

### **Types of Contributions**
- 🐛 Bug fixes and patches
- ⚡ Performance improvements
- 📚 Documentation enhancements
- 🎨 UI/UX improvements
- 🔧 New features and functionality
- 🧪 Test coverage improvements

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Filecoin Foundation** - For providing the decentralized storage infrastructure
- **OpenZeppelin** - For secure smart contract libraries
- **Wagmi Team** - For excellent Web3 React hooks
- **Vite Team** - For the fast build tool
- **MetaMask** - For wallet integration capabilities

## 📞 Support & Community

- **Issues**: Report bugs or request features via GitHub Issues
- **Discussions**: Join community discussions in GitHub Discussions
- **Documentation**: Comprehensive guides in the `/docs` folder
- **Twitter**: Follow [@ProofVault](https://twitter.com/proofvault) for updates

## 🗺️ Roadmap

### **Phase 1: Core Platform** ✅
- [x] Document registration and verification
- [x] Blockchain integration with Filecoin
- [x] Basic UI and wallet connection
- [x] Smart contract deployment

### **Phase 2: Enhanced Features** 🚧
- [ ] Shareable verification links
- [ ] Advanced verifier dashboard
- [ ] Document categories and tagging
- [ ] Bulk document operations

### **Phase 3: Enterprise Features** 📋
- [ ] API for third-party integrations
- [ ] Organization account management
- [ ] Advanced analytics and reporting
- [ ] Custom verification workflows

### **Phase 4: Mainnet & Scale** 🚀
- [ ] Mainnet deployment
- [ ] Mobile application
- [ ] Integration with other blockchains
- [ ] Enterprise partnerships

---

**Built with ❤️ by the ProofVault team**

*Securing documents, one hash at a time* 🔐
