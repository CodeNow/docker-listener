/**
 * Listen to Docker events and publish/proxy to Redis
 * @module lib/listener
 */
'use strict'
require('loadenv')({ debugName: 'docker-listener' })

var util = require('util')
var EventEmitter = require('events').EventEmitter

var log = require('./logger').getChild(__filename)
var datadog = require('./datadog')
var docker = require('./docker')
var ErrorCat = require('error-cat')
var status = require('./status')

var DatadogStream = datadog.stream
var datadogStream = new DatadogStream()
var errorCat = new ErrorCat()

function Listener (publisher) {
  if (!publisher.write) {
    throw new Error('publisher stream should be Writable')
  }
  EventEmitter.call(this)
  this.publisher = publisher
  this.dockerEventStream = null
}

util.inherits(Listener, EventEmitter)

module.exports = Listener

Listener.prototype.start = function () {
  log.info('Listener.prototype.start')
  // list of events emitted by docker:
  // create, destroy, die, exec_create, exec_start, export, kill, oom,
  // pause, restart, start, stop, unpause
  // https://docs.docker.com/reference/api/docker_remote_api_v1.17/#monitor-dockers-events
  docker.getEvents(function (err, eventStream) {
    log.trace({ err: err }, 'start: getEvents')
    if (err) {
      log.error({ err: err }, 'error connecting to /events')
      errorCat.createAndReport(500, 'Cannot connect to Docker /events', err)
      this.reconnect()
      return
    }
    status.docker_connected = true
    // successfully got stream
    this.dockerEventStream = eventStream

    eventStream
      .on('error', this.handleError.bind(this))
      .on('close', this.handleClose.bind(this))
      .on('data', this.publisher.write.bind(this.publisher))
      .on('data', datadogStream.write.bind(datadogStream))

    this.emit('started')
  }.bind(this))
}

/**
 * Close out streams.
 * We are not closing `publsiher` because it's used in `handleClose`.
 */
Listener.prototype.stop = function () {
  log.info('Listener.prototype.stop')
  if (this.dockerEventStream) {
    this.dockerEventStream.destroy()
  }
  status.docker_connected = false
  this.emit('stopped')
}

Listener.prototype.handleError = function (err) {
  log.error({ err: err }, 'stream error')
  errorCat.createAndReport(404, 'Docker streaming error', err)
  datadog.inc('error')
}

// send `docker.events-stream.disconnected` event
Listener.prototype.handleClose = function () {
  log.info('handleClose')
  // destroy stream where socket was closed
  this.dockerEventStream.destroy()
  this.dockerEventStream = null
  this.reconnect()
}

Listener.prototype.reconnect = function () {
  log.warn('Listener.prototype.reconnect')
  datadog.inc('reconnecting')
  this.start()
}
