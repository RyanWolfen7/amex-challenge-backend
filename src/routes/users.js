module.exports = async function (app, opts) {
    app.get('/', async (req, reply) => {
        const cacheKey = 'all-users';
        const cachedData = app.cache.get(cacheKey);
        if (cachedData) {
            req.log.info(`Cache HIT for users`);
            return reply.send(cachedData);
        }
        const resp = await fetch('http://event.com/getUsers');
        if(!resp.ok) {
            req.log.error(resp, 'Failed to get users');
            return reply.code(resp.status).send({ error: resp.statusText });
        }
        const data = await resp.json();
        app.cache.set(cacheKey, data, 3000000); // 1.25 hr
        reply.send(data); 
    })

    app.get('/:id', async (req, reply) => {
        const { id } = req.params;
        const cacheKey = `user-${id}`;
        const cachedData = app.cache.get(cacheKey);
        if (cachedData) {
            req.log.info(`Cache HIT for user ${id}`);
            return reply.send(cachedData);
        }
        const resp = await fetch('http://event.com/getUserById/' + id);
        if(!resp.ok) {
            req.log.error(resp, `Failed to get user ${id}`);
            return reply.code(resp.status).send({ error: resp.statusText });
        }
        const data = await resp.json();
        app.cache.set(cacheKey, data, 3000000); // 1.25 hr
        reply.send(data); 
    })
}