const pino = require('pino');

const loggerConfig = {
  base: {
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    level: 'info',
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: ['req.headers.authorization', '*.password', '*.secret', '*.token'],
      censor: '[REDACTED]',
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: req.headers,
        hostname: req.hostname,
        remoteAddress: req.ip
      
      }),
      res: (res) => ({
          statusCode: res.statusCode,
        
      }),
      err: pino.stdSerializers.err,
    },
  },
  dev: {
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    }
  },
  prod: true,
  test: false
}

const createLogger = (env = 'prod') => {
  const isDev = env === 'dev';
  const config = {
    ...loggerConfig.base,
    ...(isDev ? loggerConfig.dev : {}),
  };
  return pino(config);
}

module.exports = { createLogger };
