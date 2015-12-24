/**
 * Export singleton instance hermes client
 * @module lib/rabbitmq
 */
'use strict'

var callbackCount = require('callback-count')
var ErrorCat = require('error-cat')
var error = new ErrorCat()
var log = require('./logger').getChild(__filename)
var ponos = require('ponos')
var Hermes = require('runnable-hermes')

require('loadenv')({ debugName: 'docker-listener' })


module.exports = new RabbitMQ()

function RabbitMQ () {}

var publishedEvents = [
  'container.life-cycle.died',
  'container.life-cycle.started',
  'docker.events-stream.connected',
  'docker.events-stream.disconnected'
]

var tasks = {
  'docker.event.publish': require('./workers/docker.event.publish.js')
}

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
    'on-image-builder-container-die',
    'docker.event.publish'
  ]
}

RabbitMQ.prototype.connect = function (cb) {
  var count = callbackCount(2, cb)
  this.rabbit = new Hermes(opts).on('error', this._handleFatalError)
  this.rabbit.connect(count.next)
  this.ponosServer =  new ponos.Server({
    hermes: this.rabbit,
    queues: Object.keys(tasks)
  })
  this.ponosServer.setAllTasks(tasks)
  this.ponosServer.start().asCallback(count.next)
}

RabbitMQ.prototype.close = function (cb) {
  var count = callbackCount(cb)
  if (this.rabbit) {
    return this.rabbit.close(count.inc().next)
  }
  if (this.ponosServer) {
    this.ponosServer.stop().asCallback(count.inc().next)
  }
}

RabbitMQ.prototype.publish = function (name, data) {
  if (this.rabbit) {
    this.rabbit.publish(name, data)
  }
}

/**
 * reports errors on clients
 */
RabbitMQ.prototype._handleFatalError = function (err) {
  log.error({ err: err }, '_handleFatalError')
  throw error.createAndReport(502, 'RabbitMQ error', err)
}
