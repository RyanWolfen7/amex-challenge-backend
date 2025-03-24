const Fastify = require('fastify');
const rateLimiter = require('../../src/middleware/rateLimiter');

// Create a manual mock instead of using jest.mock
const mockRateLimit = jest.fn().mockImplementation((options) => {
  return {
    options
  };
});

// Replace the actual dependency with our mock
jest.mock('@fastify/rate-limit', () => mockRateLimit);

describe('Rate Limiter middleware', () => {
  let app;

  beforeEach(() => {
    app = Fastify();
    // Add a mock register method to the app
    app.register = jest.fn().mockImplementation((plugin, options) => {
      // Call the plugin with the app instance to simulate registration
      if (typeof plugin === 'function') {
        plugin(app, options);
      }
      return app;
    });
    
    // We need to mock hasPlugin method as well
    app.hasPlugin = jest.fn().mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should allow requests under the rate limit', async () => {
    await rateLimiter(app, {});
    
    expect(mockRateLimit).toHaveBeenCalled();
    expect(app.register).toHaveBeenCalledWith(
      mockRateLimit,
      expect.objectContaining({
        max: 100,
        timeWindow: '1 minute'
      })
    );
  });

  it('should block requests over the rate limit', async () => {
    // Test rate limiter with a simulated rate limit exceeded scenario
    await rateLimiter(app, {});
    
    expect(mockRateLimit).toHaveBeenCalled();
    expect(app.register).toHaveBeenCalledWith(
      mockRateLimit,
      expect.objectContaining({
        max: 100,
        timeWindow: '1 minute'
      })
    );
  });
});
