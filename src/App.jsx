import { useState } from 'react'
import { Web3Provider } from './components/providers/Web3Provider'
import './App.css'
import FileUpload from './components/FileUpload'
import VerificationInterface from './components/VerificationInterface'
import WalletConnection from './components/WalletConnection'

function App() {
  const [activeTab, setActiveTab] = useState('upload')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [walletConnection, setWalletConnection] = useState(null)

  const handleUploadSuccess = (uploadData) => {
    setUploadedFiles(prev => [...prev, uploadData])
  }

  const handleUploadError = (error) => {
    console.error('Upload error in App:', error)
    // Could add a toast notification here
  }

  const handleWalletConnectionChange = (connectionInfo) => {
    setWalletConnection(connectionInfo)
    console.log('Wallet connection changed:', connectionInfo)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString()
  }

  const truncateCID = (cid, start = 8, end = 8) => {
    if (cid.length <= start + end) return cid
    return `${cid.slice(0, start)}...${cid.slice(-end)}`
  }

  return (
    <Web3Provider>
      <div className="app">
        <header className="app-header">
          <h1>🔐 ProofVault</h1>
          <p>Decentralized Document Verification on Filecoin</p>
          
          {/* Navigation Tabs */}
          <nav className="main-navigation">
            <button 
              className={`nav-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              📤 Upload
            </button>
            <button 
              className={`nav-tab ${activeTab === 'verify' ? 'active' : ''}`}
              onClick={() => setActiveTab('verify')}
            >
              🔍 Verify
            </button>
          </nav>
        </header>
        
        <main className="app-main">
          {/* Wallet Connection Section */}
          <div className="wallet-section">
            <WalletConnection onConnectionChange={handleWalletConnectionChange} />
          </div>

          {activeTab === 'upload' && (
            <>
              <div className="upload-section">
                <h2>Upload Document</h2>
                <FileUpload 
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  walletConnection={walletConnection}
                />
              </div>
              
              {uploadedFiles.length > 0 && (
                <div className="files-section">
                  <h2>📂 Your Documents ({uploadedFiles.length})</h2>
                  <div className="files-grid">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="file-card">
                        <div className="file-card-header">
                          <h3>📄 {file.filename}</h3>
                          <span className="file-tag">{file.tag}</span>
                        </div>
                        
                        <div className="file-card-content">
                          <div className="file-detail">
                            <span className="detail-label">CID:</span>
                            <code className="cid-display" title={file.cid}>
                              {truncateCID(file.cid)}
                            </code>
                          </div>
                          
                          <div className="file-detail">
                            <span className="detail-label">Size:</span>
                            <span>{formatFileSize(file.size)}</span>
                          </div>
                          
                          <div className="file-detail">
                            <span className="detail-label">Uploaded:</span>
                            <span>{formatDate(file.timestamp)}</span>
                          </div>
                        </div>
                        
                        <div className="file-card-actions">
                          <a 
                            href={`https://${import.meta.env.VITE_PINATA_GATEWAY || 'gateway.pinata.cloud'}/ipfs/${file.cid}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="view-button"
                          >
                            🔗 View File
                          </a>
                          <button 
                            onClick={() => navigator.clipboard.writeText(file.cid)}
                            className="copy-button"
                            title="Copy CID"
                          >
                            📋 Copy CID
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'verify' && (
            <div className="verification-section">
              <VerificationInterface walletConnection={walletConnection} />
            </div>
          )}
        </main>
      </div>
    </Web3Provider>
  )
}

export default App
