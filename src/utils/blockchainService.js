import { ethers } from 'ethers'

// Filecoin Calibration Testnet Configuration
const NETWORK_CONFIG = {
  chainId: 314159,
  name: 'Filecoin Calibration Testnet',
  rpcUrls: ['https://api.calibration.node.glif.io/rpc/v1'],
  blockExplorerUrls: ['https://calibration.filfox.info/'],
  nativeCurrency: {
    name: 'Filecoin',
    symbol: 'tFIL',
    decimals: 18,
  },
}

// Smart Contract Configuration
const CONTRACT_CONFIG = {
  // TODO: Replace with actual deployed contract address
  address: '0x0000000000000000000000000000000000000000', // Placeholder
  abi: [
    // Core functions from ProofVault.sol
    'function registerDocument(string calldata cid, string calldata tag) external',
    'function verifyDocument(string calldata cid, string calldata verifierName) external',
    'function getDocumentMetadata(string calldata cid) external view returns (address owner, string tag, uint256 timestamp, bool exists)',
    'function isDocumentVerified(string calldata cid) external view returns (bool)',
    'function getUserDocumentCount(address user) external view returns (uint256)',
    'function getDocument(address user, uint256 index) external view returns (string memory)',
    'function getVerifications(string calldata cid) external view returns (tuple(address verifier, string verifierName, uint256 timestamp)[])',
    
    // Events
    'event DocumentRegistered(address indexed user, string cid, string tag, uint256 timestamp)',
    'event DocumentVerified(string indexed cid, address indexed verifier, string verifierName, uint256 timestamp)',
  ],
}

class BlockchainService {
  constructor() {
    this.provider = null
    this.signer = null
    this.contract = null
    this.isConnected = false
    this.account = null
    this.eventListeners = new Map()
  }

  // ========== WALLET CONNECTION ==========

  async connectWallet() {
    try {
      console.log('🔗 BlockchainService: Starting wallet connection...')
      
      if (typeof window.ethereum === 'undefined') {
        console.error('❌ MetaMask not found')
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.')
      }

      console.log('✅ MetaMask detected, checking readiness...')

      // Test MetaMask readiness first
      try {
        const chainId = await window.ethereum.request({
          method: 'eth_chainId',
        })
        console.log('🌐 MetaMask ready, current chain:', chainId)
      } catch (readinessError) {
        console.error('⚠️ MetaMask not ready:', readinessError)
        throw new Error('MetaMask appears to be locked or having issues. Please unlock MetaMask and try again.')
      }

      console.log('📞 Requesting account access...')

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      console.log('📋 Accounts received:', accounts)

      if (accounts.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.')
      }

      console.log('🔧 Setting up provider and signer...')

      // Set up provider and signer
      this.provider = new ethers.providers.Web3Provider(window.ethereum)
      this.signer = this.provider.getSigner()
      this.account = accounts[0]

      console.log('🌐 Checking network...')

      // Ensure we're on the correct network
      await this.ensureCorrectNetwork()

      console.log('📄 Setting up contract instance...')

      // Set up contract instance
      this.contract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        CONTRACT_CONFIG.abi,
        this.signer
      )

      this.isConnected = true

      console.log('👂 Setting up event listeners...')

      // Set up event listeners for account/network changes
      this.setupEventListeners()

      console.log('✅ Wallet connection complete!')

      return {
        success: true,
        account: this.account,
        network: NETWORK_CONFIG.name,
      }
    } catch (error) {
      console.error('❌ Wallet connection failed:', error)
      throw error
    }
  }

  async disconnectWallet() {
    this.provider = null
    this.signer = null
    this.contract = null
    this.isConnected = false
    this.account = null
    this.clearEventListeners()
  }

  async ensureCorrectNetwork() {
    const network = await this.provider.getNetwork()
    
    if (network.chainId !== NETWORK_CONFIG.chainId) {
      try {
        // Try to switch to the correct network
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}` }],
        })
      } catch (switchError) {
        // Network doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}`,
                chainName: NETWORK_CONFIG.name,
                rpcUrls: NETWORK_CONFIG.rpcUrls,
                blockExplorerUrls: NETWORK_CONFIG.blockExplorerUrls,
                nativeCurrency: NETWORK_CONFIG.nativeCurrency,
              },
            ],
          })
        } else {
          throw switchError
        }
      }
    }
  }

  setupEventListeners() {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this))
      window.ethereum.on('chainChanged', this.handleChainChanged.bind(this))
      window.ethereum.on('disconnect', this.handleDisconnect.bind(this))
    }
  }

  clearEventListeners() {
    if (window.ethereum) {
      window.ethereum.removeAllListeners()
    }
    this.eventListeners.clear()
  }

  handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
      this.disconnectWallet()
    } else if (accounts[0] !== this.account) {
      this.account = accounts[0]
      // Trigger reconnection to update signer
      this.connectWallet()
    }
  }

  handleChainChanged(chainId) {
    // Reload the page to handle network changes cleanly
    window.location.reload()
  }

  handleDisconnect() {
    this.disconnectWallet()
  }

  // ========== CONTRACT INTERACTIONS ==========

  async registerDocument(cid, tag, options = {}) {
    try {
      if (!this.isConnected || !this.contract) {
        throw new Error('Wallet not connected. Please connect your wallet first.')
      }

      if (!cid || !tag) {
        throw new Error('CID and tag are required.')
      }

      // Validate inputs
      if (typeof cid !== 'string' || cid.trim().length === 0) {
        throw new Error('Invalid CID provided.')
      }

      if (typeof tag !== 'string' || tag.trim().length === 0) {
        throw new Error('Invalid tag provided.')
      }

      // Estimate gas
      const gasEstimate = await this.contract.estimateGas.registerDocument(cid, tag)
      const gasLimit = gasEstimate.mul(120).div(100) // Add 20% buffer

      // Get current gas price
      const gasPrice = await this.provider.getGasPrice()

      console.log('🔗 Registering document on blockchain...', {
        cid: cid,
        tag: tag,
        estimatedGas: gasEstimate.toString(),
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei') + ' gwei',
      })

      // Send transaction
      const tx = await this.contract.registerDocument(cid, tag, {
        gasLimit: gasLimit,
        gasPrice: options.gasPrice || gasPrice,
        ...options,
      })

      console.log('📤 Transaction submitted:', tx.hash)

      return {
        success: true,
        transactionHash: tx.hash,
        transaction: tx,
        estimatedGas: gasEstimate.toString(),
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
      }
    } catch (error) {
      console.error('Document registration failed:', error)
      throw this.parseContractError(error)
    }
  }

  async waitForTransaction(transactionHash, confirmations = 1) {
    try {
      console.log('⏳ Waiting for transaction confirmation...', transactionHash)
      
      const receipt = await this.provider.waitForTransaction(transactionHash, confirmations)
      
      if (receipt.status === 1) {
        console.log('✅ Transaction confirmed!', {
          hash: receipt.transactionHash,
          block: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        })

        return {
          success: true,
          receipt: receipt,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        }
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error) {
      console.error('Transaction confirmation failed:', error)
      throw error
    }
  }

  async getDocumentMetadata(cid) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized. Please connect your wallet.')
      }

      const metadata = await this.contract.getDocumentMetadata(cid)
      
      return {
        owner: metadata.owner,
        tag: metadata.tag,
        timestamp: metadata.timestamp.toNumber(),
        exists: metadata.exists,
      }
    } catch (error) {
      console.error('Failed to get document metadata:', error)
      throw this.parseContractError(error)
    }
  }

  async isDocumentVerified(cid) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized. Please connect your wallet.')
      }

      return await this.contract.isDocumentVerified(cid)
    } catch (error) {
      console.error('Failed to check document verification:', error)
      throw this.parseContractError(error)
    }
  }

  async getUserDocuments(userAddress) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized. Please connect your wallet.')
      }

      const count = await this.contract.getUserDocumentCount(userAddress)
      const documents = []

      for (let i = 0; i < count.toNumber(); i++) {
        const cid = await this.contract.getDocument(userAddress, i)
        documents.push(cid)
      }

      return documents
    } catch (error) {
      console.error('Failed to get user documents:', error)
      throw this.parseContractError(error)
    }
  }

  // ========== EVENT LISTENING ==========

  listenForDocumentRegistered(callback) {
    if (!this.contract) {
      throw new Error('Contract not initialized. Please connect your wallet.')
    }

    const filter = this.contract.filters.DocumentRegistered()
    
    this.contract.on(filter, (user, cid, tag, timestamp, event) => {
      const eventData = {
        user,
        cid,
        tag,
        timestamp: timestamp.toNumber(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
      }
      
      console.log('📄 Document registered event:', eventData)
      callback(eventData)
    })

    this.eventListeners.set('DocumentRegistered', filter)
  }

  listenForDocumentVerified(callback) {
    if (!this.contract) {
      throw new Error('Contract not initialized. Please connect your wallet.')
    }

    const filter = this.contract.filters.DocumentVerified()
    
    this.contract.on(filter, (cid, verifier, verifierName, timestamp, event) => {
      const eventData = {
        cid,
        verifier,
        verifierName,
        timestamp: timestamp.toNumber(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
      }
      
      console.log('✅ Document verified event:', eventData)
      callback(eventData)
    })

    this.eventListeners.set('DocumentVerified', filter)
  }

  stopListening(eventName) {
    if (this.eventListeners.has(eventName)) {
      this.contract.removeAllListeners(this.eventListeners.get(eventName))
      this.eventListeners.delete(eventName)
    }
  }

  // ========== UTILITY FUNCTIONS ==========

  parseContractError(error) {
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return new Error('Transaction would fail. Please check if the document is already registered or if you have sufficient balance.')
    }

    if (error.code === 'INSUFFICIENT_FUNDS') {
      return new Error('Insufficient FIL balance to complete the transaction.')
    }

    if (error.code === 'USER_REJECTED') {
      return new Error('Transaction was rejected by user.')
    }

    if (error.code === 'NETWORK_ERROR') {
      return new Error('Network error. Please check your connection and try again.')
    }

    // Extract revert reason from contract
    if (error.reason) {
      return new Error(error.reason)
    }

    if (error.message) {
      return new Error(error.message)
    }

    return new Error('An unknown error occurred while interacting with the blockchain.')
  }

  async getBalance(address = null) {
    try {
      const targetAddress = address || this.account
      if (!targetAddress) {
        throw new Error('No address provided and no wallet connected.')
      }

      const balance = await this.provider.getBalance(targetAddress)
      return ethers.utils.formatEther(balance)
    } catch (error) {
      console.error('Failed to get balance:', error)
      throw error
    }
  }

  async estimateGas(method, ...args) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized. Please connect your wallet.')
      }

      const gasEstimate = await this.contract.estimateGas[method](...args)
      const gasPrice = await this.provider.getGasPrice()

      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
        estimatedCost: ethers.utils.formatEther(gasEstimate.mul(gasPrice)),
      }
    } catch (error) {
      console.error('Gas estimation failed:', error)
      throw this.parseContractError(error)
    }
  }

  // ========== CONFIGURATION ==========

  updateContractAddress(newAddress) {
    CONTRACT_CONFIG.address = newAddress
    
    if (this.signer) {
      this.contract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        CONTRACT_CONFIG.abi,
        this.signer
      )
    }
  }

  getContractAddress() {
    return CONTRACT_CONFIG.address
  }

  getNetworkConfig() {
    return NETWORK_CONFIG
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      account: this.account,
      contractAddress: CONTRACT_CONFIG.address,
      network: NETWORK_CONFIG.name,
    }
  }
}

// Export singleton instance
const blockchainService = new BlockchainService()
export default blockchainService 