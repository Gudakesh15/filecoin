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
  PROOF_VAULT: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', // ProofVault contract on Filecoin Calibration
} as const;

// ProofVault contract ABI (from our deployed contract)
export const PROOF_VAULT_ABI = [
  {
    "inputs": [],
    "name": "DocumentRegistered",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DocumentVerified", 
    "type": "event"
  },
  {
    "inputs": [{"name": "_cid", "type": "string"}],
    "name": "registerDocument",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "_cid", "type": "string"}],
    "name": "verifyDocument",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "", "type": "string"}],
    "name": "documents",
    "outputs": [
      {"name": "cid", "type": "string"},
      {"name": "uploader", "type": "address"},
      {"name": "timestamp", "type": "uint256"},
      {"name": "verified", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const; 