import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import './VerificationQueue.css'

const VerificationQueue = ({ onVerificationSelect, onClose }) => {
  const [pendingVerifications, setPendingVerifications] = useState([])
  const [completedVerifications, setCompletedVerifications] = useState([])
  const [activeTab, setActiveTab] = useState('pending') // 'pending' or 'completed'

  const { address } = useAccount()

  // Load verification records from localStorage
  useEffect(() => {
    loadVerificationHistory()
  }, [address])

  const loadVerificationHistory = () => {
    try {
      // Load verification records
      const storedVerifications = JSON.parse(localStorage.getItem('proofvault_verifications') || '[]')
      
      // Filter by current user
      const userVerifications = storedVerifications.filter(v => 
        v.verifierAddress?.toLowerCase() === address?.toLowerCase()
      )

      // Separate pending and completed
      const pending = userVerifications.filter(v => 
        v.status === 'submitted' || v.status === 'pending'
      )
      const completed = userVerifications.filter(v => 
        v.status === 'confirmed' || v.status === 'failed'
      )

      // Sort by timestamp (newest first)
      pending.sort((a, b) => b.timestamp - a.timestamp)
      completed.sort((a, b) => b.timestamp - a.timestamp)

      setPendingVerifications(pending)
      setCompletedVerifications(completed)
    } catch (error) {
      console.error('Failed to load verification history:', error)
    }
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const truncateCID = (cid, start = 8, end = 8) => {
    if (!cid || cid.length <= start + end) return cid
    return `${cid.slice(0, start)}...${cid.slice(-end)}`
  }

  const truncateHash = (hash, start = 6, end = 6) => {
    if (!hash || hash.length <= start + end) return hash
    return `${hash.slice(0, start)}...${hash.slice(-end)}`
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return '⏳'
      case 'submitted':
        return '📤'
      case 'confirmed':
        return '✅'
      case 'failed':
        return '❌'
      default:
        return '❓'
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending':
        return 'status-pending'
      case 'submitted':
        return 'status-submitted'
      case 'confirmed':
        return 'status-confirmed'
      case 'failed':
        return 'status-failed'
      default:
        return 'status-unknown'
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
  }

  const renderVerification = (verification, index) => (
    <div key={`${verification.cid}-${verification.timestamp}`} className="verification-item">
      <div className="verification-header">
        <div className="verification-info">
          <span className="verification-index">#{index + 1}</span>
          <span className={`verification-status ${getStatusClass(verification.status)}`}>
            {getStatusIcon(verification.status)} {verification.status}
          </span>
        </div>
        <div className="verification-actions">
          {verification.transactionHash && (
            <a
              href={`https://calibration.filfox.info/tx/${verification.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="explorer-link"
              title="View on Filfox Explorer"
            >
              🔍
            </a>
          )}
        </div>
      </div>

      <div className="verification-details">
        <div className="detail-row">
          <span className="detail-label">Document CID:</span>
          <code className="detail-value">{truncateCID(verification.cid)}</code>
          <button
            onClick={() => copyToClipboard(verification.cid)}
            className="copy-btn"
            title="Copy CID"
          >
            📋
          </button>
        </div>

        <div className="detail-row">
          <span className="detail-label">Verifier:</span>
          <span className="detail-value">{verification.verifierName}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Type:</span>
          <span className="detail-value">
            {verification.verificationType === 'self' ? 'Self-Verification' : 'Third-Party'}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-label">Date:</span>
          <span className="detail-value">{formatDate(verification.timestamp)}</span>
        </div>

        {verification.transactionHash && (
          <div className="detail-row">
            <span className="detail-label">Transaction:</span>
            <code className="detail-value">{truncateHash(verification.transactionHash)}</code>
            <button
              onClick={() => copyToClipboard(verification.transactionHash)}
              className="copy-btn"
              title="Copy transaction hash"
            >
              📋
            </button>
          </div>
        )}
      </div>

      {verification.status === 'pending' && onVerificationSelect && (
        <div className="verification-actions-footer">
          <button
            onClick={() => onVerificationSelect(verification.cid)}
            className="action-btn continue-btn"
          >
            Continue Verification
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="verification-queue">
      <div className="queue-header">
        <h3>🔐 Verification Queue</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      <div className="queue-tabs">
        <button
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          ⏳ Pending ({pendingVerifications.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          ✅ Completed ({completedVerifications.length})
        </button>
      </div>

      <div className="queue-content">
        {activeTab === 'pending' && (
          <div className="verification-list">
            {pendingVerifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">⏳</div>
                <h4>No pending verifications</h4>
                <p>All your verification requests have been completed.</p>
              </div>
            ) : (
              pendingVerifications.map((verification, index) => 
                renderVerification(verification, index)
              )
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="verification-list">
            {completedVerifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h4>No completed verifications</h4>
                <p>Your verification history will appear here.</p>
              </div>
            ) : (
              completedVerifications.map((verification, index) => 
                renderVerification(verification, index)
              )
            )}
          </div>
        )}
      </div>

      <div className="queue-footer">
        <button
          onClick={loadVerificationHistory}
          className="refresh-btn"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  )
}

export default VerificationQueue 