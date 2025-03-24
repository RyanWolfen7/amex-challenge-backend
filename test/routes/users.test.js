const sinon = require('sinon');
const Fastify = require('fastify');

describe('User Routes', () => {
  let app;
  let mockFetch;

  // Mock data
  const mockUserData = [
    { id: 1, userName: 'user1', email: 'hello@gmail.com', events: ['event-1', 'event-3'] },
    { id: 2, userName: 'user2', email: 'hello2@gmail.com', events: ['event-2'] },
    { id: 3, userName: 'user3', email: 'hello3@gmail.com', events: ['event-4'] }
  ];

  const singleUser = { 
    id: 1, 
    userName: 'user1', 
    email: 'hello@gmail.com', 
    events: ['event-1', 'event-3'] 
  };

  // Mock responses
  const mockSuccessResponse = {
    ok: true,
    status: 200,
    json: async () => mockUserData
  };

  const mockSingleSuccessResponse = {
    ok: true,
    status: 200,
    json: async () => singleUser
  };

  const mockErrorResponse = {
    ok: false,
    status: 404,
    statusText: 'Not Found'
  };

  beforeEach(async () => {
    mockFetch = sinon.stub();
    app = Fastify();
    
    // Decorate with cache and proper logger
    app.decorate('cache', {
      get: sinon.stub(),
      set: sinon.stub()
    });
    
    // Add request logger decoration
    app.addHook('onRequest', (req, reply, done) => {
      req.log = {
        info: sinon.stub(),
        error: sinon.stub()
      };
      done();
    });

    // Register the routes directly (no need for proxyquire)
    await app.register(async function (fastify, opts) {
      // Inject our mock fetch into the scope
      const originalFetch = fetch;
      global.fetch = mockFetch;

      // Register the actual routes
      require('../../src/routes/users')(fastify, opts);

      // Cleanup
      return () => {
        global.fetch = originalFetch;
      };
    });
  });

  afterEach(async () => {
    await app.close();
    sinon.restore();
  });

  describe('GET /', () => {
    it('returns all users from API when cache is empty', async () => {
      app.cache.get.returns(null);
      mockFetch.resolves(mockSuccessResponse);

      const response = await app.inject({ method: 'GET', url: '/' });
      
      expect(response.statusCode).toBe(200);
      expect(mockFetch.calledWith('http://event.com/getUsers')).toBe(true);
      expect(app.cache.set.calledWith('all-users', mockUserData, 3000000)).toBe(true);
      expect(JSON.parse(response.payload)).toEqual(mockUserData);
    });

    it('returns cached data when available', async () => {
      app.cache.get.returns(mockUserData);

      const response = await app.inject({ method: 'GET', url: '/' });
      
      expect(response.statusCode).toBe(200);
      expect(mockFetch.called).toBe(false);
      expect(JSON.parse(response.payload)).toEqual(mockUserData);
    });

    it('handles API errors', async () => {
      app.cache.get.returns(null);
      mockFetch.resolves(mockErrorResponse);

      const response = await app.inject({ method: 'GET', url: '/' });
      
      expect(response.statusCode).toBe(404);
      expect(mockFetch.called).toBe(true);
      expect(app.cache.set.called).toBe(false);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Not Found' });
    });
  });

  describe('GET /:id', () => {
    it('returns single user from API when cache is empty', async () => {
      app.cache.get.returns(null);
      mockFetch.resolves(mockSingleSuccessResponse);

      const response = await app.inject({ method: 'GET', url: '/1' });
      
      expect(response.statusCode).toBe(200);
      expect(mockFetch.calledWith('http://event.com/getUserById/1')).toBe(true);
      expect(app.cache.set.calledWith('user-1', singleUser, 3000000)).toBe(true);
      expect(JSON.parse(response.payload)).toEqual(singleUser);
    });

    it('returns cached data when available', async () => {
      app.cache.get.returns(singleUser);

      const response = await app.inject({ method: 'GET', url: '/1' });
      
      expect(response.statusCode).toBe(200);
      expect(mockFetch.called).toBe(false);
      expect(JSON.parse(response.payload)).toEqual(singleUser);
    });

    it('handles API errors', async () => {
      app.cache.get.returns(null);
      mockFetch.resolves(mockErrorResponse);

      const response = await app.inject({ method: 'GET', url: '/999' });
      
      expect(response.statusCode).toBe(404);
      expect(mockFetch.calledWith('http://event.com/getUserById/999')).toBe(true);
      expect(app.cache.set.called).toBe(false);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Not Found' });
    });
  });
});