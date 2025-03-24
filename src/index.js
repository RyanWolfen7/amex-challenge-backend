const env = process.env.NODE_ENV || 'dev';
const port = process.env.PORT || 3000;
const fastify = require('fastify');
const { createLogger } = require('./utils/logger');
const logger = createLogger(env);
const listenMock = require('../mock-server');
if(env === "dev") listenMock();

const app = fastify({
  loggerInstance: logger,
  disableRequestLogging: false,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId',
  genReqId: (req) => require('crypto').randomUUID(),
});

// ROUTES
app.register(require('./routes/users'), { prefix: '/users' });
app.register(require('./routes/events'), { prefix: '/events' });

app.listen({ port });
      logger.info(`Worker ${process.pid} started and listening on port ${port}`);

const shutdown = async () => {
  logger.info(`Worker ${process.pid} shutting down...`);    
  setTimeout(() => {
    process.exit(0);
  }, 1000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);