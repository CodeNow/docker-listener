/**
 * create shared instance of redis client class
 * @module lib/redis-client
 */
'use strict';

var redis = require('redis');

module.exports = redis.createClient(
  process.env.REDIS_PORT,
  process.env.REDIS_IPADDRESS,
  {
    detect_buffers: true
  });
