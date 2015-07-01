'use strict';

var bunyan = require('bunyan');

/**
 * Bunyan logger for docker-listener.
 * @author Ryan Sandor Richards
 * @module docker-listener:logger
 */
module.exports = bunyan.createLogger({
  name: 'docker-listener',
  streams: [
    {
      level: process.env.LOG_LEVEL,
      stream: process.stdout
    }
    /*
    {
      type: 'raw',
      level: process.env.LOG_REDIS_LEVEL,
      stream: new RedisTransport({
        container: process.env.LOG_REDIS_KEY,
        host: process.env.LOG_REDIS_HOST,
        port: process.env.LOG_REDIS_PORT
      })
    }
    */
  ],
  serializers: bunyan.stdSerializers
});
