import React, { useState, useEffect } from 'react'
import { useAccount, useReadContract, usePublicClient } from 'wagmi'
import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES, PROOF_VAULT_ABI } from '../config/web3'
import VerificationRequest from './VerificationRequest'
import './DocumentVault.css'

const DocumentVault = () => {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedDoc, setExpandedDoc] = useState(null)
  const [documentDetails, setDocumentDetails] = useState({})
  const [verifyingDoc, setVerifyingDoc] = useState(null) // CID of document being verified

  const { address, isConnected } = useAccount()

  const publicClient = usePublicClient()

  // Get user document count using Wagmi
  const { data: documentCount, isError: countError, isLoading: countLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.PROOF_VAULT,
    abi: PROOF_VAULT_ABI,
    functionName: 'getUserDocumentCount',
    args: [address],
    enabled: Boolean(isConnected && address),
  })

  // Fetch user's documents from blockchain
  const fetchUserDocuments = async () => {
    if (!isConnected || !address) {
      setDocuments([])
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('🔍 Fetching documents for address:', address)
      console.log('📊 Document count:', documentCount?.toString())
      
      if (!documentCount || documentCount.toString() === '0') {
        setDocuments([])
        setLoading(false)
        return
      }

      const count = parseInt(documentCount.toString())
      const cids = []

      // Get each document CID
      for (let i = 0; i < count; i++) {
        try {
          const cid = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.PROOF_VAULT,
            abi: PROOF_VAULT_ABI,
            functionName: 'getDocument',
            args: [address, i]
          })
          
          if (cid) {
            cids.push(cid)
          }
        } catch (error) {
          console.error(`Failed to get document ${i}:`, error)
        }
      }

      console.log('📄 Found CIDs:', cids)

      // Get metadata for each document
      const documentsWithMetadata = await Promise.all(
        cids.map(async (cid) => {
          try {
            // Get metadata and verification status
            const [metadata, isVerified] = await Promise.all([
              publicClient.readContract({
                address: CONTRACT_ADDRESSES.PROOF_VAULT,
                abi: PROOF_VAULT_ABI,
                functionName: 'getDocumentMetadata',
                args: [cid]
              }),
              publicClient.readContract({
                address: CONTRACT_ADDRESSES.PROOF_VAULT,
                abi: PROOF_VAULT_ABI,
                functionName: 'isDocumentVerified',
                args: [cid]
              })
            ])
            
            return {
              cid,
              owner: metadata[0],
              tag: metadata[1], 
              timestamp: parseInt(metadata[2].toString()) * 1000, // Convert to milliseconds
              exists: metadata[3],
              isVerified: isVerified || false
            }
          } catch (error) {
            console.error(`Failed to get metadata for CID ${cid}:`, error)
            return {
              cid,
              owner: address,
              tag: 'Unknown',
              timestamp: Date.now(),
              isVerified: false,
              error: true
            }
          }
        })
      )

      // Sort by timestamp (newest first)
      documentsWithMetadata.sort((a, b) => b.timestamp - a.timestamp)
      
      setDocuments(documentsWithMetadata)
    } catch (error) {
      console.error('Failed to fetch user documents:', error)
      setError(`Failed to load documents: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Fetch transaction details for expanded view
  const fetchTransactionDetails = async (cid) => {
    try {
      console.log('🔍 Fetching transaction details for CID:', cid)
      
      // 💾 FIRST CHECK STORED TRANSACTION RECORDS - More reliable!
      const storedRecords = JSON.parse(localStorage.getItem('proofvault_transactions') || '[]')
      const storedRecord = storedRecords.find(r => r.cid === cid)
      
      if (storedRecord) {
        console.log('✅ Found stored transaction record:', storedRecord)
        return {
          transactionHash: storedRecord.transactionHash,
          blockNumber: 'Confirmed',
          status: storedRecord.status,
          timestamp: storedRecord.timestamp,
          eventData: {
            cid: storedRecord.cid,
            tag: storedRecord.tag,
            user: storedRecord.address
          }
        }
      }
      
      if (!publicClient || !address) {
        console.warn('PublicClient or address not available')
        return {
          transactionHash: 'Wallet not connected',
          blockNumber: 'Wallet not connected',
          eventData: null
        }
      }

      // 🔄 FALLBACK: Try to get from event logs (backup method)
      console.log('🔄 No stored record found, attempting event log retrieval...')
      
      // Try multiple approaches to get event logs
      let logs = []
      
      try {
        // First try: Get all DocumentRegistered events for this contract
        logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESSES.PROOF_VAULT,
          event: {
            type: 'event',
            name: 'DocumentRegistered',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'cid', type: 'string', indexed: false },
              { name: 'tag', type: 'string', indexed: false },
              { name: 'timestamp', type: 'uint256', indexed: false }
            ]
          },
          fromBlock: 0n,
          toBlock: 'latest'
        })
      } catch (rpcError) {
        console.warn('Primary RPC request failed, trying limited range:', rpcError)
        
        try {
          // Fallback: Try with a smaller block range (last 10000 blocks)
          const latestBlock = await publicClient.getBlockNumber()
          const fromBlock = latestBlock > 10000n ? latestBlock - 10000n : 0n
          
          logs = await publicClient.getLogs({
            address: CONTRACT_ADDRESSES.PROOF_VAULT,
            event: {
              type: 'event',
              name: 'DocumentRegistered',
              inputs: [
                { name: 'user', type: 'address', indexed: true },
                { name: 'cid', type: 'string', indexed: false },
                { name: 'tag', type: 'string', indexed: false },
                { name: 'timestamp', type: 'uint256', indexed: false }
              ]
            },
            fromBlock,
            toBlock: 'latest'
          })
        } catch (fallbackError) {
          console.error('Both primary and fallback RPC requests failed:', fallbackError)
          return {
            transactionHash: 'Error loading - events unavailable',
            blockNumber: 'Error loading',
            eventData: null
          }
        }
      }
      
      console.log('📋 Found total logs:', logs.length)
      
      // Find the log for this specific CID and user
      for (const log of logs) {
        try {
          const decodedLog = {
            args: {
              user: `0x${log.topics[1].slice(26)}`, // Extract address from indexed topic
              cid: '', // Will be decoded from data
              tag: '', // Will be decoded from data  
              timestamp: 0n // Will be decoded from data
            }
          }
          
          // Decode the non-indexed data (cid, tag, timestamp)
          try {
            const decoded = publicClient.decodeEventLog({
              abi: PROOF_VAULT_ABI,
              data: log.data,
              topics: log.topics,
            })
            decodedLog.args = decoded.args
          } catch (decodeError) {
            console.warn('Failed to decode log data, trying manual decode:', decodeError)
            // Skip this log if we can't decode it
            continue
          }
          
          console.log('🔍 Checking log - User:', decodedLog.args.user, 'CID:', decodedLog.args.cid)
          
          // Check if this log matches our criteria (same user and CID)
          if (decodedLog.args.user.toLowerCase() === address.toLowerCase() && 
              decodedLog.args.cid === cid) {
            console.log('✅ Found matching event data:', decodedLog)
            return {
              transactionHash: log.transactionHash,
              blockNumber: log.blockNumber?.toString(),
              eventData: {
                user: decodedLog.args.user,
                cid: decodedLog.args.cid,
                tag: decodedLog.args.tag,
                timestamp: decodedLog.args.timestamp?.toString(),
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber?.toString(),
                rawData: log.data,
                topics: log.topics
              }
            }
          }
        } catch (decodeError) {
          console.warn('Failed to process log:', decodeError)
          continue
        }
      }
      
      console.warn('No matching transaction found for CID:', cid)
      return {
        transactionHash: 'Not found on chain',
        blockNumber: 'Not found on chain',
        eventData: null
      }
    } catch (error) {
      console.error('Failed to fetch transaction details:', error)
      return {
        transactionHash: `Error: ${error.message}`,
        blockNumber: `Error: ${error.message}`,
        eventData: null
      }
    }
  }

  // Handle expanding document details
  const handleExpandDocument = async (cid) => {
    if (expandedDoc === cid) {
      setExpandedDoc(null)
      return
    }

    setExpandedDoc(cid)
    
    // Fetch transaction details if not already loaded
    if (!documentDetails[cid]) {
      const details = await fetchTransactionDetails(cid)
      setDocumentDetails(prev => ({
        ...prev,
        [cid]: details
      }))
    }
  }

  // Copy to clipboard
  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add a toast notification here
      console.log(`${label} copied to clipboard`)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  // Format functions
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const truncateCID = (cid, start = 12, end = 12) => {
    if (cid.length <= start + end) return cid
    return `${cid.slice(0, start)}...${cid.slice(-end)}`
  }

  const truncateAddress = (address, start = 6, end = 4) => {
    if (!address || address.length <= start + end) return address
    return `${address.slice(0, start)}...${address.slice(-end)}`
  }

  // Handle verification completion
  const handleVerificationComplete = (verificationRecord) => {
    console.log('🎉 Verification completed:', verificationRecord)
    
    // Update the document verification status
    setDocuments(prevDocs => 
      prevDocs.map(doc => 
        doc.cid === verificationRecord.cid 
          ? { ...doc, isVerified: true }
          : doc
      )
    )
    
    // Close verification modal
    setVerifyingDoc(null)
    
    // Refresh document list to get latest verification status
    setTimeout(() => {
      fetchUserDocuments()
    }, 2000)
  }

  // Effect to fetch documents when wallet connection changes or document count updates
  useEffect(() => {
    fetchUserDocuments()
  }, [address, isConnected, documentCount])

  if (!isConnected) {
    return (
      <div className="document-vault">
        <div className="vault-header">
          <h2>📁 My Documents</h2>
          <p>Connect your wallet to view your registered documents</p>
        </div>
        <div className="connect-prompt">
          <div className="connect-icon">🔌</div>
          <p>Please connect your wallet to access your document vault</p>
        </div>
      </div>
    )
  }

  return (
    <div className="document-vault">
      <div className="vault-header">
        <h2>📁 My Documents</h2>
        <p>Documents registered on Filecoin blockchain from this wallet</p>
        <button 
          onClick={fetchUserDocuments}
          disabled={loading}
          className="refresh-button"
        >
          {loading ? '🔄 Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {loading && !documents.length && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your documents from blockchain...</p>
        </div>
      )}

      {!loading && documents.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No documents found</h3>
          <p>You haven't registered any documents yet.</p>
          <p>Upload a document to get started!</p>
        </div>
      )}

      {documents.length > 0 && (
        <div className="documents-grid">
          {documents.map((doc) => (
            <div key={doc.cid} className="document-card">
              {/* Document Header */}
              <div className="document-header">
                <div className="document-info">
                  <h3>📄 Document</h3>
                  <span className={`tag ${doc.tag.toLowerCase()}`}>
                    {doc.tag}
                  </span>
                </div>
                <div className="verification-status">
                  {doc.isVerified ? (
                    <span className="status verified">✅ Verified</span>
                  ) : (
                    <span className="status pending">⏳ Unverified</span>
                  )}
                </div>
              </div>

              {/* Document Content */}
              <div className="document-content">
                <div className="document-detail">
                  <span className="detail-label">CID:</span>
                  <code className="cid-display" title={doc.cid}>
                    {truncateCID(doc.cid)}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(doc.cid, 'CID')}
                    className="copy-btn"
                    title="Copy CID"
                  >
                    📋
                  </button>
                </div>

                <div className="document-detail">
                  <span className="detail-label">Registered:</span>
                  <span>{formatDate(doc.timestamp)}</span>
                </div>

                <div className="document-detail">
                  <span className="detail-label">Owner:</span>
                  <code title={doc.owner}>
                    {truncateAddress(doc.owner)}
                  </code>
                </div>
              </div>

              {/* Document Actions */}
              <div className="document-actions">
                <a 
                  href={`https://${import.meta.env.VITE_PINATA_GATEWAY || 'gateway.pinata.cloud'}/ipfs/${doc.cid}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="action-btn view-btn"
                >
                  🔗 View on IPFS
                </a>
                
                <button 
                  onClick={() => handleExpandDocument(doc.cid)}
                  className="action-btn details-btn"
                >
                  {expandedDoc === doc.cid ? '▲ Hide Details' : '▼ Blockchain Details'}
                </button>

                {!doc.isVerified && (
                  <button 
                    onClick={() => setVerifyingDoc(doc.cid)}
                    className="action-btn verify-btn"
                    title="Request document verification"
                  >
                    🔐 Request Verification
                  </button>
                )}
              </div>

              {/* Expandable Blockchain Details */}
              {expandedDoc === doc.cid && (
                <div className="blockchain-details">
                  <div className="details-header">
                    <h4>🔗 Blockchain Transaction Details</h4>
                  </div>

                  {documentDetails[doc.cid] ? (
                    <div className="details-content">
                      <div className="detail-section">
                        <h5>📋 Transaction Information</h5>
                        <div className="detail-item">
                          <span className="detail-label">Transaction Hash:</span>
                          {documentDetails[doc.cid].transactionHash && 
                           !documentDetails[doc.cid].transactionHash.includes('Error') &&
                           !documentDetails[doc.cid].transactionHash.includes('Wallet not connected') ? (
                            <>
                              <code className="detail-value">
                                {truncateAddress(documentDetails[doc.cid].transactionHash, 10, 8)}
                              </code>
                              <button 
                                onClick={() => copyToClipboard(documentDetails[doc.cid].transactionHash, 'Transaction Hash')}
                                className="copy-btn"
                                title="Copy full transaction hash"
                              >
                                📋
                              </button>
                            </>
                          ) : (
                            <span className="detail-value error-text">
                              {documentDetails[doc.cid].transactionHash || 'Not available'}
                            </span>
                          )}
                        </div>
                        
                        {documentDetails[doc.cid].blockNumber && 
                         !documentDetails[doc.cid].blockNumber.includes('Error') && (
                          <div className="detail-item">
                            <span className="detail-label">Block Number:</span>
                            <span className="detail-value">{documentDetails[doc.cid].blockNumber}</span>
                            <small className="detail-note">📚 Blockchain location</small>
                          </div>
                        )}

                        <div className="detail-item">
                          <span className="detail-label">Block Explorer:</span>
                          <a 
                            href={`https://calibration.filfox.info/en/tx/${documentDetails[doc.cid].transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="explorer-link"
                          >
                            🔍 View on Filfox
                          </a>
                        </div>
                      </div>

                      {documentDetails[doc.cid].eventData && (
                        <div className="detail-section">
                          <h5>📊 Event Data (ABI Decoded)</h5>
                          <div className="detail-item">
                            <span className="detail-label">Event:</span>
                            <span className="detail-value">DocumentRegistered</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">CID:</span>
                            <code className="detail-value">{doc.cid}</code>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Tag:</span>
                            <span className="detail-value">{doc.tag}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Timestamp:</span>
                            <span className="detail-value">{formatDate(doc.timestamp)}</span>
                          </div>
                        </div>
                      )}

                      <div className="detail-section">
                        <h5>🔧 Technical Info</h5>
                        <p className="tech-note">
                          💡 This document's CID and metadata are permanently stored on the Filecoin blockchain. 
                          The transaction above proves ownership and registration time.
                        </p>
                        <p className="tech-note">
                          🔍 The event data is ABI-encoded in the transaction logs. Click "View on Filfox" 
                          to see the raw blockchain data.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="loading-details">
                      <div className="loading-spinner small"></div>
                      <span>Loading blockchain details...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Verification Request Modal */}
      {verifyingDoc && (
        <div className="modal-overlay">
          <div className="modal-content">
            <VerificationRequest
              cid={verifyingDoc}
              onVerificationComplete={handleVerificationComplete}
              onClose={() => setVerifyingDoc(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentVault 