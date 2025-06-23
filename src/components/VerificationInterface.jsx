import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { CID } from 'multiformats/cid'
import './VerificationInterface.css'

const VerificationInterface = ({ contract }) => {
  const [verificationMethod, setVerificationMethod] = useState('cid') // 'cid' or 'file'
  const [cidInput, setCidInput] = useState('')
  const [fileToVerify, setFileToVerify] = useState(null)
  const [verificationResult, setVerificationResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Clear previous results and errors
  const clearState = () => {
    setVerificationResult(null)
    setError('')
  }

  // Validate CID format
  const isValidCID = (cidString) => {
    try {
      CID.parse(cidString.trim())
      return true
    } catch {
      return false
    }
  }

  // Calculate SHA-256 hash of file content
  const calculateFileHash = async (file) => {
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    return new Uint8Array(hashBuffer)
  }

  // Extract multihash from CID for comparison
  const extractMultihashFromCID = (cidString) => {
    try {
      const cid = CID.parse(cidString.trim())
      return cid.multihash.digest
    } catch (error) {
      throw new Error('Invalid CID format')
    }
  }

  // Check if document is verified on-chain
  const checkOnChainVerification = async (cidString) => {
    if (!contract) {
      return { isVerified: false, error: 'Smart contract not available' }
    }

    try {
      // Call the smart contract to check if document exists and is verified
      const documentExists = await contract.documents(cidString)
      const isVerified = await contract.isVerified(cidString)
      
      return { 
        isVerified, 
        exists: documentExists.exists,
        owner: documentExists.owner,
        timestamp: documentExists.timestamp.toNumber() 
      }
    } catch (error) {
      console.error('Error checking on-chain verification:', error)
      return { isVerified: false, error: error.message }
    }
  }

  // Verify by CID only
  const verifyByCID = async () => {
    const trimmedCID = cidInput.trim()
    
    if (!trimmedCID) {
      setError('Please enter a CID')
      return
    }

    if (!isValidCID(trimmedCID)) {
      setError('Invalid CID format')
      return
    }

    setLoading(true)
    clearState()

    try {
      // Check on-chain verification status
      const onChainResult = await checkOnChainVerification(trimmedCID)
      
      setVerificationResult({
        type: 'cid-only',
        cid: trimmedCID,
        onChain: onChainResult,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      setError(`Verification failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Verify by file upload and hash comparison
  const verifyByFile = async () => {
    if (!fileToVerify) {
      setError('Please upload a file to verify')
      return
    }

    if (!cidInput.trim()) {
      setError('Please enter the CID to compare against')
      return
    }

    const trimmedCID = cidInput.trim()
    
    if (!isValidCID(trimmedCID)) {
      setError('Invalid CID format')
      return
    }

    setLoading(true)
    clearState()

    try {
      // Calculate file hash
      const fileHash = await calculateFileHash(fileToVerify)
      
      // Extract multihash from CID
      const cidMultihash = extractMultihashFromCID(trimmedCID)
      
      // Compare hashes
      const hashesMatch = areUint8ArraysEqual(fileHash, cidMultihash)
      
      // Check on-chain verification status
      const onChainResult = await checkOnChainVerification(trimmedCID)
      
      setVerificationResult({
        type: 'file-hash',
        cid: trimmedCID,
        fileName: fileToVerify.name,
        fileSize: fileToVerify.size,
        hashMatch: hashesMatch,
        onChain: onChainResult,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      setError(`Verification failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Utility function to compare Uint8Arrays
  const areUint8ArraysEqual = (a, b) => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  // Handle file drop for verification
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFileToVerify(acceptedFiles[0])
      clearState()
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 100 * 1024 * 1024, // 100MB limit
    disabled: loading
  })

  // Handle verification based on selected method
  const handleVerify = () => {
    if (verificationMethod === 'cid') {
      verifyByCID()
    } else {
      verifyByFile()
    }
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Format date
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="verification-interface">
      <div className="verification-header">
        <h2>🔍 Document Verification</h2>
        <p>Verify the authenticity of documents stored in ProofVault</p>
      </div>

      {/* Verification Method Selection */}
      <div className="verification-method-selector">
        <div className="method-tabs">
          <button 
            className={`method-tab ${verificationMethod === 'cid' ? 'active' : ''}`}
            onClick={() => {
              setVerificationMethod('cid')
              clearState()
            }}
          >
            🔗 Verify by CID
          </button>
          <button 
            className={`method-tab ${verificationMethod === 'file' ? 'active' : ''}`}
            onClick={() => {
              setVerificationMethod('file')
              clearState()
            }}
          >
            📄 Verify by File
          </button>
        </div>
      </div>

      {/* CID Input */}
      <div className="cid-input-section">
        <label htmlFor="cidInput">
          {verificationMethod === 'cid' ? 'Document CID:' : 'Expected CID:'}
        </label>
        <div className="cid-input-group">
          <input
            id="cidInput"
            type="text"
            value={cidInput}
            onChange={(e) => {
              setCidInput(e.target.value)
              clearState()
            }}
            placeholder="Enter IPFS CID (e.g., bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi)"
            disabled={loading}
            className="cid-input"
          />
        </div>
      </div>

      {/* File Upload Section (only for file verification) */}
      {verificationMethod === 'file' && (
        <div className="file-upload-section">
          <label>Upload File to Verify:</label>
          <div
            {...getRootProps()}
            className={`verification-dropzone ${isDragActive ? 'active' : ''} ${loading ? 'disabled' : ''}`}
          >
            <input {...getInputProps()} />
            {fileToVerify ? (
              <div className="file-selected">
                <div className="file-info">
                  <span className="file-icon">📄</span>
                  <div className="file-details">
                    <div className="file-name">{fileToVerify.name}</div>
                    <div className="file-size">{formatFileSize(fileToVerify.size)}</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    setFileToVerify(null)
                    clearState()
                  }}
                  className="remove-file-btn"
                  disabled={loading}
                >
                  ✕
                </button>
              </div>
            ) : isDragActive ? (
              <div className="drop-message">
                <span className="drop-icon">📁</span>
                <p>Drop your file here</p>
              </div>
            ) : (
              <div className="upload-prompt">
                <span className="upload-icon">⬆️</span>
                <p>Drag & drop a file here, or click to select</p>
                <small>Maximum file size: 100MB</small>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Verify Button */}
      <div className="verify-action">
        <button 
          onClick={handleVerify}
          disabled={loading || !cidInput.trim() || (verificationMethod === 'file' && !fileToVerify)}
          className="verify-button"
        >
          {loading ? (
            <>
              <span className="loading-spinner"></span>
              Verifying...
            </>
          ) : (
            <>
              🔍 Verify Document
            </>
          )}
        </button>
      </div>

      {/* Verification Results */}
      {verificationResult && (
        <div className="verification-results">
          <div className="results-header">
            <h3>📋 Verification Results</h3>
            <small>Verified on {formatDate(verificationResult.timestamp)}</small>
          </div>

          <div className="results-content">
            {/* CID Information */}
            <div className="result-section">
              <h4>📝 Document Information</h4>
              <div className="result-item">
                <span className="result-label">CID:</span>
                <code className="result-value">{verificationResult.cid}</code>
              </div>
              {verificationResult.fileName && (
                <>
                  <div className="result-item">
                    <span className="result-label">File Name:</span>
                    <span className="result-value">{verificationResult.fileName}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">File Size:</span>
                    <span className="result-value">{formatFileSize(verificationResult.fileSize)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Hash Verification (for file verification) */}
            {verificationResult.type === 'file-hash' && (
              <div className="result-section">
                <h4>🔐 Hash Verification</h4>
                <div className={`verification-status ${verificationResult.hashMatch ? 'success' : 'failure'}`}>
                  <span className="status-icon">
                    {verificationResult.hashMatch ? '✅' : '❌'}
                  </span>
                  <span className="status-text">
                    {verificationResult.hashMatch 
                      ? 'File hash matches CID - Document is authentic' 
                      : 'File hash does not match CID - Document may be modified'
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Blockchain Verification */}
            <div className="result-section">
              <h4>⛓️ Blockchain Verification</h4>
              {verificationResult.onChain.error ? (
                <div className="verification-status warning">
                  <span className="status-icon">⚠️</span>
                  <span className="status-text">
                    Could not check blockchain status: {verificationResult.onChain.error}
                  </span>
                </div>
              ) : (
                <>
                  <div className={`verification-status ${verificationResult.onChain.exists ? 'success' : 'warning'}`}>
                    <span className="status-icon">
                      {verificationResult.onChain.exists ? '✅' : '⚠️'}
                    </span>
                    <span className="status-text">
                      {verificationResult.onChain.exists 
                        ? 'Document is registered on blockchain' 
                        : 'Document is not registered on blockchain'
                      }
                    </span>
                  </div>
                  
                  {verificationResult.onChain.exists && (
                    <>
                      <div className={`verification-status ${verificationResult.onChain.isVerified ? 'success' : 'info'}`}>
                        <span className="status-icon">
                          {verificationResult.onChain.isVerified ? '✅' : 'ℹ️'}
                        </span>
                        <span className="status-text">
                          {verificationResult.onChain.isVerified 
                            ? 'Document has been verified by an authorized verifier' 
                            : 'Document is registered but not yet verified'
                          }
                        </span>
                      </div>
                      
                      <div className="blockchain-details">
                        <div className="result-item">
                          <span className="result-label">Owner:</span>
                          <code className="result-value">{verificationResult.onChain.owner}</code>
                        </div>
                        <div className="result-item">
                          <span className="result-label">Registered:</span>
                          <span className="result-value">
                            {formatDate(verificationResult.onChain.timestamp * 1000)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Overall Status Summary */}
            <div className="result-section overall-status">
              <h4>📊 Overall Verification Status</h4>
              <div className="status-summary">
                {verificationResult.type === 'file-hash' && verificationResult.hashMatch && 
                 verificationResult.onChain.exists && verificationResult.onChain.isVerified ? (
                  <div className="verification-status success large">
                    <span className="status-icon">🎉</span>
                    <span className="status-text">
                      Document is fully verified and authentic
                    </span>
                  </div>
                ) : verificationResult.type === 'cid-only' && 
                         verificationResult.onChain.exists && verificationResult.onChain.isVerified ? (
                  <div className="verification-status success large">
                    <span className="status-icon">✅</span>
                    <span className="status-text">
                      Document is registered and verified on blockchain
                    </span>
                  </div>
                ) : (
                  <div className="verification-status warning large">
                    <span className="status-icon">⚠️</span>
                    <span className="status-text">
                      Verification incomplete - see details above
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VerificationInterface 