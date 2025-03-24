module.exports = async function (app, opts) {
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
      app.cache.del('all-events'); // so that the event list is cleared
      reply.send(resp.json());
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