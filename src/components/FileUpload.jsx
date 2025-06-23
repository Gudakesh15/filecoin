import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import CIDDisplay from './CIDDisplay'
import './FileUpload.css'
import './CIDDisplay.css'

const FileUpload = ({ onUploadSuccess, onUploadError }) => {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [tag, setTag] = useState('')
  const [uploadData, setUploadData] = useState(null)
  const [showCIDDisplay, setShowCIDDisplay] = useState(false)

  // Pinata configuration
  const PINATA_JWT = import.meta.env.VITE_PINATA_JWT
  const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || 'gateway.pinata.cloud'

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

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    
    // Validate file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      const error = 'File size exceeds 100MB limit'
      if (onUploadError) onUploadError(error)
      alert(error)
      return
    }

    try {
      setUploading(true)
      setProgress(0)

      // Simulate progress for user feedback
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const result = await uploadToPinata(file)
      
      clearInterval(progressInterval)
      setProgress(100)

      // Store upload data and show CID display
      setUploadData(result)
      setShowCIDDisplay(true)

      // Call success callback
      if (onUploadSuccess) {
        onUploadSuccess(result)
      }

      // Reset form
      setTag('')

    } catch (error) {
      console.error('Upload failed:', error)
      if (onUploadError) onUploadError(error.message)
      alert(`Upload failed: ${error.message}`)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [tag, onUploadSuccess, onUploadError, PINATA_JWT])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploading,
    multiple: false,
    maxSize: 100 * 1024 * 1024 // 100MB
  })

  const handleCloseCIDDisplay = () => {
    setShowCIDDisplay(false)
    setUploadData(null)
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
            className={`dropzone ${isDragActive ? 'active' : ''} ${uploading ? 'uploading' : ''}`}
          >
            <input {...getInputProps()} />
            
            {uploading ? (
              <div className="upload-progress">
                <div className="progress-circle">
                  <svg className="progress-ring" width="120" height="120">
                    <circle
                      className="progress-ring-circle"
                      stroke="currentColor"
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
                  <span className="progress-text">{progress}%</span>
                </div>
                <p>Uploading to IPFS via Pinata...</p>
              </div>
            ) : isDragActive ? (
              <div className="drag-active">
                <div className="upload-icon">📁</div>
                <p>Drop your file here</p>
              </div>
            ) : (
              <div className="upload-prompt">
                <div className="upload-icon">☁️</div>
                <h3>Upload Document to IPFS</h3>
                <p>Drag and drop a file here, or click to select</p>
                <p className="file-info">Maximum file size: 100MB</p>
                {!PINATA_JWT && (
                  <div className="config-warning">
                    ⚠️ Pinata JWT not configured. Please add VITE_PINATA_JWT to your .env file.
                  </div>
                )}
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
        />
      )}
    </>
  )
}

export default FileUpload 