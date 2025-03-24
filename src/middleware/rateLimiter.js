const fastifyRateLimit = require('@fastify/rate-limit');

module.exports = async function (app, opts) {
    await app.register(fastifyRateLimit, {
        max: 100, // Maximum number of requests allowed
        timeWindow: '1 minute' // Time window in which the limit applies
      });
};