/**
 * Export singleton instance hermes client
 * @module lib/rabbitmq
 */
'use strict'

var async = require('async')
var ErrorCat = require('error-cat')
var error = new ErrorCat()
var log = require('./logger').getChild(__filename)
var ponos = require('ponos')
var put = require('101/put')
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
}

RabbitMQ.prototype.connect = function (cb) {
  this.publisher = new Hermes(put({
    queues: [
      'on-instance-container-create',
      'on-instance-container-die',
      'on-image-builder-container-create',
      'on-image-builder-container-die',
      'docker.event.publish'
    ],
    publishedEvents: publishedEvents
  }, opts)).on('error', this._handleFatalError)
  this.subscriber = new Hermes(put({
    queues: [
      'docker.event.publish'
    ]
  }, opts)).on('error', this._handleFatalError)
  this.ponosServer = new ponos.Server({
    hermes: this.subscriber,
    queues: Object.keys(tasks)
  })
  this.ponosServer.setAllTasks(tasks)
  var startPromise = this.ponosServer.start()
  var startTasks = [
    this.publisher.connect.bind(this.publisher),
    this.subscriber.connect.bind(this.subscriber),
    startPromise.asCallback.bind(startPromise)
  ]
  async.series(startTasks, cb)
}

RabbitMQ.prototype.close = function (cb) {
  var tasks = []
  if (this.publisher) {
    tasks.push(this.publisher.close.bind(this.publisher))
  }
  if (this.subscriber) {
    tasks.push(this.subscriber.close.bind(this.publisher))
  }
  if (this.ponosServer) {
    var stopPromise = this.ponosServer.stop()
    tasks.push(stopPromise.asCallback.bind(stopPromise))
  }
  async.series(tasks, cb)
}

RabbitMQ.prototype.publish = function (name, data) {
  if (this.publisher) {
    this.publisher.publish(name, data)
  }
}

/**
 * reports errors on clients
 */
RabbitMQ.prototype._handleFatalError = function (err) {
  log.error({ err: err }, '_handleFatalError')
  throw error.createAndReport(502, 'RabbitMQ error', err)
}
