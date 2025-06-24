'use client';

import React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config, initWeb3Modal } from '../../config/web3';

// Create a query client for React Query
const queryClient = new QueryClient();

// Initialize Web3Modal once when the provider is created
if (typeof window !== 'undefined') {
  initWeb3Modal();
}

interface Web3ProviderProps {
  children: React.ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
} 