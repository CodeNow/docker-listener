/**
 * Export singleton instance hermes client
 * @module lib/hermes-client
 */
'use strict';

var log = require('./logger').getChild(__filename);

require('loadenv')();

if (process.env.RABBITMQ_HOSTNAME) {
  module.exports = require('hermes-private').hermesSingletonFactory({
    hostname: process.env.RABBITMQ_HOSTNAME,
    password: process.env.RABBITMQ_PASSWORD,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME,
  }).connect();
}
else {
  // allow rabbitmq functionality to be stopped
  module.exports.publish = function (targetQueue, data) {
    log.trace({
      targetQueue: targetQueue,
      data: data
    }, 'publish stubbed');
  };
}
