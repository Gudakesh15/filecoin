import React, { useState, useEffect } from 'react';
import { CID } from 'multiformats/cid';
import QRCode from 'qrcode';

const CIDDisplay = ({ uploadData, onClose, onRetryBlockchain }) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [cidFormats, setCidFormats] = useState({});

  useEffect(() => {
    if (uploadData && uploadData.cid) {
      generateCIDFormats(uploadData.cid);
      generateQRCode(uploadData.cid);
    }
  }, [uploadData]);

  const generateCIDFormats = (cidString) => {
    try {
      const cid = CID.parse(cidString);
      
      setCidFormats({
        original: cidString,
        v0: cid.version === 0 ? cidString : cid.toV0().toString(),
        v1: cid.version === 1 ? cidString : cid.toV1().toString(),
        base32: cid.toString(),
        base58: cid.toV0().toString(),
        multibase: cid.toString()
      });
    } catch (error) {
      console.error('Error parsing CID:', error);
      setCidFormats({ original: cidString });
    }
  };

  const generateQRCode = async (cidString) => {
    try {
      // Create IPFS gateway URL for QR code
      const gatewayUrl = `https://ipfs.io/ipfs/${cidString}`;
      const qrUrl = await QRCode.toDataURL(gatewayUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrDataUrl(qrUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getIPFSGatewayUrl = (cid) => {
    return `https://ipfs.io/ipfs/${cid}`;
  };

  const getPinataGatewayUrl = (cid) => {
    const gateway = import.meta.env.VITE_PINATA_GATEWAY || 'gateway.pinata.cloud';
    return `https://${gateway}/ipfs/${cid}`;
  };

  const getExplorerUrl = (txHash) => {
    return `https://calibration.filfox.info/en/message/${txHash}`;
  };

  const getBlockchainStatus = () => {
    if (uploadData.blockchain?.confirmed) {
      return 'success';
    } else if (uploadData.transactionHash) {
      return 'pending';
    } else if (uploadData.blockchainError) {
      return 'error';
    }
    return 'none';
  };

  const getBlockchainMessage = () => {
    const status = getBlockchainStatus();
    switch (status) {
      case 'success':
        return 'Document proof registered on Filecoin blockchain!';
      case 'pending':
        return 'Blockchain registration in progress...';
      case 'error':
        return `Blockchain registration failed: ${uploadData.blockchainError}`;
      default:
        return 'File uploaded to IPFS only (wallet not connected)';
    }
  };

  const getStatusIcon = () => {
    const status = getBlockchainStatus();
    switch (status) {
      case 'success':
        return '🛡️';
      case 'pending':
        return '⏳';
      case 'error':
        return '⚠️';
      default:
        return '☁️';
    }
  };

  if (!uploadData) return null;

  const blockchainStatus = getBlockchainStatus();

  return (
    <div className="cid-display-overlay">
      <div className="cid-display-modal">
        <div className="cid-display-header">
          <h2>
            {getStatusIcon()} File Upload 
            {blockchainStatus === 'success' ? ' & Blockchain Registration Complete!' : 
             blockchainStatus === 'pending' ? ' Complete - Blockchain Registration Pending' :
             blockchainStatus === 'error' ? ' Complete - Blockchain Registration Failed' :
             ' Complete!'}
          </h2>
          <button onClick={onClose} className="close-button" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="cid-display-content">
          {/* Blockchain Status Section */}
          <div className={`blockchain-status-section ${blockchainStatus}`}>
            <h3>⛓️ Blockchain Registration</h3>
            <div className="status-indicator">
              <span className={`status-badge ${blockchainStatus}`}>
                {getStatusIcon()} {getBlockchainMessage()}
              </span>
            </div>

            {uploadData.transactionHash && (
              <div className="transaction-details">
                <div className="transaction-item">
                  <span className="tx-label">Transaction Hash:</span>
                  <div className="tx-value">
                    <code>{uploadData.transactionHash}</code>
                    <button 
                      onClick={() => copyToClipboard(uploadData.transactionHash)}
                      className="copy-button"
                      title="Copy Transaction Hash"
                    >
                      {copied ? '✅' : '📋'}
                    </button>
                  </div>
                </div>
                <div className="transaction-actions">
                  <a 
                    href={getExplorerUrl(uploadData.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="explorer-link"
                  >
                    🔍 View on Filecoin Explorer
                  </a>
                </div>
              </div>
            )}

            {blockchainStatus === 'error' && uploadData.blockchainRetryable && onRetryBlockchain && (
              <div className="retry-section">
                <button 
                  onClick={onRetryBlockchain}
                  className="retry-blockchain-button"
                >
                  🔄 Retry Blockchain Registration
                </button>
                <p className="retry-hint">
                  The file is safely stored on IPFS. You can retry blockchain registration anytime.
                </p>
              </div>
            )}

            {blockchainStatus === 'success' && uploadData.blockchain && (
              <div className="success-details">
                <div className="success-info">
                  <p>✅ Document proof is now permanently registered on Filecoin blockchain</p>
                  <p>🔒 Anyone can verify this document's authenticity using the CID</p>
                  <p>⏰ Registration timestamp: {formatDate(uploadData.blockchain.timestamp || uploadData.timestamp)}</p>
                </div>
              </div>
            )}
          </div>

          {/* File Information */}
          <div className="file-info-section">
            <h3>📄 File Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Filename:</span>
                <span className="info-value">{uploadData.filename}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Size:</span>
                <span className="info-value">{formatFileSize(uploadData.size)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Tag:</span>
                <span className="info-value tag-badge">{uploadData.tag}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Uploaded:</span>
                <span className="info-value">{formatDate(uploadData.timestamp)}</span>
              </div>
            </div>
          </div>

          {/* CID Section */}
          <div className="cid-section">
            <h3>🔗 IPFS Content Identifier (CID)</h3>
            
            {/* Primary CID */}
            <div className="primary-cid">
              <div className="cid-value">
                <code>{cidFormats.original}</code>
                <button 
                  onClick={() => copyToClipboard(cidFormats.original)}
                  className="copy-button"
                  title="Copy CID"
                >
                  {copied ? '✅' : '📋'}
                </button>
              </div>
              {blockchainStatus === 'success' && (
                <p className="cid-note">
                  🛡️ This CID is now cryptographically linked to the Filecoin blockchain
                </p>
              )}
            </div>

            {/* CID Formats */}
            <div className="cid-formats">
              <h4>📋 CID Formats</h4>
              <div className="format-grid">
                {Object.entries(cidFormats).map(([format, value]) => (
                  <div key={format} className="format-item">
                    <div className="format-label">{format.toUpperCase()}:</div>
                    <div className="format-value">
                      <code>{value}</code>
                      <button 
                        onClick={() => copyToClipboard(value)}
                        className="format-copy-btn"
                        title={`Copy ${format.toUpperCase()} format`}
                      >
                        📋
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gateway URLs */}
          <div className="gateway-section">
            <h3>🌐 Access Your File</h3>
            <div className="gateway-links">
              <div className="gateway-item">
                <span className="gateway-label">Pinata Gateway:</span>
                <div className="gateway-url">
                  <a href={getPinataGatewayUrl(uploadData.cid)} target="_blank" rel="noopener noreferrer">
                    {getPinataGatewayUrl(uploadData.cid)}
                  </a>
                  <button 
                    onClick={() => copyToClipboard(getPinataGatewayUrl(uploadData.cid))}
                    className="copy-button"
                  >
                    📋
                  </button>
                </div>
              </div>
              <div className="gateway-item">
                <span className="gateway-label">Public IPFS Gateway:</span>
                <div className="gateway-url">
                  <a href={getIPFSGatewayUrl(uploadData.cid)} target="_blank" rel="noopener noreferrer">
                    {getIPFSGatewayUrl(uploadData.cid)}
                  </a>
                  <button 
                    onClick={() => copyToClipboard(getIPFSGatewayUrl(uploadData.cid))}
                    className="copy-button"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code */}
          {qrDataUrl && (
            <div className="qr-section">
              <h3>📱 QR Code</h3>
              <div className="qr-container">
                <img src={qrDataUrl} alt="QR Code for IPFS file" className="qr-code" />
                <p className="qr-description">Scan to access your file via IPFS</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="actions-section">
            <button 
              onClick={() => copyToClipboard(cidFormats.original)}
              className="action-button primary"
            >
              {copied ? '✅ Copied!' : '📋 Copy CID'}
            </button>
            <button 
              onClick={() => window.open(getPinataGatewayUrl(uploadData.cid), '_blank')}
              className="action-button secondary"
            >
              🔗 View File
            </button>
            {blockchainStatus === 'success' && (
              <button 
                onClick={() => window.open('/verify', '_blank')}
                className="action-button verify"
              >
                🔍 Verify Document
              </button>
            )}
            <button 
              onClick={onClose}
              className="action-button"
            >
              ✨ Upload Another
            </button>
          </div>

          {/* Technical Details */}
          <div className="technical-details">
            <details>
              <summary>🔧 Technical Details</summary>
              <div className="tech-info">
                <p><strong>Storage Provider:</strong> Pinata (IPFS + Filecoin)</p>
                <p><strong>Content Addressing:</strong> IPFS using SHA-256 hash</p>
                <p><strong>CID Version:</strong> {cidFormats.original?.startsWith('Qm') ? 'v0 (Base58)' : 'v1 (Base32)'}</p>
                <p><strong>Blockchain:</strong> Filecoin Calibration Testnet</p>
                <p><strong>Smart Contract:</strong> 0x527C50036dB179c92b87518818618041F640005F</p>
                <p><strong>Decentralized:</strong> File is distributed across IPFS network</p>
                <p><strong>Immutable:</strong> Content cannot be changed (new CID for changes)</p>
                {blockchainStatus === 'success' && (
                  <p><strong>Blockchain Proof:</strong> Document authenticity cryptographically verified</p>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CIDDisplay; 