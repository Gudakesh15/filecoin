import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAccount, useWalletClient } from 'wagmi'
import { ethers } from 'ethers'
import CIDDisplay from './CIDDisplay'
import BlockchainService from '../utils/blockchainService'
import { RetryManager } from '../utils/retryUtils'
import { CONTRACT_ADDRESSES, PROOF_VAULT_ABI } from '../config/web3'
import './FileUpload.css'
import './CIDDisplay.css'

const FileUpload = ({ onUploadSuccess, onUploadError, walletConnection }) => {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [tag, setTag] = useState('')
  const [uploadData, setUploadData] = useState(null)
  const [showCIDDisplay, setShowCIDDisplay] = useState(false)
  
  // Wagmi hooks for direct blockchain interaction
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  
  // Blockchain integration state
  const [blockchainStep, setBlockchainStep] = useState('')
  const [transactionHash, setTransactionHash] = useState('')
  const [transactionStatus, setTransactionStatus] = useState('')
  const [confirmations, setConfirmations] = useState(0)
  const [targetConfirmations] = useState(1)
  const [error, setError] = useState('')
  const [retryAttempt, setRetryAttempt] = useState(0)

  // Pinata configuration
  const PINATA_JWT = import.meta.env.VITE_PINATA_JWT
  const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || 'gateway.pinata.cloud'

  // Get blockchain service instance
  const blockchainService = BlockchainService

  const uploadToPinata = async (file) => {
    if (!PINATA_JWT) {
      throw new Error('Pinata JWT token not configured. Please add VITE_PINATA_JWT to your .env file.')
    }

    const formData = new FormData()
    formData.append('file', file)

    // Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        tag: tag || 'document',
        project: 'ProofVault',
        uploadDate: new Date().toISOString(),
        originalName: file.name,
        size: file.size.toString()
      }
    })
    formData.append('pinataMetadata', metadata)

    // Add options for file organization
    const options = JSON.stringify({
      cidVersion: 1,
      customPinPolicy: {
        regions: [
          {
            id: 'FRA1',
            desiredReplicationCount: 2
          },
          {
            id: 'NYC1',
            desiredReplicationCount: 2
          }
        ]
      }
    })
    formData.append('pinataOptions', options)

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.details || `Upload failed with status ${response.status}`)
    }

    const result = await response.json()
    
    // Return structured upload data
    return {
      cid: result.IpfsHash,
      filename: file.name,
      size: file.size,
      tag: tag || 'document',
      timestamp: new Date().toISOString(),
      pinataResponse: result
    }
  }

  const registerOnBlockchain = async (cid, tag) => {
    // Add timeout to prevent hanging (reduced to 15 seconds for testing)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Blockchain registration timed out after 15 seconds')), 15000)
    })
    
    const registrationPromise = async () => {
      try {
        setBlockchainStep('Preparing blockchain registration...')
        
        // Check wallet connection using Wagmi
        if (!isConnected || !address || !walletClient) {
          throw new Error('Wallet not connected. Please connect your wallet to register on blockchain.')
        }

      setBlockchainStep('Setting up blockchain connection...')
      setProgress(20)
      
      console.log('🔧 Setting up provider and signer...')
      // Create ethers provider from walletClient
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      
      setBlockchainStep('Verifying wallet connection...')
      setProgress(30)
      console.log('📋 Getting signer address...')
      const signerAddress = await signer.getAddress()
      console.log('📋 Signer address:', signerAddress)
      
      console.log('🌐 Getting network info...')
      const network = await provider.getNetwork()
      console.log('🌐 Network:', network)
      
      setBlockchainStep('Preparing smart contract...')
      setProgress(40)
      // Create contract instance
      console.log('📄 Creating contract instance with address:', CONTRACT_ADDRESSES.PROOF_VAULT)
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.PROOF_VAULT,
        PROOF_VAULT_ABI,
        signer
      )
      
      console.log('✅ Contract instance created successfully')

      setBlockchainStep('Sending transaction to blockchain...')
      setProgress(50)
      
      console.log('🚀 About to send transaction with CID:', cid, 'and tag:', tag)
      console.log('🚀 Contract method to call: registerDocument')
      
      // Send transaction with automatic gas estimation (let MetaMask handle it)
      console.log('⏳ Calling contract.registerDocument...')
      const tx = await contract.registerDocument(cid, tag)
      console.log('✅ Transaction sent! Hash:', tx.hash)
      
      setTransactionHash(tx.hash)
      setTransactionStatus('submitted')
      setBlockchainStep(`Transaction submitted: ${tx.hash.slice(0, 10)}...`)
      setProgress(70)
      
      setBlockchainStep('Waiting for blockchain confirmation...')
      setProgress(80)
      
      // Wait for confirmation
      const receipt = await tx.wait(targetConfirmations)
      
      setConfirmations(targetConfirmations)
      setTransactionStatus('confirmed')
      setBlockchainStep('✅ Document registered on Filecoin blockchain!')
      setProgress(100)

      return {
        transactionHash: tx.hash,
        receipt,
        confirmed: true,
        gasUsed: receipt.gasUsed?.toString(),
        blockNumber: receipt.blockNumber
      }

      } catch (error) {
        console.error('Blockchain registration failed:', error)
        setTransactionStatus('failed')
        setError(error.message)
        
        // Check if error is retryable
        const isRetryable = error.code !== 4001 && // User rejected transaction
                           error.code !== -32603 && // Internal error (usually permanent)
                           !error.message.includes('insufficient funds')
        
        if (isRetryable) {
          setBlockchainStep(`❌ Registration failed (retryable): ${error.message}`)
          error.isRetryable = true
        } else {
          setBlockchainStep(`❌ Registration failed: ${error.message}`)
          error.isRetryable = false
        }
        
        throw error
      }
    }
    
    // Race between registration and timeout
    return Promise.race([registrationPromise(), timeoutPromise])
  }

  const handleRetryBlockchain = async () => {
    if (!uploadData) return

    try {
      setRetryAttempt(prev => prev + 1)
      setError('')
      setTransactionStatus('')
      setBlockchainStep('Retrying blockchain registration...')
      
      // Re-check wallet connection before retry using Wagmi
      if (!isConnected || !address || !walletClient) {
        setError('Wallet not connected. Please connect your wallet first.')
        return
      }
      
      const result = await registerOnBlockchain(uploadData.cid, uploadData.tag)
      
      // Update the upload data with successful blockchain result
      setUploadData(prev => ({
        ...prev,
        blockchain: result,
        transactionHash: result?.transactionHash,
        confirmed: !!result?.confirmed,
        blockchainError: null,
        blockchainRetryable: false
      }))
      
    } catch (error) {
      console.error('Retry failed:', error)
      setError(error.message)
    }
  }

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    
    // Validate file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      const error = 'File size exceeds 100MB limit'
      if (onUploadError) onUploadError(error)
      setError(error)
      return
    }

    try {
      setUploading(true)
      setProgress(0)
      setError('')
      setRetryAttempt(0)
      setTransactionHash('')
      setTransactionStatus('')
      setConfirmations(0)

      // Phase 1: Upload to Pinata (0-100% of this phase)
      setCurrentStep('📤 Uploading to IPFS via Pinata...')
      
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 300)

      const pinataResult = await uploadToPinata(file)
      
      clearInterval(progressInterval)
      setProgress(100)
      setCurrentStep('✅ IPFS Upload Complete!')

      // Show success for a moment
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Phase 2: Blockchain Registration (separate process)
      setProgress(0) // Reset progress for blockchain phase
      setCurrentStep('⛓️ Starting blockchain registration...')
      setBlockchainStep('Preparing to register document on Filecoin blockchain...')

      let blockchainResult = null
      
            console.log('🔍 Checking wallet connection for blockchain registration...')
      console.log('🔍 isConnected:', isConnected)
      console.log('🔍 address:', address)
      console.log('🔍 walletClient:', walletClient)
      
      if (isConnected && address && walletClient) {
        console.log('✅ Wallet checks passed, starting blockchain registration...')
        try {
          setProgress(10) // Start blockchain progress
          console.log('🚀 Calling registerOnBlockchain with CID:', pinataResult.cid, 'tag:', pinataResult.tag)
          blockchainResult = await registerOnBlockchain(pinataResult.cid, pinataResult.tag)
          setProgress(100) // Blockchain complete
          setCurrentStep('🎉 Document fully registered!')
          
        } catch (blockchainError) {
            // IPFS succeeded but blockchain failed - this is OK!
            console.error('Blockchain registration failed:', blockchainError)
            setProgress(0) // Reset blockchain progress to show it failed
            setCurrentStep('✅ IPFS Upload Successful')
            setBlockchainStep(`❌ Blockchain registration failed: ${blockchainError.message}`)
            
            // Still show CID display with IPFS success but blockchain error
            const result = {
              ...pinataResult,
              blockchainError: blockchainError.message,
              blockchainRetryable: blockchainError.isRetryable
            }
            
            setUploadData(result)
            setShowCIDDisplay(true)

            if (onUploadSuccess) {
              onUploadSuccess(result)
            }

            setTag('')
            return // Exit early but still show results
          }
      } else {
        // Wallet not connected - skip blockchain registration
        console.log('❌ Wallet connection check failed, skipping blockchain registration')
        console.log('❌ Missing:', {
          isConnected: !isConnected,
          address: !address,
          walletClient: !walletClient
        })
        setCurrentStep('⚠️ Wallet not connected - skipping blockchain registration')
        setProgress(75)
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      // Complete success
      setProgress(100)
      setCurrentStep('🎉 Document upload and registration complete!')

      // Store complete upload data
      const completeResult = {
        ...pinataResult,
        blockchain: blockchainResult,
        transactionHash: blockchainResult?.transactionHash,
        confirmed: !!blockchainResult?.confirmed
      }

      setUploadData(completeResult)
      setShowCIDDisplay(true)

      // Call success callback
      if (onUploadSuccess) {
        onUploadSuccess(completeResult)
      }

      // Reset form
      setTag('')

    } catch (error) {
      console.error('Upload process failed:', error)
      setError(error.message)
      setCurrentStep(`❌ ${error.message}`)
      if (onUploadError) onUploadError(error.message)
    } finally {
      setUploading(false)
      // Keep progress and status for user reference
      setTimeout(() => {
        if (!showCIDDisplay) {
          setProgress(0)
          setCurrentStep('')
          setBlockchainStep('')
          setError('')
        }
      }, 3000)
    }
  }, [tag, onUploadSuccess, onUploadError, PINATA_JWT, walletConnection])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploading,
    multiple: false,
    maxSize: 100 * 1024 * 1024 // 100MB
  })

  const handleCloseCIDDisplay = () => {
    setShowCIDDisplay(false)
    setUploadData(null)
    setProgress(0)
    setCurrentStep('')
    setBlockchainStep('')
    setError('')
    setTransactionHash('')
    setTransactionStatus('')
    setConfirmations(0)
  }

  const getProgressColor = () => {
    if (error) return '#ff4757'
    if (transactionStatus === 'failed') return '#ff6b6b'
    if (progress === 100) return '#2ed573'
    return '#3742fa'
  }

  const getStepIcon = () => {
    if (error) return '❌'
    if (progress === 100 && !error) return '🎉'
    if (blockchainStep && progress > 50) return '⛓️'
    if (progress > 0) return '☁️'
    return '📁'
  }

  return (
    <>
      <div className="file-upload-container">
        <div className="upload-form">
          <div className="tag-input-container">
            <label htmlFor="documentTag">Document Tag (optional):</label>
            <input
              id="documentTag"
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g., contract, identity, certificate"
              disabled={uploading}
              className="tag-input"
            />
          </div>

          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'active' : ''} ${uploading ? 'uploading' : ''} ${error ? 'error' : ''}`}
          >
            <input {...getInputProps()} />
            
            {uploading ? (
              <div className="upload-progress">
                <div className="progress-circle">
                  <svg className="progress-ring" width="120" height="120">
                    <circle
                      className="progress-ring-circle"
                      stroke={getProgressColor()}
                      strokeWidth="4"
                      fill="transparent"
                      r="52"
                      cx="60"
                      cy="60"
                      style={{
                        strokeDasharray: `${2 * Math.PI * 52}`,
                        strokeDashoffset: `${2 * Math.PI * 52 * (1 - progress / 100)}`,
                      }}
                    />
                  </svg>
                  <span className="progress-text" style={{ color: getProgressColor() }}>
                    {progress}%
                  </span>
                </div>
                
                <div className="upload-status">
                  <p className="current-step">
                    <span className="step-icon">{getStepIcon()}</span>
                    {currentStep}
                  </p>
                  
                  {blockchainStep && (
                    <p className="blockchain-step">
                      <span className="step-icon">⛓️</span>
                      {blockchainStep}
                    </p>
                  )}
                  
                  {transactionHash && (
                    <div className="transaction-info">
                      <p className="transaction-hash">
                        📄 TX: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                      </p>
                      {confirmations > 0 && (
                        <p className="confirmations">
                          ✅ Confirmations: {confirmations}/{targetConfirmations}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {error && (
                    <div className="error-section">
                      <p className="error-message">❌ {error}</p>
                      {uploadData?.blockchainRetryable && (
                        <button 
                          onClick={handleRetryBlockchain}
                          className="retry-button"
                          disabled={uploading}
                        >
                          🔄 Retry Blockchain Registration
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : isDragActive ? (
              <div className="drag-active">
                <div className="upload-icon">📁</div>
                <p>Drop your file here</p>
              </div>
            ) : (
              <div className="upload-prompt">
                <div className="upload-icon">📤</div>
                <h3>Upload Document to ProofVault</h3>
                <p><strong>Step 1:</strong> File uploaded to IPFS (always succeeds)</p>
                <p><strong>Step 2:</strong> Document registered on Filecoin (requires wallet)</p>
                <p className="file-info">Maximum file size: 100MB</p>
                
                {!walletConnection?.isConnected && (
                  <div className="wallet-warning">
                    ⚠️ Connect wallet for Step 2 (blockchain registration)
                    <br />
                    <small>Files will still be stored on IPFS without wallet</small>
                  </div>
                )}
                
                {!PINATA_JWT && (
                  <div className="config-warning">
                    ⚠️ Pinata JWT not configured. Please add VITE_PINATA_JWT to your .env file.
                  </div>
                )}

                <div className="process-flow">
                  <div className="flow-step">
                    <span className="flow-icon">📤</span>
                    <span>IPFS Storage</span>
                    <small>(Always Works)</small>
                  </div>
                  <span className="flow-arrow">→</span>
                  <div className="flow-step">
                    <span className="flow-icon">⛓️</span>
                    <span>Blockchain Proof</span>
                    <small>(Needs Wallet)</small>
                  </div>
                  <span className="flow-arrow">→</span>
                  <div className="flow-step">
                    <span className="flow-icon">🛡️</span>
                    <span>Full Security</span>
                    <small>(Both Complete)</small>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CID Display Modal */}
      {showCIDDisplay && uploadData && (
        <CIDDisplay 
          uploadData={uploadData}
          onClose={handleCloseCIDDisplay}
          onRetryBlockchain={uploadData?.blockchainRetryable ? handleRetryBlockchain : null}
        />
      )}
    </>
  )
}

export default FileUpload 