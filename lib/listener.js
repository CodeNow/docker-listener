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
var errorCat = new ErrorCat()
var status = require('./status')

var DatadogStream = datadog.stream

function Listener (publisher) {
  if (!publisher.write) {
    throw new Error('publisher stream should be Writable')
  }
  EventEmitter.call(this)
  this.publisher = publisher
  this.dockerEventStream = null
  this.manualClose = false
}

util.inherits(Listener, EventEmitter)

module.exports = Listener

Listener.prototype.start = function () {
  // list of events emitted by docker:
  // create, destroy, die, exec_create, exec_start, export, kill, oom,
  // pause, restart, start, stop, unpause
  // https://docs.docker.com/reference/api/docker_remote_api_v1.17/#monitor-dockers-events
  docker.getEvents(function (err, eventStream) {
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
      .pipe(this.publisher, { end: false }) // we don't want to close publisher stream
    // timeout is necessary else api tests timeout... 120s is default
    eventStream.socket.setTimeout(process.env.EVENTS_SOCKET_TIMEOUT)
    // pipe events to the datadog
    eventStream.pipe(new DatadogStream(), {end: false})
    this.emit('started')
  }.bind(this))
}

/**
 * Close out streams.
 * We are not closing `publsiher` because it's used in `handleClose`.
 */
Listener.prototype.stop = function () {
  if (this.dockerEventStream) {
    this.manualClose = true
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
  if (this.manualClose) { return }
  this.manualClose = false
  // destroy stream where socket was closed
  this.dockerEventStream.destroy()
  this.dockerEventStream = null
  this.reconnect()
}

Listener.prototype.reconnect = function () {
  if (process.env.AUTO_RECONNECT === 'true') {
    setTimeout(function () {
      this.start()
      log.info('start reconnect')
      datadog.inc('reconnecting')
    }.bind(this), process.env.DOCKER_REMOTE_API_RETRY_INTERVAL)
  }
}
