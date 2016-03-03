/**
 * Listen to Docker events and publish/proxy to Redis
 * @module lib/listener
 */
'use strict'
require('loadenv')({ debugName: 'docker-listener' })

var util = require('util')
var EventEmitter = require('events').EventEmitter

var log = require('./logger')()
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
    if (err) {
      log.error({ err: err }, 'error connecting to /events')
      return errorCat.createAndReport(500, 'Cannot connect to Docker /events', err, this.handleClose)
    }
    log.trace('start: got event stream')

    status.docker_connected = true

    eventStream
      .on('error', this.handleError.bind(this))
      .on('close', this.handleClose.bind(this))
      .on('data', this.publisher.write.bind(this.publisher))
      .on('data', datadogStream.write.bind(datadogStream))

    this.emit('started')
  }.bind(this))
}

/**
 * Emit stopped event
 */
Listener.prototype.stop = function () {
  log.info('Listener.prototype.stop')
  status.docker_connected = false
  this.emit('stopped')
}

Listener.prototype.handleError = function (err) {
  log.error({ err: err }, 'stream error')
  errorCat.createAndReport(404, 'Docker streaming error', err)
  datadog.inc('error')
}

/**
 * exit if we closed the socket
 */
Listener.prototype.handleClose = function () {
  log.info('handleClose')
  process.exit(1)
}
