const fp = require('fastify-plugin');

function cachePlugin(app, options, done) {
  const cache = new Map();
  const DEFAULT_TTL = 30000; // 30 seconds
  
  app.decorate('cache', {
    get: (key) => {
      const item = cache.get(key);
      if (!item) return undefined;
      if (Date.now() > item.expires) {
        cache.delete(key);
        return undefined;
      }
      return item.value;
    },
    set: (key, value, ttl = DEFAULT_TTL) => {
      cache.set(key, {
        value,
        expires: Date.now() + ttl
      });
    },
    del: (key) => cache.delete(key),
    clear: () => cache.clear(),
    _cleanupExpiredItems: () => {
      const now = Date.now();
      for (const [key, item] of cache.entries()) {
        if (now > item.expires) {
          cache.delete(key);
        }
      }
    }
  });
  const cleanup = setInterval(() => app.cache._cleanupExpiredItems(), DEFAULT_TTL);  
  app.addHook('onClose', () => clearInterval(cleanup));
  done();
}

module.exports = fp(cachePlugin, {
  name: 'cache',
  fastify: '5.x'
});