import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['ethers'],
    exclude: []
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Handle crypto polyfills for ethers.js
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      util: 'util'
    }
  }
})
