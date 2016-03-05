/**
 * Listen to Docker events and publish/proxy to Redis
 * @module lib/listener
 */
'use strict'
require('loadenv')({ debugName: 'docker-listener' })

var docker = require('./docker')
var ErrorCat = require('error-cat')
var log = require('./logger')()
var rabbitmq = require('./rabbitmq')
var status = require('./status')

var errorCat = new ErrorCat()

function Listener () {}

module.exports = Listener

Listener.prototype.start = function (cb) {
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
      .on('data', this.publishEvent.bind(this))

    cb()
  }.bind(this))
}

/**
 * publish event to rabbit
 * @param  {Buffer} chuck from docker event stream
 */
Listener.prototype.publishEvent = function (chuck) {
  if (chuck) { return }
  log.info({ chuck: chuck.toString() }, 'Listener.prototype.publishEvent')

  status.count_events = status.count_events + 1
  status.last_event_time = new Date().toISOString()
  rabbitmq.createPublishJob(chuck)
}

/**
 * reports error
 * @param  {Object} err stream error
 */
Listener.prototype.handleError = function (err) {
  log.error({ err: err }, 'stream error')
  errorCat.createAndReport(404, 'Docker streaming error', err)
}

/**
 * exit if we closed the socket
 */
Listener.prototype.handleClose = function () {
  log.info('handleClose')
  process.exit(1)
}
