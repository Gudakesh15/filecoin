import React, { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { initWeb3Modal } from '../config/web3'
import './WalletConnection.css'

const WalletConnection = ({ onConnectionChange }) => {
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  
  // Wagmi hooks
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({
    address: address,
  })

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  // Update parent component when connection changes
  useEffect(() => {
    if (mounted && onConnectionChange) {
      onConnectionChange({
        isConnected,
        account: address || null,
        balance: balance ? parseFloat(balance.formatted) : null,
        chainId,
      })
    }
  }, [isConnected, address, balance, chainId, mounted, onConnectionChange])

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="wallet-section">
        <h3>💳 Wallet Connection</h3>
        <button className="connect-button" disabled>
          Loading...
        </button>
      </div>
    )
  }

  // Handle wallet connection using Web3Modal
  const handleConnect = async () => {
    try {
      setError('')
      
      // Use Web3Modal for better UX
      const modal = initWeb3Modal()
      if (modal) {
        console.log('🚀 Opening Web3Modal for wallet selection...')
        modal.open()
      } else {
        // Fallback to direct Wagmi connection
        console.log('📱 Using fallback Wagmi connection...')
        const injectedConnector = connectors.find(c => c.type === 'injected')
        if (injectedConnector) {
          await connect({ connector: injectedConnector })
        } else if (connectors.length > 0) {
          await connect({ connector: connectors[0] })
        } else {
          throw new Error('No wallet connectors available')
        }
      }
    } catch (error) {
      console.error('❌ Wallet connection failed:', error)
      setError(error.message || 'Failed to connect wallet')
    }
  }

  // Handle wallet disconnection
  const handleDisconnect = async () => {
    try {
      await disconnect()
      
      // Also close Web3Modal if it's open
      const modal = initWeb3Modal()
      if (modal) {
        modal.close()
      }
      
      setError('')
      setShowDetails(false)
    } catch (error) {
      console.error('❌ Wallet disconnection failed:', error)
      setError(error.message || 'Failed to disconnect wallet')
    }
  }

  // Format address for display
  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Format balance for display
  const formatBalance = (bal) => {
    if (!bal) return '0'
    const value = parseFloat(bal.formatted)
    return value.toFixed(4)
  }

  // Check if we're on the correct network (Filecoin Calibration)
  const isCorrectNetwork = chainId === 314159

  return (
    <div className="wallet-section">
      <h3>💳 Wallet Connection</h3>
      
      {!isConnected ? (
        <div className="wallet-disconnected">
          <div className="wallet-status">
            <span className="status-indicator offline">⚪</span>
            <span>Not Connected</span>
          </div>
          
          <button 
            className="connect-button"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <span className="loading-spinner"></span>
                Connecting...
              </>
            ) : (
              <>
                <span className="metamask-icon">🦊</span>
                Connect Wallet
              </>
            )}
          </button>

          {error && (
            <div className="error-message">
              <span>⚠️ {error}</span>
            </div>
          )}

          <div className="wallet-requirements">
            <h4>Requirements:</h4>
            <ul>
              <li>✅ MetaMask or compatible wallet</li>
              <li>✅ Filecoin Calibration testnet</li>
              <li>✅ Small amount of tFIL for gas fees</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="wallet-connected">
          <div className="wallet-status">
            <span className={`status-indicator ${isCorrectNetwork ? 'online' : 'warning'}`}>
              {isCorrectNetwork ? '🟢' : '🟡'}
            </span>
            <span>
              {isCorrectNetwork ? 'Connected to Filecoin Calibration' : 'Wrong Network'}
            </span>
          </div>

          <div className="wallet-info">
            <div className="account-info">
              <strong>Account:</strong>
              <span className="account-address">{formatAddress(address)}</span>
            </div>
            
            <div className="balance-info">
              <strong>Balance:</strong>
              <span className="balance-amount">
                {balance ? `${formatBalance(balance)} ${balance.symbol}` : 'Loading...'}
              </span>
            </div>
          </div>

          <div className="wallet-actions">
            <button
              className="details-toggle"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '▼ Hide Details' : '▶ Show Details'}
            </button>
            
            <button
              className="disconnect-button"
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          </div>

          {showDetails && (
            <div className="wallet-details">
              <div className="detail-row">
                <strong>Full Address:</strong>
                <span className="full-address">{address}</span>
              </div>
              
              <div className="detail-row">
                <strong>Network:</strong>
                <span>Filecoin Calibration (Chain ID: {chainId})</span>
              </div>
              
              <div className="wallet-links">
                <a
                  href={`https://calibration.filfox.info/en/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="explorer-link"
                >
                  🔍 View on Explorer
                </a>
                
                <a
                  href="https://faucet.calibration.fildev.network/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="faucet-link"
                >
                  🚰 Get Test tFIL
                </a>
              </div>
            </div>
          )}

          {!isCorrectNetwork && (
            <div className="network-warning">
              <p>⚠️ Please switch to Filecoin Calibration testnet</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span>⚠️ {error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WalletConnection 