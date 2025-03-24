const Fastify = require('fastify');

describe('Cacher utility', () => {
  let cacher;
  
  beforeAll(() => {
    try {
      cacher = require('../../src/utils/cacher');
    } catch (e) {
      console.log('Cacher module not found, skipping tests');
      return;
    }
  });

  it('should register cache decorator on fastify instance', async () => {
    const app = Fastify();
    try {
      await app.register(cacher);
      await app.ready();
      
      expect(app.cache).toBeDefined();
      expect(typeof app.cache.get).toBe('function');
      expect(typeof app.cache.set).toBe('function');
      expect(typeof app.cache.del).toBe('function');
      expect(typeof app.cache.clear).toBe('function');
    } finally {
      await app.close();
    }
  });
  
  it('should store and retrieve values', async () => {
    const app = Fastify();
    try {
      await app.register(cacher);
      await app.ready();
      
      const testKey = 'test-key';
      const testValue = { name: 'test-value', id: 123 };
      
      app.cache.set(testKey, testValue);
      
      const retrieved = app.cache.get(testKey);
      expect(retrieved).toEqual(testValue);
    } finally {
      await app.close();
    }
  });
  
  it('should handle cache misses', async () => {
    const app = Fastify();
    try {
      await app.register(cacher);
      await app.ready();
      
      const nonExistentKey = 'this-key-does-not-exist';
      
      const retrieved = app.cache.get(nonExistentKey);
      expect(retrieved).toBeUndefined();
    } finally {
      await app.close();
    }
  });
  
  it('should respect TTL for cached items', async () => {
    const app = Fastify();
    try {
      await app.register(cacher);
      await app.ready();
      
      const testKey = 'expiring-test-key';
      const testValue = { name: 'expires-soon' };
      
      app.cache.set(testKey, testValue, 100); // 100ms TTL
      
      expect(app.cache.get(testKey)).toEqual(testValue);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(app.cache.get(testKey)).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('should delete cached items', async () => {
    const app = Fastify();
    try {
      await app.register(cacher);
      await app.ready();
      
      const testKey = 'delete-test-key';
      const testValue = { name: 'to-delete' };
      
      app.cache.set(testKey, testValue);
      expect(app.cache.get(testKey)).toEqual(testValue);
      
      app.cache.del(testKey);
      expect(app.cache.get(testKey)).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('should clear all cached items', async () => {
    const app = Fastify();
    try {
      await app.register(cacher);
      await app.ready();
      
      const key1 = 'key1';
      const value1 = 'value1';
      const key2 = 'key2';
      const value2 = 'value2';
      
      app.cache.set(key1, value1);
      app.cache.set(key2, value2);
      
      expect(app.cache.get(key1)).toBe(value1);
      expect(app.cache.get(key2)).toBe(value2);
      
      app.cache.clear();
      
      expect(app.cache.get(key1)).toBeUndefined();
      expect(app.cache.get(key2)).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('should clean up expired items via periodic cleanup', async () => {
    jest.setTimeout(10000);
    jest.useFakeTimers();
    const app = Fastify();
    try {
      await app.register(cacher);
      await app.ready();
      
      const startTime = 0;
      const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => startTime);
      
      // Set items at time 0
      app.cache.set('short1', 'value1', 1000); // expires at 1000
      app.cache.set('short2', 'value2', 1000); // expires at 1000
      app.cache.set('long1', 'value3', 60000); // expires at 60000
      
      // Advance time to 1500
      dateNowSpy.mockImplementation(() => 1500);
      jest.advanceTimersByTime(1500);
      
      // At this point, short1 and short2 are expired, but don't call get yet
      
      // Call cleanup
      app.cache._cleanupExpiredItems();
      
      // Now, the cleanup should have removed short1 and short2
      expect(app.cache.get('short1')).toBeUndefined();
      expect(app.cache.get('short2')).toBeUndefined();
      expect(app.cache.get('long1')).toBe('value3');
      
      // Advance time to 61500 to expire long1
      dateNowSpy.mockImplementation(() => 61500);
      jest.advanceTimersByTime(60000);
      
      // Call cleanup again
      app.cache._cleanupExpiredItems();
      
      // Now, long1 should be expired
      expect(app.cache.get('long1')).toBeUndefined();
    } finally {
      jest.runAllTimers(); // Run any pending timers
      await app.close();
      jest.useRealTimers();
      dateNowSpy.mockRestore();
    }
  });

  it('should set up periodic cleanup', async () => {
    jest.setTimeout(10000);
    const app = Fastify();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    try {
      await app.register(cacher);
      await app.ready();
      
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    } finally {
      await app.close();
      setIntervalSpy.mockRestore();
    }
  });
});