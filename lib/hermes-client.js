/**
 * Export singleton instance hermes client
 * @module lib/hermes-client
 */
'use strict';

var log = require('./logger').getChild(__filename);

require('loadenv')({ debugName: 'docker-listener' });


var publishedEvents = [
  'container.life-cycle.died',
  'container.life-cycle.started',
  'docker.events-stream.connected',
  'docker.events-stream.disconnected'
];
if (process.env.RABBITMQ_HOSTNAME) {
  var Hermes = require('runnable-hermes');
  var opts = {
    name: 'docker-listener',
    heartbeat: 10,
    hostname: process.env.RABBITMQ_HOSTNAME,
    password: process.env.RABBITMQ_PASSWORD,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME,
    publishedEvents: publishedEvents,
    queues: [
      'on-instance-container-create',
      'on-instance-container-die',
      'on-image-builder-container-create',
      'on-image-builder-container-die'
    ]
  };
  // FIXME: add on error handler
  module.exports = new Hermes(opts).connect();
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
