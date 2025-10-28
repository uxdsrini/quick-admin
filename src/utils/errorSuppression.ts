/**
 * Suppresses non-critical Blink iframe monitoring errors and DataCloneError that don't affect app functionality
 */
export function suppressBlinkIframeErrors() {
  const originalError = console.error;
  
  console.error = (...args) => {
    const errorMessage = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
    
    // Suppress Blink iframe monitoring errors
    if (errorMessage?.includes?.('blink iframe monitoring')) {
      return;
    }
    
    // Suppress DataCloneError from postMessage attempts
    if (
      errorMessage?.includes?.('DataCloneError') ||
      errorMessage?.includes?.('Failed to send message') ||
      errorMessage?.includes?.('Failed to execute \'postMessage\'') ||
      errorMessage?.includes?.('Request object could not be cloned')
    ) {
      return;
    }
    
    originalError.apply(console, args);
  };
}

/**
 * Suppress uncaught errors related to postMessage serialization
 */
export function suppressDataCloneErrors() {
  window.addEventListener('error', (event) => {
    if (
      event.message?.includes?.('DataCloneError') ||
      event.message?.includes?.('Request object could not be cloned') ||
      event.message?.includes?.('Failed to execute \'postMessage\'')
    ) {
      event.preventDefault();
    }
  }, true);
  
  // Also handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || reason?.toString?.() || '';
    
    if (
      message?.includes?.('DataCloneError') ||
      message?.includes?.('Request object could not be cloned') ||
      message?.includes?.('Failed to execute \'postMessage\'')
    ) {
      event.preventDefault();
    }
  });
}