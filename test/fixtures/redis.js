'use strict'
var redis = require('redis')

module.exports = function () {
  return redis.createClient(
    process.env.REDIS_PORT,
    process.env.REDIS_IPADDRESS,
    {
      detect_buffers: true
    })
}
