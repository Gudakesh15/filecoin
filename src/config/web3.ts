import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { defineChain } from 'viem';
import type { Chain } from 'viem';

// Define Filecoin Calibration testnet
export const filecoinCalibration: Chain = defineChain({
  id: 314159,
  name: 'Filecoin Calibration',
  nativeCurrency: {
    decimals: 18,
    name: 'Test Filecoin',
    symbol: 'tFIL',
  },
  rpcUrls: {
    default: {
      http: ['https://api.calibration.node.glif.io/rpc/v1'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Filecoin Calibration Explorer',
      url: 'https://calibration.filfox.info',
    },
  },
  testnet: true,
});

// Get project ID from environment variables with fallback for development
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'temp_development_id_for_testing';

if (!import.meta.env.VITE_WALLETCONNECT_PROJECT_ID) {
  console.warn('VITE_WALLETCONNECT_PROJECT_ID is not set. Using temporary ID for development.');
}

// Define supported chains
const chains = [filecoinCalibration] as const;

// Create wagmi config
export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata: {
    name: 'ProofVault',
    description: 'Decentralized Document Verification on Filecoin',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://proofvault.io',
    icons: ['https://proofvault.io/favicon.ico'],
  },
  enableWalletConnect: true,
  enableInjected: true,
  enableEIP6963: true,
  enableCoinbase: true,
});

// Create Web3Modal instance (only on client side)
let web3Modal: any = null;

// Initialize Web3Modal only on client side and only once
export const initWeb3Modal = () => {
  if (typeof window !== 'undefined' && !web3Modal) {
    try {
      web3Modal = createWeb3Modal({
        wagmiConfig: config,
        projectId,
        enableAnalytics: false,
        enableOnramp: false,
        themeMode: 'light',
        themeVariables: {
          '--w3m-color-mix': '#2563eb',
          '--w3m-color-mix-strength': 40,
        },
      });
    } catch (error) {
      console.warn('Failed to initialize Web3Modal:', error);
    }
  }
  return web3Modal;
};

export { web3Modal };

// Contract addresses for ProofVault
export const CONTRACT_ADDRESSES = {
  PROOF_VAULT: '0x527C50036dB179c92b87518818618041F640005F', // ProofVault contract on Filecoin Calibration
} as const;

// ProofVault contract ABI (from our deployed contract)
export const PROOF_VAULT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "string", "name": "cid", "type": "string"},
      {"indexed": false, "internalType": "string", "name": "tag", "type": "string"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "DocumentRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "string", "name": "cid", "type": "string"},
      {"indexed": true, "internalType": "address", "name": "verifier", "type": "address"},
      {"indexed": false, "internalType": "string", "name": "verifierName", "type": "string"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "DocumentVerified",
    "type": "event"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "cid", "type": "string"},
      {"internalType": "string", "name": "tag", "type": "string"}
    ],
    "name": "registerDocument",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "cid", "type": "string"},
      {"internalType": "string", "name": "verifierName", "type": "string"}
    ],
    "name": "verifyDocument",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "cid", "type": "string"}],
    "name": "getDocumentMetadata",
    "outputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "string", "name": "tag", "type": "string"},
      {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
      {"internalType": "bool", "name": "exists", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "cid", "type": "string"}],
    "name": "isDocumentVerified",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const; 