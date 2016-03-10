/**
 * Export singleton instance hermes client
 * @module lib/rabbitmq
 */
'use strict'
require('loadenv')()

var async = require('async')
var ErrorCat = require('error-cat')
var Hermes = require('runnable-hermes')
var ponos = require('ponos')
var put = require('101/put')

var logger = require('./logger')

var error = new ErrorCat()
var log = logger()

module.exports = new RabbitMQ()

function RabbitMQ () {}

var publishedEvents = [
  'container.life-cycle.died',
  'container.life-cycle.started',
  'docker.events-stream.connected',
  'docker.events-stream.disconnected',
  'swarm.events-stream.connected'
]

var subscribedEvents = [
  'swarm.events-stream.connected'
]

var publishedQueues = [
  'docker.events-stream.connect',
  'docker.event.publish',
  'on-image-builder-container-create',
  'on-image-builder-container-die',
  'on-instance-container-create',
  'on-instance-container-die',
  'swarm.events-stream.connect'
]

var subscribedQueues = [
  'docker.events-stream.connect',
  'docker.event.publish',
  'swarm.events-stream.connect'
]

var tasks = {
  'docker.event.publish': require('./workers/docker.event.publish.js'),
  'docker.events-stream.connect': require('./workers/docker.events-stream.connect.js'),
  'swarm.events-stream.connect': require('./workers/swarm.events-stream.connect.js'),
  'swarm.events-stream.connected': require('./workers/swarm.events-stream.connected.js')
}

var opts = {
  name: 'docker-listener',
  heartbeat: 10,
  hostname: process.env.RABBITMQ_HOSTNAME,
  password: process.env.RABBITMQ_PASSWORD,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USERNAME
}

RabbitMQ.prototype.connect = function (cb) {
  log.info('RabbitMQ.prototype.connect')
  this.publisher = new Hermes(put({
    queues: publishedQueues,
    publishedEvents: publishedEvents
  }, opts)).on('error', this._handleFatalError)

  this.subscriber = new Hermes(put({
    queues: subscribedQueues,
    subscribedEvents: subscribedEvents
  }, opts)).on('error', this._handleFatalError)

  this.ponosServer = new ponos.Server({
    hermes: this.subscriber,
    log: logger.logger.child({ module: 'ponos:server' }),
    queues: Object.keys(tasks)
  })

  this.ponosServer.setAllTasks(tasks)
  var startTasks = [
    this.publisher.connect.bind(this.publisher),
    this.subscriber.connect.bind(this.subscriber)
  ]
  async.series(startTasks, function (err) {
    if (err) {
      return cb(err)
    }
    this.ponosServer.start().asCallback(cb)
  }.bind(this))
}

RabbitMQ.prototype.close = function (cb) {
  log.info('RabbitMQ.prototype.close')
  var tasks = []
  if (this.publisher) {
    tasks.push(this.publisher.close.bind(this.publisher))
  }
  if (this.subscriber) {
    tasks.push(this.subscriber.close.bind(this.publisher))
  }
  async.series(tasks, function (err) {
    if (err) {
      return cb(err)
    }
    if (this.ponosServer) {
      return this.ponosServer.stop().asCallback(cb)
    }
    cb()
  }.bind(this))
}

RabbitMQ.prototype.publish = function (name, job) {
  log.info({ queue: name, job: job }, 'RabbitMQ.prototype.publish')
  this.publisher.publish(name, job)
}

RabbitMQ.prototype.createPublishJob = function (job) {
  this.publish('docker.event.publish', job)
}

/**
 * send swarm or docker events stream connected job
 * @param  {String} type swarm / docker
 * @param  {String} host format: 10.0.0.1:4242
 * @param  {String} org  github orgId
 */
RabbitMQ.prototype.createConnectedJob = function (type, host, org) {
  // we need to send tags for backwards compatibility
  // also host needs to have http://
  this.publish(type + '.events-stream.connected', {
    host: 'http://' + host,
    org: org,
    tags: org
  })
}

/**
 * send swarm or docker events stream connected job
 * @param  {String} type swarm / docker
 * @param  {String} host format: 10.0.0.1:4242
 * @param  {String} org  github orgId
 */
RabbitMQ.prototype.createStreamConnectJob = function (type, host, org) {
  this.publish(type + '.events-stream.connect', {
    host: host,
    org: org
  })
}

/**
 * reports errors on clients
 */
RabbitMQ.prototype._handleFatalError = function (err) {
  log.error({ err: err }, '_handleFatalError')
  throw error.createAndReport(502, 'RabbitMQ error', err)
}
