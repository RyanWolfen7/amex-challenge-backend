module.exports = async function (app, opts) {
  app.get('/', async (req, reply) => {
    const resp = await fetch('http://event.com/getEvents');
    if (!resp.ok) req.log.error(resp, `Failed to get EVENTS`)
    const data = await resp.json();
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
      reply.send(resp.json());
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params;
    const event = await fetch('http://event.com/getEventById/' + "event-" + id);
    if (!event.ok) req.log.error(event, `Failed to get EVENT ${id}`)
    const data = await event.json();
    reply.send(data);
  })

  app.get('/user/:id', async (req, reply) => {
    const { id } = req.params;
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
    reply.send(eventArray);
  });
}