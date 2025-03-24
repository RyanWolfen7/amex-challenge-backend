const fp = require('fastify-plugin');

const xssFilter = (app, opts, next) => {
	const DEFAULT_HEADER = '1; mode=block';
	const header = opts.reportUri ? `${DEFAULT_HEADER}; report=${opts.reportUri}` : DEFAULT_HEADER;

	app.addHook('onSend', (request, reply, payload, next) => {
		reply.header('X-Content-Type-Options', 'nosniff');
		reply.header('Content-Security-Policy', "default-src 'self'");
		if (opts.setOnOldIE) {
			reply.header('X-XSS-Protection', header);
		} else {
			const matches = /msie\s*(\d+)/i.exec(request.headers['user-agent']);
			const value = !matches || parseFloat(matches[1]) >= 9 ? header : '0';
			reply.header('X-XSS-Protection', value);
		}

		next();
	});

	next();
};

module.exports = fp(xssFilter, {
	fastify: '5.x',
	name: 'fastify-xss-filter'
});