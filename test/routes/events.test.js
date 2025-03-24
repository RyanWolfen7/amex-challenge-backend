// test/routes/events.test.js
const sinon = require('sinon');
const Fastify = require('fastify');
const { createLogger } = require('../../src/utils/logger');

describe('Event Routes', () => {
  let app;
  let mockFetch;
  let originalFetch;

  const mockEvents = [
    { id: 'event-1', name: 'Event 1', date: '2023-01-01' },
    { id: 'event-2', name: 'Event 2', date: '2023-01-15' }
  ];

  const singleEvent = { id: 'event-1', name: 'Event 1', date: '2023-01-01' };
  const newEvent = { id: '123', name: 'New Event', date: '2023-02-01' };
  const userData = { id: '1', events: ['event-1', 'event-2'] };

  beforeEach(async () => {
    mockFetch = sinon.stub();
    app = Fastify({ logger: false }); // Disable default logger to avoid conflicts

    const logger = createLogger('test');
    app.log = logger;

    app.decorate('cache', {
      get: sinon.stub(),
      set: sinon.stub(),
      del: sinon.stub()
    });

    // Set up spies on the logger before registering routes
    sinon.spy(logger, 'info');
    sinon.spy(logger, 'error');
    sinon.spy(logger, 'warn');

    app.addHook('onRequest', (req, reply, done) => {
      req.log = logger; // Use the same logger instance with spies
      done();
    });

    const eventsModule = require('../../src/routes/events');
    await app.register(eventsModule);

    originalFetch = global.fetch;
    global.fetch = mockFetch;

    mockFetch.resolves({
      ok: true,
      status: 200,
      json: async () => mockEvents
    });
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await app.close();
    sinon.restore();
  });

  describe('GET /', () => {
    it('returns cached events when available', async () => {
      app.cache.get.returns(mockEvents);
      const response = await app.inject({ method: 'GET', url: '/' });
      expect(response.statusCode).toBe(200);
      expect(mockFetch.called).toBe(false);
      expect(JSON.parse(response.payload)).toEqual(mockEvents);
      expect(app.log.info.calledWith('Cache HIT for all events')).toBe(true);
    });

    it('fetches and caches events when cache is empty', async () => {
      app.cache.get.returns(null);
      const response = await app.inject({ method: 'GET', url: '/' });
      expect(response.statusCode).toBe(200);
      expect(mockFetch.calledWith('http://event.com/getEvents')).toBe(true);
      expect(app.cache.set.calledWith('all-events', mockEvents, 3000000)).toBe(true);
    });

    it('handles fetch errors', async () => {
      app.cache.get.returns(null);
      mockFetch.resolves({
        ok: false,
        status: 500,
        statusText: 'Server Error'
      });
      const response = await app.inject({ method: 'GET', url: '/' });
      expect(response.statusCode).toBe(500);
      expect(app.log.error.calledWith(sinon.match.any, 'Failed to get EVENTS')).toBe(true);
    });
  });

  describe('POST /', () => {
    it('successfully adds an event', async () => {
      mockFetch.resolves({ ok: true, json: async () => newEvent });
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { name: 'New Event', date: '2023-02-01' }
      });
      expect(response.statusCode).toBe(200);
      expect(mockFetch.calledWith('http://event.com/addEvent', sinon.match.any)).toBe(true);
      expect(app.cache.del.calledWith('all-events')).toBe(true);
    });

    it('handles circuit breaker open state', async () => {
      mockFetch.resolves({ ok: false, status: 500, statusText: 'Server Error' });
      for (let i = 0; i < 4; i++) { // Exceed failureThreshold of 3
        await app.inject({
          method: 'POST',
          url: '/',
          payload: { name: 'New Event' }
        });
      }

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { name: 'New Event' }
      });
      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'Service Temporarily Unavailable',
        message: 'The event service is currently unavailable. Please try again later.',
        retryAfter: 30
      });
      expect(app.log.warn.calledWith('Circuit is open, returning service unavailable')).toBe(true);
    });

    it('handles general errors', async () => {
      mockFetch.resolves({ ok: false, status: 500, statusText: 'Server Error' });
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { name: 'New Event' }
      });
      expect(response.statusCode).toBe(500);
      expect(app.log.error.calledWith('Error adding event', sinon.match.any)).toBe(true);
    });
  });

  describe('GET /:id', () => {
    it('returns cached event when available', async () => {
      app.cache.get.returns(singleEvent);
      const response = await app.inject({ method: 'GET', url: '/1' });
      expect(response.statusCode).toBe(200);
      expect(mockFetch.called).toBe(false);
      expect(app.log.info.calledWith('Cache HIT for event 1')).toBe(true);
    });

    it('fetches event when cache is empty', async () => {
      app.cache.get.returns(null);
      mockFetch.resolves({ ok: true, json: async () => singleEvent });
      const response = await app.inject({ method: 'GET', url: '/1' });
      expect(response.statusCode).toBe(200);
      expect(mockFetch.calledWith('http://event.com/getEventById/event-1')).toBe(true);
      expect(app.cache.set.calledWith('event-1', singleEvent, 600000)).toBe(true);
    });

    it('handles fetch errors', async () => {
      app.cache.get.returns(null);
      mockFetch.resolves({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });
      const response = await app.inject({ method: 'GET', url: '/1' });
      expect(response.statusCode).toBe(500);
      expect(app.log.error.calledWith(sinon.match.any, 'Failed to get EVENT 1')).toBe(true);
    });
  });

  describe('GET /user/:id', () => {
    it('returns cached user events', async () => {
      app.cache.get.returns(mockEvents);
      const response = await app.inject({ method: 'GET', url: '/user/1' });
      expect(response.statusCode).toBe(200);
      expect(mockFetch.called).toBe(false);
      expect(app.log.info.calledWith('HIT CHACHE FOR USER 1')).toBe(true);
    });

    it('fetches user events when cache is empty', async () => {
      app.cache.get.returns(null);
      mockFetch.withArgs('http://event.com/getUserById/1').resolves({
        ok: true,
        json: async () => userData
      });
      mockFetch.withArgs('http://event.com/getEventById/event-1').resolves({
        ok: true,
        json: async () => mockEvents[0]
      });
      mockFetch.withArgs('http://event.com/getEventById/event-2').resolves({
        ok: true,
        json: async () => mockEvents[1]
      });
      const response = await app.inject({ method: 'GET', url: '/user/1' });
      expect(response.statusCode).toBe(200);
      expect(mockFetch.callCount).toBe(3);
      expect(app.cache.set.calledWith('events-user-1', mockEvents, 8640000)).toBe(true);
    });

    it('handles user fetch errors', async () => {
      app.cache.get.returns(null);
      mockFetch.resolves({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });
      const response = await app.inject({ method: 'GET', url: '/user/1' });
      expect(response.statusCode).toBe(500);
      expect(app.log.error.calledWith(sinon.match.any, 'Failed to get USER 1')).toBe(true);
    });

    it('handles event fetch errors in loop', async () => {
      app.cache.get.returns(null);
      mockFetch.withArgs('http://event.com/getUserById/1').resolves({
        ok: true,
        json: async () => userData
      });
      mockFetch.withArgs('http://event.com/getEventById/event-1').resolves({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });
      mockFetch.withArgs('http://event.com/getEventById/event-2').resolves({
        ok: true,
        json: async () => mockEvents[1]
      });
      const response = await app.inject({ method: 'GET', url: '/user/1' });
      expect(response.statusCode).toBe(500);
      expect(app.log.error.calledWith(sinon.match.any, 'Failed  to get USER 1 events')).toBe(true);
    });
  });

  describe('GET /circuit-status', () => {
    it('returns circuit breaker states', async () => {
      mockFetch.resolves({ ok: true, json: async () => newEvent });
      await app.inject({
        method: 'POST',
        url: '/',
        payload: { name: 'New Event' }
      });
      
      const response = await app.inject({ method: 'GET', url: '/circuit-status' });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('event-service-add');
    });
  });
});