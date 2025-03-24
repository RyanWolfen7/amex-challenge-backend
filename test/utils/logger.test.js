const { createLogger } = require('../../src/utils/logger');
const realPino = require('pino');

describe('Logger - createLogger utility', () => {
  let pinoSpy;

  beforeEach(() => {
    // Create a mock that preserves stdSerializers
    pinoSpy = jest.fn((config) => realPino(config));
    pinoSpy.stdSerializers = realPino.stdSerializers;
    jest.doMock('pino', () => pinoSpy);
    jest.resetModules();
    const { createLogger: freshCreateLogger } = require('../../src/utils/logger');
    createLoggerSpy = freshCreateLogger;
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.dontMock('pino');
  });

  let createLoggerSpy;

  it('should create a dev logger with correct config', () => {
    const logger = createLoggerSpy('dev');
    
    expect(pinoSpy).toHaveBeenCalledTimes(1);
    const config = pinoSpy.mock.calls[0][0];
    
    expect(config.level).toBe('debug');
    expect(config.transport).toBeDefined();
    expect(config.transport.target).toBe('pino-pretty');
    expect(config.transport.options.translateTime).toBe('HH:MM:ss Z');
    expect(config.transport.options.ignore).toBe('pid,hostname');
  });
  
  it('should create a prod logger with correct config', () => {
    const logger = createLoggerSpy('prod');
    
    expect(pinoSpy).toHaveBeenCalledTimes(1);
    const config = pinoSpy.mock.calls[0][0];
    
    expect(config.level).toBe('info');
    expect(config.transport).toBeUndefined();
  });
  
  it('should default to prod if no env is specified', () => {
    const logger = createLoggerSpy();
    
    expect(pinoSpy).toHaveBeenCalledTimes(1);
    const config = pinoSpy.mock.calls[0][0];
    
    expect(config.level).toBe('info');
    expect(config.transport).toBeUndefined();
  });
  
  it('should correctly configure serializers', () => {
    const logger = createLoggerSpy();
    
    const config = pinoSpy.mock.calls[0][0];
    
    expect(config.serializers.req).toBeDefined();
    expect(config.serializers.res).toBeDefined();
    expect(config.serializers.err).toBe(realPino.stdSerializers.err);
    
    const reqSerializer = config.serializers.req;
    const mockReq = {
      method: 'GET',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      hostname: 'localhost',
      ip: '127.0.0.1'
    };
    
    const serializedReq = reqSerializer(mockReq);
    expect(serializedReq.method).toBe('GET');
    expect(serializedReq.url).toBe('/test');
    expect(serializedReq.headers).toEqual(mockReq.headers);
    expect(serializedReq.hostname).toBe('localhost');
    expect(serializedReq.remoteAddress).toBe('127.0.0.1');
    
    const resSerializer = config.serializers.res;
    const mockRes = { statusCode: 200 };
    
    const serializedRes = resSerializer(mockRes);
    expect(serializedRes.statusCode).toBe(200);
  });
  
  it('should apply redaction', () => {
    const logger = createLoggerSpy();
    
    const config = pinoSpy.mock.calls[0][0];
    
    expect(config.redact).toBeDefined();
    expect(config.redact.paths).toContain('req.headers.authorization');
    expect(config.redact.paths).toContain('*.password');
    expect(config.redact.paths).toContain('*.secret');
    expect(config.redact.paths).toContain('*.token');
    expect(config.redact.censor).toBe('[REDACTED]');
  });
});