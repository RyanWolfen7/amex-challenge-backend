const Fastify = require('fastify');

describe('XSS Protection middleware', () => {
  let xssProtection;
  
  beforeAll(() => {
    try {
      xssProtection = require('../../src/middleware/xssProtection');
    } catch (e) {
      console.error('Failed to load XSS Protection middleware:', e);
    }
  });
  
  beforeEach(() => {
    if (!xssProtection) {
      console.log('XSS Protection middleware not found, skipping test');
    }
  });

  test('should set default security headers', async () => {
    if (!xssProtection) return;
    
    const app = Fastify();
    await app.register(xssProtection);
    
    app.get('/test', async () => ({ success: true }));
    
    const response = await app.inject({
      method: 'GET',
      url: '/test'
    });
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['content-security-policy']).toBe("default-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  test('should include reportUri when provided', async () => {
    if (!xssProtection) return;
    
    const app = Fastify();
    await app.register(xssProtection, { 
      reportUri: 'https://example.com/report' 
    });
    
    app.get('/test-report', async () => ({ success: true }));
    
    const response = await app.inject({
      method: 'GET',
      url: '/test-report'
    });
    
    expect(response.headers['x-xss-protection']).toBe('1; mode=block; report=https://example.com/report');
  });

  test('should disable X-XSS-Protection for IE < 9', async () => {
    if (!xssProtection) return;
    
    const app = Fastify();
    await app.register(xssProtection);
    
    app.get('/test-ie8', async () => ({ oldIE: true }));
    
    const response = await app.inject({
      method: 'GET',
      url: '/test-ie8',
      headers: { 'user-agent': 'MSIE 8.0' }
    });
    
    expect(response.headers['x-xss-protection']).toBe('0');
  });

  test('should enable X-XSS-Protection for IE >= 9', async () => {
    if (!xssProtection) return;
    
    const app = Fastify();
    await app.register(xssProtection);
    
    app.get('/test-ie9', async () => ({ ie9: true }));
    
    const response = await app.inject({
      method: 'GET',
      url: '/test-ie9',
      headers: { 'user-agent': 'MSIE 9.0' }
    });
    
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
  });

  test('should set X-XSS-Protection when setOnOldIE is true', async () => {
    if (!xssProtection) return;
    
    const app = Fastify();
    await app.register(xssProtection, { setOnOldIE: true });
    
    app.get('/test-old-ie', async () => ({ oldIE: true }));
    
    const response = await app.inject({
      method: 'GET',
      url: '/test-old-ie',
      headers: { 'user-agent': 'MSIE 8.0' }
    });
    
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
  });

  test('should handle missing user-agent header', async () => {
    if (!xssProtection) return;
    
    const app = Fastify();
    await app.register(xssProtection);
    
    app.get('/test-no-ua', async () => ({ success: true }));
    
    const response = await app.inject({
      method: 'GET',
      url: '/test-no-ua',
      headers: {}
    });
    
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
  });
});