module.exports = async function (app, opts) {
    app.get('/', async (req, reply) => {
        const resp = await fetch('http://event.com/getUsers');
        if(!resp.ok) req.log.error(resp, `Failed to get Users ${resp.statusText}`)
        const data = await resp.json();
        reply.send(data); 
    })

    app.get('/:id', async (req, reply) => {
        const { id } = req.params;
        const resp = await fetch('http://event.com/getUserById/' + id);
        if(!resp.ok) req.log.error(resp, `Failed to get User ${id}`)
        const data = await resp.json();
        reply.send(data); 
    })
}