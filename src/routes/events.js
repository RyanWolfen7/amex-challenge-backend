const createCircuitBreaker = require('../utils/circutBreaker');

module.exports = async function (app, opts) {

  const circuitBreaker = createCircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    maxRetries: 3,
    initialBackoff: 1000, // 1 second
    maxBackoff: 10000, // 10 seconds
    logger: app.log
  });

  app.decorate('circuitBreaker', circuitBreaker);
  app.get('/circuit-status', async () => (circuitBreaker.getAllStates()));

  app.get('/', async (req, reply) => {
    const cachedEvents = app.cache.get('all-events');
    if (cachedEvents) {
      req.log.info('Cache HIT for all events');
      return reply.send(cachedEvents);
    }

    const resp = await fetch('http://event.com/getEvents');
    if (!resp.ok) req.log.error(resp, `Failed to get EVENTS`)
    const data = await resp.json();
    app.cache.set('all-events', data, 3000000); // 1.25 hr
    reply.send(data);
  })

  app.post('/', async (req, reply) => {
    try {
      const data = await circuitBreaker.execute('event-service-add', async () => {
        const resp = await fetch('http://event.com/addEvent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: new Date().getTime(),
            ...req.body
          })
        });
        if (!resp.ok) req.log.error(`External API error: ${resp.status} ${errorText}`)
        return await resp.json();
      });
      app.cache.del('all-events'); // so that cache for events is cleared on update
      return data;
    } catch (err) {
      if (err.message.includes('Circuit is OPEN')) {
        req.log.warn('Circuit is open, returning service unavailable');
        return reply.status(503).send({
          error: 'Service Temporarily Unavailable',
          message: 'The event service is currently unavailable. Please try again later.',
          retryAfter: 30
        });
      }

      req.log.error('Error adding event', err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to add event'
      });
    }
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params;
    const cacheKey = `event-${id}`;
    const cachedEvent = app.cache.get(cacheKey);
    if (cachedEvent) {
      req.log.info(`Cache HIT for event ${id}`);
      return reply.send(cachedEvent);
    }

    const event = await fetch('http://event.com/getEventById/' + "event-" + id);
    if (!event.ok) req.log.error(event, `Failed to get EVENT ${id}`)
    const data = await event.json();
    app.cache.set(cacheKey, data, 600000); // 10m
    reply.send(data);
  })

  app.get('/user/:id', async (req, reply) => {
    const { id } = req.params;
    const cacheKey = `events-user-${id}`;
    const cache = app.cache.get(cacheKey)
    if (cache) {
      req.log.info(`HIT CHACHE FOR USER ${id}`);
      return reply.send(cache);
    }

    const user = await fetch('http://event.com/getUserById/' + id);
    if (!user.ok) req.log.error(user, `Failed to get USER ${id}`)

    const userData = await user.json();
    const userEvents = userData.events;
    const eventArray = [];

    for (let i = 0; i < userEvents.length; i++) {
      const event = await fetch('http://event.com/getEventById/' + userEvents[i]);
      if (!event.ok) req.log.error(event, `Failed  to get USER ${id} events`)
      const eventData = await event.json();
      eventArray.push(eventData);
    }
    app.cache.set(cacheKey, eventArray, 8640000); // 24h
    reply.send(eventArray);
  });
}