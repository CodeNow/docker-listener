/**
 * Export singleton instance hermes client
 * @module lib/rabbitmq
 */
'use strict';

var ErrorCat = require('error-cat');
var error = new ErrorCat();
var log = require('./logger').getChild(__filename);

require('loadenv')({ debugName: 'docker-listener' });


var publishedEvents = [
  'container.life-cycle.died',
  'container.life-cycle.started',
  'docker.events-stream.connected',
  'docker.events-stream.disconnected'
];
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
module.exports = new RabbitMQ();

function RabbitMQ () {}

RabbitMQ.prototype.connect = function (cb) {
  this.rabbit = new Hermes(opts)
    .on('error', this._handleFatalError)
    .connect(cb);
}

RabbitMQ.prototype.close = function (cb) {
  if (this.rabbit) {
    return this.rabbit.close(cb);
  }
  cb();
}

RabbitMQ.prototype.publish = function (name, data) {
  if (this.rabbit) {
    this.rabbit.publish(name, data);
  }
}

/**
 * reports errors on clients
 */
RabbitMQ.prototype._handleFatalError = function (err) {
  log.error({ err: err }, '_handleFatalError');
  throw error.createAndReport(502, 'RabbitMQ error', err);
};
