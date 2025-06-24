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

// Smart Contract Configuration - Updated with actual deployed address
const CONTRACT_CONFIG = {
  address: '0x527C50036dB179c92b87518818618041F640005F', // ProofVault contract on Filecoin Calibration
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
    
    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      exponentialBase: 2,
      jitter: true,
    }
    
    // Circuit breaker configuration
    this.circuitBreaker = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      failureCount: 0,
      lastFailureTime: null,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
    }
    
    // Error classification
    this.errorTypes = {
      RECOVERABLE: 'RECOVERABLE',
      NON_RECOVERABLE: 'NON_RECOVERABLE',
      USER_ACTION_REQUIRED: 'USER_ACTION_REQUIRED',
      RATE_LIMITED: 'RATE_LIMITED',
    }

    // Transaction tracking
    this.activeTransactions = new Map()
    this.transactionHistory = []
    this.transactionCallbacks = new Map()
    
    // Transaction status constants
    this.TransactionStatus = {
      PENDING: 'PENDING',
      SUBMITTED: 'SUBMITTED',
      CONFIRMING: 'CONFIRMING', 
      CONFIRMED: 'CONFIRMED',
      FAILED: 'FAILED',
      CANCELLED: 'CANCELLED',
      REPLACED: 'REPLACED',
    }
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
      
      // Restart any contract event listeners that were active before disconnection
      await this.restartEventListeners()

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
    // Clear wallet event listeners but preserve contract event listener configs for restart
    this.clearEventListeners()
    
    // Stop contract event listeners but keep their configuration
    const eventListenerConfigs = new Map(this.eventListeners)
    this.stopListening() // Stop all contract event listeners
    
    // Store configurations for restart
    this.preservedEventListeners = eventListenerConfigs
    
    this.provider = null
    this.signer = null
    this.contract = null
    this.isConnected = false
    this.account = null
    console.log('👋 Wallet disconnected (event listener configs preserved)')
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

      // Create transaction tracker
      const tracker = this.createTransactionTracker(tx.hash, {
        operation: 'registerDocument',
        cid: cid,
        tag: tag,
        gasEstimate: gasEstimate.toString(),
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
      })

      return {
        success: true,
        transactionHash: tx.hash,
        transaction: tx,
        tracker: tracker,
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

  // ========== ENHANCED EVENT LISTENING FOR ON-CHAIN UPDATES ==========

  listenForDocumentRegistered(callback, options = {}) {
    if (!this.contract) {
      throw new Error('Contract not initialized. Please connect your wallet.')
    }

    const { 
      fromBlock = 'latest',
      userFilter = null,
      once = false,
      includeTransactionDetails = true 
    } = options

    // Create filter with optional user filtering
    const filter = userFilter ? 
      this.contract.filters.DocumentRegistered(userFilter) :
      this.contract.filters.DocumentRegistered()

    const eventHandler = async (user, cid, tag, timestamp, event) => {
      try {
        const eventData = {
          user,
          cid,
          tag,
          timestamp: timestamp.toNumber(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          eventName: 'DocumentRegistered',
          receivedAt: Date.now(),
        }

        // Add transaction details if requested
        if (includeTransactionDetails) {
          try {
            const tx = await this.provider.getTransaction(event.transactionHash)
            const receipt = await this.provider.getTransactionReceipt(event.transactionHash)
            
            eventData.transactionDetails = {
              gasUsed: receipt.gasUsed.toString(),
              effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
              confirmations: await tx.confirmations(),
              status: receipt.status,
            }
          } catch (txError) {
            console.warn('Could not fetch transaction details:', txError)
          }
        }

        console.log('📄 Document registered event:', eventData)
        
        // Update transaction tracker if it exists
        this.updateTransactionEventReceived(event.transactionHash, 'DocumentRegistered', eventData)
        
        callback(eventData)

        // Remove listener if once option is set
        if (once) {
          this.stopListening('DocumentRegistered')
        }
      } catch (error) {
        console.error('Error processing DocumentRegistered event:', error)
      }
    }

    // Set up listener with from block
    if (fromBlock !== 'latest') {
      this.contract.on(filter, eventHandler)
      // Also query historical events
      this.queryHistoricalEvents('DocumentRegistered', fromBlock, 'latest', callback, options)
    } else {
      this.contract.on(filter, eventHandler)
    }

    this.eventListeners.set('DocumentRegistered', { 
      filter, 
      handler: eventHandler, 
      callback, 
      options,
      startedAt: Date.now() 
    })
    
    console.log(`👂 Started listening for DocumentRegistered events (fromBlock: ${fromBlock})`)
  }

  listenForDocumentVerified(callback, options = {}) {
    if (!this.contract) {
      throw new Error('Contract not initialized. Please connect your wallet.')
    }

    const { 
      fromBlock = 'latest',
      cidFilter = null,
      verifierFilter = null,
      once = false,
      includeTransactionDetails = true 
    } = options

    // Create filter with optional filtering
    const filter = this.contract.filters.DocumentVerified(cidFilter, verifierFilter)

    const eventHandler = async (cid, verifier, verifierName, timestamp, event) => {
      try {
        const eventData = {
          cid,
          verifier,
          verifierName,
          timestamp: timestamp.toNumber(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          eventName: 'DocumentVerified',
          receivedAt: Date.now(),
        }

        // Add transaction details if requested
        if (includeTransactionDetails) {
          try {
            const tx = await this.provider.getTransaction(event.transactionHash)
            const receipt = await this.provider.getTransactionReceipt(event.transactionHash)
            
            eventData.transactionDetails = {
              gasUsed: receipt.gasUsed.toString(),
              effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
              confirmations: await tx.confirmations(),
              status: receipt.status,
            }
          } catch (txError) {
            console.warn('Could not fetch transaction details:', txError)
          }
        }

        console.log('✅ Document verified event:', eventData)
        
        // Update transaction tracker if it exists
        this.updateTransactionEventReceived(event.transactionHash, 'DocumentVerified', eventData)
        
        callback(eventData)

        // Remove listener if once option is set
        if (once) {
          this.stopListening('DocumentVerified')
        }
      } catch (error) {
        console.error('Error processing DocumentVerified event:', error)
      }
    }

    // Set up listener
    if (fromBlock !== 'latest') {
      this.contract.on(filter, eventHandler)
      // Also query historical events
      this.queryHistoricalEvents('DocumentVerified', fromBlock, 'latest', callback, options)
    } else {
      this.contract.on(filter, eventHandler)
    }

    this.eventListeners.set('DocumentVerified', { 
      filter, 
      handler: eventHandler, 
      callback, 
      options,
      startedAt: Date.now() 
    })
    
    console.log(`👂 Started listening for DocumentVerified events (fromBlock: ${fromBlock})`)
  }

  // Enhanced universal event listener for all contract events
  listenForAllEvents(callback, options = {}) {
    if (!this.contract) {
      throw new Error('Contract not initialized. Please connect your wallet.')
    }

    const { fromBlock = 'latest', includeTransactionDetails = false } = options

    const universalHandler = async (...args) => {
      const event = args[args.length - 1] // Last argument is always the event object
      
      try {
        const eventData = {
          eventName: event.event,
          args: args.slice(0, -1), // All arguments except the event object
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          logIndex: event.logIndex,
          address: event.address,
          receivedAt: Date.now(),
        }

        // Parse event-specific data
        switch (event.event) {
          case 'DocumentRegistered':
            eventData.parsed = {
              user: args[0],
              cid: args[1],
              tag: args[2],
              timestamp: args[3].toNumber(),
            }
            break
          case 'DocumentVerified':
            eventData.parsed = {
              cid: args[0],
              verifier: args[1],
              verifierName: args[2],
              timestamp: args[3].toNumber(),
            }
            break
        }

        // Add transaction details if requested
        if (includeTransactionDetails) {
          try {
            const tx = await this.provider.getTransaction(event.transactionHash)
            const receipt = await this.provider.getTransactionReceipt(event.transactionHash)
            
            eventData.transactionDetails = {
              gasUsed: receipt.gasUsed.toString(),
              effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
              confirmations: await tx.confirmations(),
              status: receipt.status,
            }
          } catch (txError) {
            console.warn('Could not fetch transaction details:', txError)
          }
        }

        console.log(`🔔 Contract event received: ${event.event}`, eventData)
        
        // Update transaction tracker
        this.updateTransactionEventReceived(event.transactionHash, event.event, eventData)
        
        callback(eventData)
      } catch (error) {
        console.error(`Error processing ${event.event} event:`, error)
      }
    }

    // Listen to all events
    this.contract.on('*', universalHandler)

    this.eventListeners.set('AllEvents', {
      filter: '*',
      handler: universalHandler,
      callback,
      options,
      startedAt: Date.now()
    })

    console.log(`👂 Started listening for ALL contract events (fromBlock: ${fromBlock})`)
  }

  // Query historical events
  async queryHistoricalEvents(eventName, fromBlock, toBlock = 'latest', callback = null, options = {}) {
    if (!this.contract) {
      throw new Error('Contract not initialized. Please connect your wallet.')
    }

    try {
      let filter
      
      switch (eventName) {
        case 'DocumentRegistered':
          filter = options.userFilter ? 
            this.contract.filters.DocumentRegistered(options.userFilter) :
            this.contract.filters.DocumentRegistered()
          break
        case 'DocumentVerified':
          filter = this.contract.filters.DocumentVerified(options.cidFilter, options.verifierFilter)
          break
        default:
          throw new Error(`Unknown event name: ${eventName}`)
      }

      console.log(`🔍 Querying historical ${eventName} events from block ${fromBlock} to ${toBlock}`)
      
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock)
      
      console.log(`📚 Found ${events.length} historical ${eventName} events`)

      const processedEvents = []
      
      for (const event of events) {
        const eventData = {
          eventName: event.event,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          logIndex: event.logIndex,
          isHistorical: true,
          receivedAt: Date.now(),
        }

        // Parse event-specific data
        switch (eventName) {
          case 'DocumentRegistered':
            eventData.user = event.args[0]
            eventData.cid = event.args[1]
            eventData.tag = event.args[2]
            eventData.timestamp = event.args[3].toNumber()
            break
          case 'DocumentVerified':
            eventData.cid = event.args[0]
            eventData.verifier = event.args[1]
            eventData.verifierName = event.args[2]
            eventData.timestamp = event.args[3].toNumber()
            break
        }

        processedEvents.push(eventData)

        // Call callback if provided
        if (callback) {
          callback(eventData)
        }
      }

      return processedEvents
    } catch (error) {
      console.error(`Error querying historical ${eventName} events:`, error)
      throw error
    }
  }

  // Update transaction tracker when events are received
  updateTransactionEventReceived(transactionHash, eventName, eventData) {
    const tracker = this.activeTransactions.get(transactionHash)
    if (tracker) {
      if (!tracker.events) {
        tracker.events = []
      }
      
      tracker.events.push({
        eventName,
        eventData,
        receivedAt: Date.now(),
      })
      
      console.log(`📊 Transaction ${transactionHash} received event: ${eventName}`)
    }
  }

  // Enhanced stop listening with specific event management
  stopListening(eventName = null) {
    if (eventName) {
      // Stop specific event listener
      if (this.eventListeners.has(eventName)) {
        const listener = this.eventListeners.get(eventName)
        
        if (eventName === 'AllEvents') {
          this.contract.removeAllListeners()
        } else {
          this.contract.removeAllListeners(listener.filter)
        }
        
        this.eventListeners.delete(eventName)
        console.log(`🔇 Stopped listening for ${eventName} events`)
      }
    } else {
      // Stop all event listeners
      this.contract.removeAllListeners()
      this.eventListeners.clear()
      console.log('🔇 Stopped listening for all events')
    }
  }

  // Get event listener status and statistics
  getEventListenerStatus() {
    const listeners = Array.from(this.eventListeners.entries()).map(([name, listener]) => ({
      eventName: name,
      startedAt: listener.startedAt,
      duration: Date.now() - listener.startedAt,
      options: listener.options,
      isActive: true,
    }))

    return {
      activeListeners: listeners.length,
      listeners: listeners,
      totalUptime: listeners.reduce((sum, l) => sum + l.duration, 0),
    }
  }

  // Restart all event listeners (useful after network reconnection)
  async restartEventListeners() {
    // Use preserved listeners if available, otherwise use current listeners
    const listenersToRestart = this.preservedEventListeners || this.eventListeners
    const currentListeners = Array.from(listenersToRestart.entries())
    
    if (currentListeners.length === 0) {
      console.log('ℹ️ No event listeners to restart')
      return
    }
    
    // Ensure we're connected before restarting
    if (!this.contract) {
      console.warn('⚠️ Cannot restart event listeners: contract not initialized')
      return
    }
    
    // Stop all current listeners first
    this.stopListening()
    
    let restarted = 0
    
    // Restart each listener with original settings
    for (const [eventName, listener] of currentListeners) {
      try {
        if (eventName === 'DocumentRegistered') {
          this.listenForDocumentRegistered(listener.callback, listener.options)
          restarted++
        } else if (eventName === 'DocumentVerified') {
          this.listenForDocumentVerified(listener.callback, listener.options)
          restarted++
        } else if (eventName === 'AllEvents') {
          this.listenForAllEvents(listener.callback, listener.options)
          restarted++
        }
        
        console.log(`🔄 Restarted ${eventName} event listener`)
      } catch (error) {
        console.error(`Failed to restart ${eventName} event listener:`, error)
      }
    }
    
    // Clear preserved listeners after successful restart
    if (this.preservedEventListeners && restarted > 0) {
      this.preservedEventListeners = null
    }
    
    console.log(`🔄 Successfully restarted ${restarted} event listeners`)
  }

  // ========== RETRY AND ERROR HANDLING ==========

  async withRetry(operation, operationName = 'operation', customConfig = {}) {
    const config = { ...this.retryConfig, ...customConfig }
    let lastError = null
    
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      throw new Error(`Circuit breaker is OPEN for ${operationName}. Too many failures recently. Try again later.`)
    }

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempting ${operationName} (attempt ${attempt + 1}/${config.maxRetries + 1})`)
        
        const result = await operation()
        
        // Reset circuit breaker on success
        if (attempt > 0) {
          console.log(`✅ ${operationName} succeeded after ${attempt + 1} attempts`)
          this.resetCircuitBreaker()
        }
        
        return result
      } catch (error) {
        lastError = error
        const errorCategory = this.classifyError(error)
        
        console.error(`❌ ${operationName} failed (attempt ${attempt + 1}):`, error.message)
        
        // Don't retry for non-recoverable errors
        if (errorCategory === this.errorTypes.NON_RECOVERABLE || 
            errorCategory === this.errorTypes.USER_ACTION_REQUIRED) {
          console.log(`🚫 Not retrying ${operationName}: ${errorCategory}`)
          this.recordFailure()
          throw this.enhanceError(error, operationName, attempt + 1)
        }
        
        // Don't retry on final attempt
        if (attempt === config.maxRetries) {
          console.log(`🚫 Max retries (${config.maxRetries}) exceeded for ${operationName}`)
          this.recordFailure()
          break
        }
        
        // Calculate delay for next retry
        const delay = this.calculateRetryDelay(attempt, config, errorCategory)
        console.log(`⏳ Retrying ${operationName} in ${delay}ms...`)
        
        await this.sleep(delay)
      }
    }
    
    this.recordFailure()
    throw this.enhanceError(lastError, operationName, config.maxRetries + 1)
  }

  classifyError(error) {
    // Network and connection errors (recoverable)
    if (error.code === 'NETWORK_ERROR' || 
        error.code === 'TIMEOUT' ||
        error.message?.includes('network') ||
        error.message?.includes('timeout') ||
        error.message?.includes('connection') ||
        error.message?.includes('fetch')) {
      return this.errorTypes.RECOVERABLE
    }
    
    // Rate limiting (recoverable with longer delay)
    if (error.code === 'RATE_LIMITED' ||
        error.status === 429 ||
        error.message?.includes('rate limit') ||
        error.message?.includes('too many requests')) {
      return this.errorTypes.RATE_LIMITED
    }
    
    // Gas estimation failures (potentially recoverable)
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return this.errorTypes.RECOVERABLE
    }
    
    // User actions (don't retry)
    if (error.code === 'USER_REJECTED' ||
        error.code === 'ACTION_REJECTED' ||
        error.message?.includes('rejected')) {
      return this.errorTypes.USER_ACTION_REQUIRED
    }
    
    // Insufficient funds (user needs to add funds)
    if (error.code === 'INSUFFICIENT_FUNDS' ||
        error.message?.includes('insufficient')) {
      return this.errorTypes.USER_ACTION_REQUIRED
    }
    
    // Contract reverts and validation errors (don't retry)
    if (error.reason ||
        error.code === 'CALL_EXCEPTION' ||
        error.message?.includes('revert') ||
        error.message?.includes('execution reverted')) {
      return this.errorTypes.NON_RECOVERABLE
    }
    
    // Default to recoverable for unknown errors
    return this.errorTypes.RECOVERABLE
  }

  calculateRetryDelay(attempt, config, errorCategory) {
    let baseDelay = config.baseDelay
    
    // Longer delays for rate limiting
    if (errorCategory === this.errorTypes.RATE_LIMITED) {
      baseDelay = Math.min(config.baseDelay * 5, 10000) // 5x base delay, max 10s
    }
    
    // Exponential backoff
    const exponentialDelay = baseDelay * Math.pow(config.exponentialBase, attempt)
    
    // Apply maximum delay limit
    let delay = Math.min(exponentialDelay, config.maxDelay)
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      const jitterRange = delay * 0.1 // ±10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterRange
    }
    
    return Math.round(Math.max(delay, 100)) // Minimum 100ms delay
  }

  enhanceError(originalError, operationName, totalAttempts) {
    const enhancedError = new Error(
      `${operationName} failed after ${totalAttempts} attempts: ${originalError.message}`
    )
    
    enhancedError.originalError = originalError
    enhancedError.operationName = operationName
    enhancedError.totalAttempts = totalAttempts
    enhancedError.errorCategory = this.classifyError(originalError)
    enhancedError.code = originalError.code
    enhancedError.timestamp = new Date().toISOString()
    
    return enhancedError
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Circuit breaker methods
  isCircuitBreakerOpen() {
    if (this.circuitBreaker.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime
      if (timeSinceLastFailure > this.circuitBreaker.resetTimeout) {
        this.circuitBreaker.state = 'HALF_OPEN'
        console.log('🔄 Circuit breaker moving to HALF_OPEN state')
        return false
      }
      return true
    }
    return false
  }

  recordFailure() {
    this.circuitBreaker.failureCount++
    this.circuitBreaker.lastFailureTime = Date.now()
    
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.state = 'OPEN'
      console.warn(`🚨 Circuit breaker OPENED after ${this.circuitBreaker.failureCount} failures`)
    }
  }

  resetCircuitBreaker() {
    this.circuitBreaker.failureCount = 0
    this.circuitBreaker.state = 'CLOSED'
    this.circuitBreaker.lastFailureTime = null
    console.log('✅ Circuit breaker RESET to CLOSED state')
  }

  // Enhanced operation wrappers with transaction tracking
  async registerDocumentWithRetry(cid, tag, options = {}) {
    const result = await this.withRetry(
      () => this.registerDocument(cid, tag, options),
      'registerDocument',
      { maxRetries: 2 } // Fewer retries for transactions to avoid multiple submissions
    )

    // Auto-start transaction tracking if not disabled
    if (result.tracker && !options.skipTracking) {
      this.startTransactionPolling(result.transactionHash)
    }

    return result
  }

  // Complete registration with tracking and confirmation
  async registerDocumentAndWait(cid, tag, options = {}) {
    const { confirmations = 1, onProgress = null, ...txOptions } = options
    
    const result = await this.registerDocumentWithRetry(cid, tag, txOptions)
    
    // Wait for confirmation with progress updates
    const confirmedTracker = await this.waitForTransactionWithProgress(
      result.transactionHash, 
      confirmations, 
      onProgress
    )
    
    return {
      ...result,
      tracker: confirmedTracker,
      confirmed: true,
    }
  }

  async getDocumentMetadataWithRetry(cid) {
    return this.withRetry(
      () => this.getDocumentMetadata(cid),
      'getDocumentMetadata'
    )
  }

  async getUserDocumentsWithRetry(userAddress) {
    return this.withRetry(
      () => this.getUserDocuments(userAddress),
      'getUserDocuments'
    )
  }

  async connectWalletWithRetry() {
    return this.withRetry(
      () => this.connectWallet(),
      'connectWallet',
      { maxRetries: 2 } // Limited retries for wallet connection
    )
  }

  async estimateGasWithRetry(method, ...args) {
    return this.withRetry(
      () => this.estimateGas(method, ...args),
      `estimateGas(${method})`
    )
  }

  // ========== TRANSACTION TRACKING AND STATUS UPDATES ==========

  createTransactionTracker(transactionHash, metadata = {}) {
    const tracker = {
      hash: transactionHash,
      status: this.TransactionStatus.SUBMITTED,
      submittedAt: Date.now(),
      confirmedAt: null,
      failedAt: null,
      blockNumber: null,
      gasUsed: null,
      effectiveGasPrice: null,
      confirmations: 0,
      targetConfirmations: 1,
      retries: 0,
      maxRetries: 3,
      metadata: {
        operation: 'unknown',
        cid: null,
        tag: null,
        ...metadata
      },
      callbacks: {
        onStatusChange: [],
        onConfirmation: [],
        onFailure: [],
        onProgress: []
      },
      error: null,
      receipt: null,
    }

    this.activeTransactions.set(transactionHash, tracker)
    this.transactionHistory.unshift(tracker) // Add to beginning for most recent first
    
    // Keep only last 50 transactions in history
    if (this.transactionHistory.length > 50) {
      this.transactionHistory = this.transactionHistory.slice(0, 50)
    }

    console.log(`📊 Transaction tracker created for ${transactionHash}`, tracker.metadata)
    
    return tracker
  }

  subscribeToTransaction(transactionHash, callbacks = {}) {
    const tracker = this.activeTransactions.get(transactionHash)
    if (!tracker) {
      throw new Error(`Transaction ${transactionHash} not found in active transactions`)
    }

    // Add callbacks
    if (callbacks.onStatusChange) tracker.callbacks.onStatusChange.push(callbacks.onStatusChange)
    if (callbacks.onConfirmation) tracker.callbacks.onConfirmation.push(callbacks.onConfirmation)
    if (callbacks.onFailure) tracker.callbacks.onFailure.push(callbacks.onFailure)
    if (callbacks.onProgress) tracker.callbacks.onProgress.push(callbacks.onProgress)

    return tracker
  }

  updateTransactionStatus(transactionHash, status, additionalData = {}) {
    const tracker = this.activeTransactions.get(transactionHash)
    if (!tracker) {
      console.warn(`⚠️ Attempted to update status for unknown transaction: ${transactionHash}`)
      return
    }

    const previousStatus = tracker.status
    tracker.status = status

    // Update timestamps
    switch (status) {
      case this.TransactionStatus.CONFIRMING:
        break
      case this.TransactionStatus.CONFIRMED:
        tracker.confirmedAt = Date.now()
        break
      case this.TransactionStatus.FAILED:
      case this.TransactionStatus.CANCELLED:
        tracker.failedAt = Date.now()
        break
    }

    // Merge additional data
    Object.assign(tracker, additionalData)

    console.log(`🔄 Transaction ${transactionHash} status: ${previousStatus} → ${status}`)

    // Trigger status change callbacks
    tracker.callbacks.onStatusChange.forEach(callback => {
      try {
        callback(tracker, previousStatus, status)
      } catch (error) {
        console.error('Error in transaction status callback:', error)
      }
    })

    // Handle completion
    if (status === this.TransactionStatus.CONFIRMED || 
        status === this.TransactionStatus.FAILED || 
        status === this.TransactionStatus.CANCELLED) {
      
      if (status === this.TransactionStatus.CONFIRMED) {
        tracker.callbacks.onConfirmation.forEach(callback => {
          try {
            callback(tracker)
          } catch (error) {
            console.error('Error in transaction confirmation callback:', error)
          }
        })
      } else {
        tracker.callbacks.onFailure.forEach(callback => {
          try {
            callback(tracker)
          } catch (error) {
            console.error('Error in transaction failure callback:', error)
          }
        })
      }

      // Remove from active transactions after a delay to allow final callbacks
      setTimeout(() => {
        this.activeTransactions.delete(transactionHash)
        console.log(`🗑️ Transaction ${transactionHash} removed from active tracking`)
      }, 5000)
    }
  }

  async trackTransactionWithRetry(transactionHash, metadata = {}, confirmations = 1) {
    const tracker = this.createTransactionTracker(transactionHash, metadata)
    tracker.targetConfirmations = confirmations

    return new Promise((resolve, reject) => {
      // Set up completion callbacks
      this.subscribeToTransaction(transactionHash, {
        onConfirmation: (tracker) => resolve(tracker),
        onFailure: (tracker) => reject(new Error(tracker.error || 'Transaction failed')),
      })

      // Start tracking
      this.startTransactionPolling(transactionHash)
    })
  }

  async startTransactionPolling(transactionHash) {
    const tracker = this.activeTransactions.get(transactionHash)
    if (!tracker) return

    const pollTransaction = async () => {
      try {
        // Update to confirming status
        if (tracker.status === this.TransactionStatus.SUBMITTED) {
          this.updateTransactionStatus(transactionHash, this.TransactionStatus.CONFIRMING)
        }

        console.log(`🔍 Polling transaction ${transactionHash} (attempt ${tracker.retries + 1})`)

        // Get transaction receipt
        const receipt = await this.provider.getTransactionReceipt(transactionHash)
        
        if (receipt) {
          // Transaction is mined
          tracker.receipt = receipt
          tracker.blockNumber = receipt.blockNumber
          tracker.gasUsed = receipt.gasUsed.toString()
          tracker.effectiveGasPrice = receipt.effectiveGasPrice?.toString()

          if (receipt.status === 1) {
            // Transaction succeeded
            const currentBlock = await this.provider.getBlockNumber()
            tracker.confirmations = Math.max(0, currentBlock - receipt.blockNumber + 1)

            // Trigger progress callback
            tracker.callbacks.onProgress.forEach(callback => {
              try {
                callback(tracker, tracker.confirmations, tracker.targetConfirmations)
              } catch (error) {
                console.error('Error in transaction progress callback:', error)
              }
            })

            if (tracker.confirmations >= tracker.targetConfirmations) {
              // Fully confirmed
              this.updateTransactionStatus(transactionHash, this.TransactionStatus.CONFIRMED, {
                confirmations: tracker.confirmations,
                receipt: receipt,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
              })
              return
            } else {
              // Wait for more confirmations
              setTimeout(pollTransaction, 2000) // Poll every 2 seconds
              return
            }
          } else {
            // Transaction failed
            this.updateTransactionStatus(transactionHash, this.TransactionStatus.FAILED, {
              error: 'Transaction execution failed',
              receipt: receipt,
            })
            return
          }
        }

        // Transaction not yet mined, continue polling
        tracker.retries++
        
        if (tracker.retries >= tracker.maxRetries * 30) { // 30 attempts per retry (about 5 minutes total)
          this.updateTransactionStatus(transactionHash, this.TransactionStatus.FAILED, {
            error: 'Transaction confirmation timeout',
          })
          return
        }

        // Continue polling
        setTimeout(pollTransaction, 2000)

      } catch (error) {
        console.error(`❌ Error polling transaction ${transactionHash}:`, error)
        
        tracker.retries++
        if (tracker.retries < tracker.maxRetries) {
          // Retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, tracker.retries), 10000)
          setTimeout(pollTransaction, delay)
        } else {
          this.updateTransactionStatus(transactionHash, this.TransactionStatus.FAILED, {
            error: error.message || 'Polling failed after max retries',
          })
        }
      }
    }

    // Start polling
    pollTransaction()
  }

  // Enhanced transaction waiting with progress callbacks
  async waitForTransactionWithProgress(transactionHash, confirmations = 1, onProgress = null) {
    const tracker = this.activeTransactions.get(transactionHash)
    if (!tracker) {
      throw new Error(`Transaction ${transactionHash} not found in tracking`)
    }

    if (onProgress) {
      this.subscribeToTransaction(transactionHash, { onProgress })
    }

    return this.trackTransactionWithRetry(transactionHash, tracker.metadata, confirmations)
  }

  // Get transaction status and details
  getTransactionStatus(transactionHash) {
    const tracker = this.activeTransactions.get(transactionHash)
    if (tracker) {
      return {
        ...tracker,
        isActive: true,
        duration: Date.now() - tracker.submittedAt,
      }
    }

    // Check transaction history
    const historical = this.transactionHistory.find(tx => tx.hash === transactionHash)
    if (historical) {
      return {
        ...historical,
        isActive: false,
        duration: (historical.confirmedAt || historical.failedAt || Date.now()) - historical.submittedAt,
      }
    }

    return null
  }

  // Get all active transactions
  getActiveTransactions() {
    return Array.from(this.activeTransactions.values()).map(tracker => ({
      ...tracker,
      isActive: true,
      duration: Date.now() - tracker.submittedAt,
    }))
  }

  // Get transaction history
  getTransactionHistory(limit = 20) {
    return this.transactionHistory.slice(0, limit).map(tx => ({
      ...tx,
      isActive: this.activeTransactions.has(tx.hash),
      duration: (tx.confirmedAt || tx.failedAt || Date.now()) - tx.submittedAt,
    }))
  }

  // Cancel transaction tracking (not the transaction itself)
  cancelTransactionTracking(transactionHash) {
    const tracker = this.activeTransactions.get(transactionHash)
    if (tracker) {
      this.updateTransactionStatus(transactionHash, this.TransactionStatus.CANCELLED)
    }
  }

  // Clean up old transactions
  cleanupTransactionHistory(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const cutoff = Date.now() - maxAge
    const originalLength = this.transactionHistory.length
    
    this.transactionHistory = this.transactionHistory.filter(tx => 
      tx.submittedAt > cutoff || this.activeTransactions.has(tx.hash)
    )
    
    const removed = originalLength - this.transactionHistory.length
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} old transactions from history`)
    }
  }

  // ========== UTILITY FUNCTIONS ==========

  parseContractError(error) {
    // Return enhanced error if it's already been processed by retry system
    if (error.operationName && error.totalAttempts) {
      return error
    }

    const errorCategory = this.classifyError(error)
    let userMessage = ''
    let suggestions = []

    switch (error.code) {
      case 'UNPREDICTABLE_GAS_LIMIT':
        userMessage = 'Transaction would fail. Please check if the document is already registered or if you have sufficient balance.'
        suggestions = [
          'Verify the document is not already registered',
          'Check your tFIL balance',
          'Try refreshing the page and reconnecting your wallet'
        ]
        break

      case 'INSUFFICIENT_FUNDS':
        userMessage = 'Insufficient tFIL balance to complete the transaction.'
        suggestions = [
          'Get test tFIL from the faucet',
          'Check your wallet balance',
          'Ensure you\'re on the correct network'
        ]
        break

      case 'USER_REJECTED':
        userMessage = 'Transaction was rejected by user.'
        suggestions = [
          'Try the transaction again',
          'Check your wallet for pending transactions'
        ]
        break

      case 'NETWORK_ERROR':
        userMessage = 'Network error. Please check your connection and try again.'
        suggestions = [
          'Check your internet connection',
          'Try switching to a different RPC endpoint',
          'Wait a moment and try again'
        ]
        break

      default:
        // Extract revert reason from contract
        if (error.reason) {
          userMessage = error.reason
        } else if (error.message) {
          userMessage = error.message
        } else {
          userMessage = 'An unknown error occurred while interacting with the blockchain.'
        }
        
        suggestions = [
          'Try the operation again',
          'Check the console for more details',
          'Contact support if the issue persists'
        ]
    }

    // Create enhanced error with metadata
    const enhancedError = new Error(userMessage)
    enhancedError.originalError = error
    enhancedError.code = error.code
    enhancedError.errorCategory = errorCategory
    enhancedError.suggestions = suggestions
    enhancedError.timestamp = new Date().toISOString()
    enhancedError.isRetryable = errorCategory === this.errorTypes.RECOVERABLE || 
                               errorCategory === this.errorTypes.RATE_LIMITED

    return enhancedError
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

  // ========== RETRY STATUS AND DIAGNOSTICS ==========

  getRetryStatus() {
    return {
      circuitBreaker: {
        state: this.circuitBreaker.state,
        failureCount: this.circuitBreaker.failureCount,
        failureThreshold: this.circuitBreaker.failureThreshold,
        lastFailureTime: this.circuitBreaker.lastFailureTime,
        resetTimeout: this.circuitBreaker.resetTimeout,
      },
      retryConfig: { ...this.retryConfig },
      isHealthy: this.circuitBreaker.state === 'CLOSED',
    }
  }

  resetRetryState() {
    this.resetCircuitBreaker()
    console.log('🔄 Retry state manually reset')
  }

  updateRetryConfig(newConfig) {
    this.retryConfig = { ...this.retryConfig, ...newConfig }
    console.log('⚙️ Retry configuration updated:', this.retryConfig)
  }

  // ========== TRANSACTION MANAGEMENT UTILITIES ==========

  getTransactionSummary() {
    const active = this.getActiveTransactions()
    const history = this.getTransactionHistory()
    
    const stats = {
      active: active.length,
      total: history.length,
      confirmed: history.filter(tx => tx.status === this.TransactionStatus.CONFIRMED).length,
      failed: history.filter(tx => tx.status === this.TransactionStatus.FAILED).length,
      pending: active.filter(tx => 
        tx.status === this.TransactionStatus.SUBMITTED || 
        tx.status === this.TransactionStatus.CONFIRMING
      ).length,
    }

    return {
      stats,
      activeTransactions: active,
      recentHistory: history.slice(0, 10),
    }
  }

  // Batch transaction status check
  async checkAllTransactionStatuses() {
    const active = this.getActiveTransactions()
    const updates = []

    for (const tx of active) {
      try {
        const receipt = await this.provider.getTransactionReceipt(tx.hash)
        if (receipt && receipt.status !== undefined) {
          const status = receipt.status === 1 ? 
            this.TransactionStatus.CONFIRMED : 
            this.TransactionStatus.FAILED

          this.updateTransactionStatus(tx.hash, status, { receipt })
          updates.push({ hash: tx.hash, status, receipt })
        }
      } catch (error) {
        console.error(`Error checking transaction ${tx.hash}:`, error)
      }
    }

    return updates
  }

  // Find transactions by CID or operation
  findTransactions(criteria = {}) {
    const allTransactions = [
      ...this.getActiveTransactions(),
      ...this.getTransactionHistory()
    ]

    return allTransactions.filter(tx => {
      if (criteria.cid && tx.metadata.cid !== criteria.cid) return false
      if (criteria.operation && tx.metadata.operation !== criteria.operation) return false
      if (criteria.status && tx.status !== criteria.status) return false
      if (criteria.account && tx.metadata.account !== criteria.account) return false
      return true
    })
  }

  // Get transaction metrics for monitoring
  getTransactionMetrics() {
    const history = this.getTransactionHistory(50) // Last 50 transactions
    
    if (history.length === 0) {
      return {
        averageConfirmationTime: 0,
        successRate: 0,
        totalTransactions: 0,
        averageGasUsed: 0,
      }
    }

    const confirmed = history.filter(tx => tx.status === this.TransactionStatus.CONFIRMED)
    const failed = history.filter(tx => tx.status === this.TransactionStatus.FAILED)
    
    const averageConfirmationTime = confirmed.length > 0 ? 
      confirmed.reduce((sum, tx) => sum + (tx.confirmedAt - tx.submittedAt), 0) / confirmed.length : 0

    const averageGasUsed = confirmed.length > 0 ?
      confirmed.reduce((sum, tx) => sum + (parseInt(tx.gasUsed) || 0), 0) / confirmed.length : 0

    return {
      averageConfirmationTime: Math.round(averageConfirmationTime / 1000), // Convert to seconds
      successRate: history.length > 0 ? (confirmed.length / history.length) * 100 : 0,
      totalTransactions: history.length,
      confirmedTransactions: confirmed.length,
      failedTransactions: failed.length,
      averageGasUsed: Math.round(averageGasUsed),
    }
  }
}

// Export singleton instance
const blockchainService = new BlockchainService()
export default blockchainService 