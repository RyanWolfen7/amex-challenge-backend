const env = process.env.NODE_ENV || 'dev';
const port = process.env.PORT || 3000;
const fastify = require('fastify');
const listenMock = require('../mock-server')

// Import required modules
const cluster = require('cluster');
const os = require('os');
const { createLogger } = require('./utils/logger');

const logger = createLogger(env);
const numCPUs = os.cpus().length;
if(env === "dev") {
  listenMock()
}

if (cluster.isMaster) {
  logger.info(`Master process ${process.pid} is running with ${numCPUs} CPUs`);

  // Using 2 worker for development simplifies debugging
  const workerCount = env === 'dev' ? 2 : Math.min(4, numCPUs);  
  logger.info(`Starting ${workerCount} API workers`);
  for (let i = 0; i < workerCount; i++) {
    cluster.fork({ WORKER_TYPE: 'api' });
  }
  
  // Add a small delay between worker spawns to avoid race conditions
  let respawnDelay = 2000; // 2 seconds
  let failureCount = 0;
  const MAX_FAILURES = 10;
  
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    failureCount++;
    
    if (failureCount > MAX_FAILURES) {
      logger.error(`Too many worker failures (${failureCount}). Stopping master process.`);
      process.exit(1);
    }
    
    // Respawn with delay to avoid thrashing
    logger.info(`Respawning worker in ${respawnDelay}ms...`);
    setTimeout(() => {
      cluster.fork();
    }, respawnDelay);
    
    // Increase delay for exponential backoff (max 30 seconds)
    respawnDelay = Math.min(respawnDelay * 1.5, 30000);
  });
  
  // Reset failure count when a worker has been alive for a minute
  cluster.on('online', (worker) => {
    worker.on('message', (msg) => {
      if (msg === 'server-ready') {
        failureCount = 0;
        respawnDelay = 2000; // Reset delay
        logger.info(`Worker ${worker.process.pid} is healthy`);
      }
    });
  });
} else { 
  const startServer = async () => {
    try {
      const app = fastify({
        loggerInstance: logger,
        disableRequestLogging: false,
        requestIdHeader: 'x-request-id',
        requestIdLogLabel: 'reqId',
        genReqId: (req) => require('crypto').randomUUID(),
      });
      // CACHE
      app.register(require('./utils/cacher')); // in case you dont have reddis
      // XSS HEADERS
      app.register(require('./middleware/xssProtection'));
      // RateLimiter 
      app.register(require('./middleware/rateLimiter'))
       // ROUTES
      app.register(require('./routes/users'), { prefix: '/users' });
      app.register(require('./routes/events'), { prefix: '/events' });

      app.setErrorHandler((error, request, reply) => {
        request.log.error('Request failed', { 
          err: {
            message: error.message,
            stack: error.stack,
            code: error.code,
            statusCode: error.statusCode
          },
          route: `${request.method} ${request.url}`,
          params: request.params,
          query: request.query,
          body: request.body
        });
        
        reply.status(500).send({ 
          error: 'Internal Server Error', 
          message: process.env.NODE_ENV === 'dev' ? error.message : undefined
        });
      });
      
      // Needs to be 0.0.0.0 to listen on all network interfaces
      await app.listen({ port, host: '0.0.0.0' });
      logger.info(`Worker ${process.pid} started and listening on port ${port}`);
      
      if (process.send) process.send('server-ready');
    } catch (err) {
      logger.error('Error starting server', { 
        error: {
          message: err.message,
          stack: err.stack,
          code: err.code
        }
      });   
      console.error('Server startup error:', err.message, err.stack);

      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  }; 
  startServer();
  
  const shutdown = async () => {
    logger.info(`Worker ${process.pid} shutting down...`);    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
