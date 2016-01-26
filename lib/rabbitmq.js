/**
 * Export singleton instance hermes client
 * @module lib/rabbitmq
 */
'use strict'

var async = require('async')
var ip = require('ip')
var ErrorCat = require('error-cat')
var error = new ErrorCat()
var log = require('./logger').getChild(__filename)
var ponos = require('ponos')
var put = require('101/put')
var Hermes = require('runnable-hermes')

require('loadenv')({ debugName: 'docker-listener' })

var hostIp = ip.address()

module.exports = new RabbitMQ()

function RabbitMQ () {}

var publishedEvents = [
  'container.life-cycle.died',
  'container.life-cycle.started',
  'docker.events-stream.connected',
  'docker.events-stream.disconnected'
]

var dockerEventPublishQueue = hostIp.replace(/\./g, '-') + '.docker.event.publish'

var tasks = {}
tasks[dockerEventPublishQueue] = require('./workers/docker.event.publish.js')

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
    queues: [
      'on-instance-container-create',
      'on-instance-container-die',
      'on-image-builder-container-create',
      'on-image-builder-container-die',
      dockerEventPublishQueue
    ],
    publishedEvents: publishedEvents
  }, opts)).on('error', this._handleFatalError)
  this.subscriber = new Hermes(put({
    queues: [
      {
        name: dockerEventPublishQueue,
        opts: {
          expires: process.env.DOCKER_EVENT_PUBLISH_TTL
        }
      }
    ]
  }, opts)).on('error', this._handleFatalError)
  this.ponosServer = new ponos.Server({
    hermes: this.subscriber,
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

RabbitMQ.prototype.publish = function (name, data) {
  var logData = {
    name: name,
    data: data
  }
  log.info(logData, 'RabbitMQ.prototype.publish')
  if (this.publisher) {
    this.publisher.publish(name, data)
  }
}

RabbitMQ.prototype.createPublishJob = function (data) {
  log.info('RabbitMQ.prototype.createPublishJob')
  this.publish(dockerEventPublishQueue, data)
}

/**
 * reports errors on clients
 */
RabbitMQ.prototype._handleFatalError = function (err) {
  log.error({ err: err }, '_handleFatalError')
  throw error.createAndReport(502, 'RabbitMQ error', err)
}
