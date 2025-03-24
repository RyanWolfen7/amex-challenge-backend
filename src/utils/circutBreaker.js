/**
 * Creates a new circuit breaker
 * @param {Object} options - Configuration options
 * @returns {Object} Circuit breaker functions and state
 */
function createCircuitBreaker(options = {}) {
    const config = {
      failureThreshold: options.failureThreshold || 3,
      resetTimeout: options.resetTimeout || 30000, // 30 seconds
      maxRetries: options.maxRetries || 5,
      initialBackoff: options.initialBackoff || 1000, // 1 second
      maxBackoff: options.maxBackoff || 30000, // 30 seconds
      logger: options.logger || console
    };
    
    const services = new Map();
    
    /**
     * Initialize service state if needed
     * @param {string} serviceId - Service identifier
     * @returns {Object} Service state
     */
    const getServiceState = (serviceId) => {
      if (!services.has(serviceId)) {
        services.set(serviceId, {
          state: "CLOSED",
          failures: 0,
          lastFailureTime: 0,
          resetTimer: null,
          lastCheckTime: Date.now()
        });
      }
      return services.get(serviceId);
    };
    
    /**
     * Calculate backoff time using exponential strategy
     * @param {number} retryCount - Current retry attempt
     * @returns {number} Time to wait in ms
     */
    const calculateBackoff = (retryCount) => {
      return Math.min(
        config.initialBackoff * Math.pow(2, retryCount),
        config.maxBackoff
      );
    };
    
    /**
     * Wait for specified time
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise} Promise that resolves after delay
     */
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    /**
     * Handle successful execution
     * @param {Object} service - Service state
     * @param {string} serviceId - Service identifier 
     */
    const handleSuccess = (service, serviceId) => {
      if (service.state === "HALF_OPEN") {
        config.logger.info(`Circuit for ${serviceId} recovered, transitioning to CLOSED`);
        service.state = "CLOSED";
        service.failures = 0;
      }
    };
    
    /**
     * Handle execution failure
     * @param {Object} service - Service state
     * @param {string} serviceId - Service identifier
     * @param {Error} error - The error that occurred
     */
    const handleFailure = (service, serviceId, error) => {
      service.failures++;
      service.lastFailureTime = Date.now();
      
      config.logger.warn(
        `Service ${serviceId} failure #${service.failures}, state: ${service.state}`, 
        error.message
      );
      
      // Check if we should open the circuit
      if (service.failures >= config.failureThreshold && service.state !== "OPEN") {
        config.logger.error(`Circuit for ${serviceId} opening due to ${service.failures} failures`);
        service.state = "OPEN";
        
        // Clean up existing timer if any
        if (service.resetTimer) {
          clearTimeout(service.resetTimer);
        }
        
        // Set auto-recovery timer
        service.resetTimer = setTimeout(() => {
          if (service.state === "OPEN") {
            config.logger.info(`Circuit for ${serviceId} auto-transitioning to HALF_OPEN after timeout`);
            service.state = "HALF_OPEN";
          }
        }, config.resetTimeout);
      }
    };
    
    // Public API
    return {
      /**
       * Execute a function with circuit breaker protection
       * @param {string} serviceId - Service identifier
       * @param {Function} fn - Function to execute
       * @param {Object} options - Override options for this execution
       * @returns {Promise<any>} Result of function or throws error
       */
      execute: async (serviceId, fn, { retryCount = 0 } = {}) => {
        const service = getServiceState(serviceId);        
        if (service.state === "OPEN") {
          // Check if enough time has passed to try again
          if (Date.now() - service.lastFailureTime > config.resetTimeout) {
            config.logger.info(`Circuit for ${serviceId} transitioning from OPEN to HALF_OPEN`);
            service.state = "HALF_OPEN";
          } else {
            throw new Error(`Service ${serviceId} is unavailable. Circuit is OPEN.`);
          }
        }
        
        try {
          // Execute the function
          const result = await fn();
          
          // Handle success
          handleSuccess(service, serviceId);
          
          return result;
        } catch (error) {
          handleFailure(service, serviceId, error);
          if (retryCount < config.maxRetries) {
            const backoff = calculateBackoff(retryCount);
            config.logger.info(`Retrying ${serviceId} in ${backoff}ms (retry #${retryCount + 1})`);            
            await delay(backoff);            
            return module.exports.execute(serviceId, fn, { 
              retryCount: retryCount + 1 
            });
          }          
          // Exhausted retries
          throw error;
        }
      },
      
      /**
       * Get current state of a service
       * @param {string} serviceId - Service identifier
       * @returns {Object} Current state information
       */
      getState: (serviceId) => {
        if (!services.has(serviceId)) {
          return { state: "CLOSED", failures: 0 };
        }
        
        const service = services.get(serviceId);
        return {
          state: service.state,
          failures: service.failures,
          lastFailure: service.lastFailureTime ? new Date(service.lastFailureTime).toISOString() : null,
          sinceLastFailure: service.lastFailureTime ? Date.now() - service.lastFailureTime : null
        };
      },
      
      /**
       * Reset circuit to CLOSED state
       * @param {string} serviceId - Service identifier
       * @returns {boolean} Success indicator
       */
      reset: (serviceId) => {
        if (!services.has(serviceId)) return false;
        const service = services.get(serviceId);
        service.state = "CLOSED";
        service.failures = 0;
        if (service.resetTimer) {
          clearTimeout(service.resetTimer);
          service.resetTimer = null;
        }
        config.logger.info(`Circuit for ${serviceId} manually reset to CLOSED`);
        return true;
      },
      
      /**
       * Get all services and their states
       * @returns {Object} Map of all service states
       */
      getAllStates: () => {
        const states = {};
        for (const [serviceId, service] of services.entries()) {
          states[serviceId] = {
            state: service.state,
            failures: service.failures,
            lastFailure: service.lastFailureTime ? new Date(service.lastFailureTime).toISOString() : null,
            sinceLastFailure: service.lastFailureTime ? Date.now() - service.lastFailureTime : null
          };
        }
        return states;
      }
    };
  }
  
  module.exports = createCircuitBreaker;