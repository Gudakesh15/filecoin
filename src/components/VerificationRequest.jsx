import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import blockchainService from '../utils/blockchainService'
import './VerificationRequest.css'

const VerificationRequest = ({ cid, onVerificationComplete, onClose }) => {
  const [verifierName, setVerifierName] = useState('')
  const [verificationType, setVerificationType] = useState('self') // 'self' or 'third-party'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [transactionHash, setTransactionHash] = useState('')
  const [status, setStatus] = useState('idle') // 'idle', 'submitting', 'submitted', 'confirmed', 'failed'

  const { address, isConnected } = useAccount()

  // Clear state when CID changes
  useEffect(() => {
    setVerifierName('')
    setError('')
    setTransactionHash('')
    setStatus('idle')
  }, [cid])

  const handleVerification = async () => {
    if (!isConnected) {
      setError('Please connect your wallet to proceed with verification')
      return
    }

    if (!verifierName.trim()) {
      setError('Please enter a verifier name')
      return
    }

    if (!cid) {
      setError('No document CID provided')
      return
    }

    setLoading(true)
    setError('')
    setStatus('submitting')

    try {
      let result

      if (verificationType === 'self') {
        console.log('🔐 Starting self-verification for CID:', cid)
        result = await blockchainService.selfVerifyDocument(cid, verifierName.trim())
      } else {
        console.log('🔐 Starting third-party verification for CID:', cid)
        result = await blockchainService.verifyDocument(cid, verifierName.trim())
      }

      setTransactionHash(result.transactionHash)
      setStatus('submitted')

      console.log('✅ Verification transaction submitted:', result.transactionHash)

      // Wait for transaction confirmation
      try {
        await blockchainService.waitForTransaction(result.transactionHash, 1)
        setStatus('confirmed')
        
        // Store verification record in localStorage
        const verificationRecord = {
          cid,
          verifierName: verifierName.trim(),
          verifierAddress: address,
          transactionHash: result.transactionHash,
          verificationType,
          timestamp: Date.now(),
          status: 'confirmed'
        }

        const storedVerifications = JSON.parse(localStorage.getItem('proofvault_verifications') || '[]')
        storedVerifications.push(verificationRecord)
        localStorage.setItem('proofvault_verifications', JSON.stringify(storedVerifications))

        // Notify parent component
        if (onVerificationComplete) {
          onVerificationComplete(verificationRecord)
        }

        console.log('🎉 Verification confirmed and stored!')
      } catch (confirmError) {
        console.error('❌ Transaction confirmation failed:', confirmError)
        setError('Transaction submitted but confirmation failed. Please check the transaction hash.')
        setStatus('failed')
      }
    } catch (error) {
      console.error('❌ Verification failed:', error)
      setError(error.message || 'Verification failed. Please try again.')
      setStatus('failed')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'submitting':
        return '⏳'
      case 'submitted':
        return '📤'
      case 'confirmed':
        return '✅'
      case 'failed':
        return '❌'
      default:
        return '🔐'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'submitting':
        return 'Submitting verification...'
      case 'submitted':
        return 'Transaction submitted, waiting for confirmation...'
      case 'confirmed':
        return 'Verification confirmed!'
      case 'failed':
        return 'Verification failed'
      default:
        return 'Ready to verify'
    }
  }

  const copyTransactionHash = () => {
    navigator.clipboard.writeText(transactionHash)
    // You could add a toast notification here
  }

  return (
    <div className="verification-request">
      <div className="verification-header">
        <h3>{getStatusIcon()} Document Verification</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      <div className="verification-content">
        <div className="document-info">
          <label>Document CID:</label>
          <code className="cid-display">{cid}</code>
        </div>

        <div className="verification-form">
          <div className="form-group">
            <label htmlFor="verification-type">Verification Type:</label>
            <select
              id="verification-type"
              value={verificationType}
              onChange={(e) => setVerificationType(e.target.value)}
              disabled={loading || status === 'confirmed'}
            >
              <option value="self">Self-Verification</option>
              <option value="third-party">Third-Party Verification</option>
            </select>
            <small className="help-text">
              {verificationType === 'self' 
                ? 'Verify your own document as the owner'
                : 'Act as a third-party verifier (requires authorization)'
              }
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="verifier-name">Verifier Name:</label>
            <input
              id="verifier-name"
              type="text"
              value={verifierName}
              onChange={(e) => setVerifierName(e.target.value)}
              placeholder="e.g., John Doe, Acme Corp, etc."
              disabled={loading || status === 'confirmed'}
              maxLength={100}
            />
            <small className="help-text">
              Enter the name that will be recorded on-chain for this verification
            </small>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="status-display">
            <span className="status-text">{getStatusText()}</span>
          </div>

          {transactionHash && (
            <div className="transaction-info">
              <label>Transaction Hash:</label>
              <div className="transaction-hash">
                <code>{transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}</code>
                <button
                  className="copy-btn"
                  onClick={copyTransactionHash}
                  title="Copy transaction hash"
                >
                  📋
                </button>
                <a
                  href={`https://calibration.filfox.info/tx/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="explorer-link"
                  title="View on Filfox Explorer"
                >
                  🔍
                </a>
              </div>
            </div>
          )}

          <div className="verification-actions">
            <button
              className="verify-btn"
              onClick={handleVerification}
              disabled={loading || !verifierName.trim() || status === 'confirmed'}
            >
              {loading ? '⏳ Processing...' : status === 'confirmed' ? '✅ Verified' : '🔐 Submit Verification'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerificationRequest 