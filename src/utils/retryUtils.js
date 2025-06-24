/**
 * Generic retry utility for various operations
 * Supports exponential backoff, jitter, and custom retry conditions
 */

export class RetryManager {
  constructor(config = {}) {
    this.config = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      exponentialBase: 2,
      jitter: true,
      retryCondition: (error) => this.isRetryableError(error),
      ...config
    }
  }

  async withRetry(operation, operationName = 'operation') {
    let lastError = null
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempting ${operationName} (attempt ${attempt + 1}/${this.config.maxRetries + 1})`)
        
        const result = await operation()
        
        if (attempt > 0) {
          console.log(`✅ ${operationName} succeeded after ${attempt + 1} attempts`)
        }
        
        return result
      } catch (error) {
        lastError = error
        
        console.error(`❌ ${operationName} failed (attempt ${attempt + 1}):`, error.message)
        
        // Check if error is retryable
        if (!this.config.retryCondition(error)) {
          console.log(`🚫 Not retrying ${operationName}: error not retryable`)
          throw this.enhanceError(error, operationName, attempt + 1)
        }
        
        // Don't retry on final attempt
        if (attempt === this.config.maxRetries) {
          console.log(`🚫 Max retries (${this.config.maxRetries}) exceeded for ${operationName}`)
          break
        }
        
        // Calculate and wait for delay
        const delay = this.calculateDelay(attempt, error)
        console.log(`⏳ Retrying ${operationName} in ${delay}ms...`)
        
        await this.sleep(delay)
      }
    }
    
    throw this.enhanceError(lastError, operationName, this.config.maxRetries + 1)
  }

  isRetryableError(error) {
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true
    }
    
    // HTTP errors that might be retryable
    if (error.response) {
      const status = error.response.status
      // Retry on 5xx server errors and 429 rate limiting
      return status >= 500 || status === 429 || status === 408
    }
    
    // Timeout errors
    if (error.code === 'TIMEOUT' || 
        error.message?.includes('timeout') ||
        error.message?.includes('network') ||
        error.message?.includes('connection')) {
      return true
    }
    
    // Default to not retry
    return false
  }

  calculateDelay(attempt, error) {
    let baseDelay = this.config.baseDelay
    
    // Longer delays for rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers?.['retry-after']
      if (retryAfter) {
        baseDelay = parseInt(retryAfter) * 1000 // Convert to milliseconds
      } else {
        baseDelay = this.config.baseDelay * 5 // 5x base delay for rate limiting
      }
    }
    
    // Exponential backoff
    const exponentialDelay = baseDelay * Math.pow(this.config.exponentialBase, attempt)
    
    // Apply maximum delay limit
    let delay = Math.min(exponentialDelay, this.config.maxDelay)
    
    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      const jitterRange = delay * 0.1 // ±10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterRange
    }
    
    return Math.round(Math.max(delay, 100)) // Minimum 100ms delay
  }

  enhanceError(originalError, operationName, totalAttempts) {
    const enhancedError = new Error(
      `${operationName} failed after ${totalAttempts} attempts: ${originalError.message}`
    )
    
    enhancedError.originalError = originalError
    enhancedError.operationName = operationName
    enhancedError.totalAttempts = totalAttempts
    enhancedError.timestamp = new Date().toISOString()
    enhancedError.isRetryable = this.config.retryCondition(originalError)
    
    return enhancedError
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Pre-configured retry managers for common use cases
export const pinataRetry = new RetryManager({
  maxRetries: 3,
  baseDelay: 2000, // 2 seconds for file uploads
  maxDelay: 60000, // 1 minute max delay
  retryCondition: (error) => {
    // Retry on network errors and server errors, but not on auth/validation errors
    if (error.response) {
      const status = error.response.status
      return status >= 500 || status === 429 || status === 408
    }
    return error.name === 'TypeError' || 
           error.message?.includes('network') || 
           error.message?.includes('timeout')
  }
})

export const apiRetry = new RetryManager({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 15000,
})

export const blockchainRetry = new RetryManager({
  maxRetries: 2, // Fewer retries for blockchain to avoid double-spending
  baseDelay: 1500,
  maxDelay: 10000,
  retryCondition: (error) => {
    // Don't retry user rejections or insufficient funds
    if (error.code === 'USER_REJECTED' || 
        error.code === 'INSUFFICIENT_FUNDS' ||
        error.message?.includes('rejected') ||
        error.message?.includes('insufficient')) {
      return false
    }
    
    // Retry network and gas estimation errors
    return error.code === 'NETWORK_ERROR' ||
           error.code === 'TIMEOUT' ||
           error.code === 'UNPREDICTABLE_GAS_LIMIT' ||
           error.message?.includes('network') ||
           error.message?.includes('timeout')
  }
})

// Utility functions
export async function withRetry(operation, operationName, retryManager = apiRetry) {
  return retryManager.withRetry(operation, operationName)
}

export function createCustomRetry(config) {
  return new RetryManager(config)
} 