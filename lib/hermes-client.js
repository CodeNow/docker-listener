/**
 * Export singleton instance hermes client
 * @module lib/hermes-client
 */
'use strict';

var log = require('./logger').getChild(__filename);

require('loadenv')();


var publishedEvents = [
  'container.life-cycle.died',
  'container.life-cycle.started'
];
if (process.env.RABBITMQ_HOSTNAME) {
  var Hermes = require('runnable-hermes');
  var opts = {
    name: 'docker-listener',
    heartbeat: 10,
    hostname: process.env.RABBITMQ_HOSTNAME,
    password: process.env.RABBITMQ_PASSWORD,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME
  };
  opts.publishedEvents = publishedEvents;
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
