/**
 * Export singleton instance hermes client
 * @module lib/hermes-client
 */
'use strict';

var log = require('./logger').getChild(__filename);

require('loadenv')();

if (process.env.RABBITMQ_HOSTNAME) {
  module.exports = require('runnable-hermes').hermesSingletonFactory({
    hostname: process.env.RABBITMQ_HOSTNAME,
    password: process.env.RABBITMQ_PASSWORD,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME,
    queues: [
      'create-image-builder-container',
      'create-instance-container',
      'delete-instance',
      'inspect-container',
      'on-image-builder-container-create',
      'on-image-builder-container-die',
      'on-image-builder-container-start',
      'on-instance-container-create',
      'on-instance-container-die',
      'on-instance-container-start',
      'restart-container',
      'start-image-builder-container',
      'start-instance-container',
      'stop-instance-container',
      'on-dock-unhealthy'
    ]
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
