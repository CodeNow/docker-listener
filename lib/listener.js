/**
 * Listen to Docker events and publish/proxy to Redis
 * @module lib/listener
 */
'use strict'
require('loadenv')({ debugName: 'docker-listener' })

var isEmpty = require('101/is-empty')

var datadog = require('./datadog')
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

    // timeout is used to ensure we are getting events
    var timeout = setTimeout(this.handleClose, process.env.EVENT_TIMEOUT)

    eventStream
      .on('error', this.handleError.bind(this))
      .on('close', this.handleClose.bind(this))
      .on('data', this.publishEvent.bind(this))
      .once('data', function () {
        clearTimeout(timeout)
      })

    this.testEvent(cb)
  }.bind(this))
}

/**
 * Do docker top on a random container.
 * This should emit the `top` event.
 * We ignore errors since we will restart if event failed
 * @param  {Function} cb [description]
 */
Listener.prototype.testEvent = function (cb) {
  log.info('Listener.prototype.testEvent')
  var listTimer = datadog.timer('listContainers.time')
  docker.listContainers({
    limit: 1,
    filters: {
      state: ['running']
    }
  }, function (err, containers) {
    listTimer.stop()
    if (err) {
      log.error({ err: err }, 'testEvent - failed to list containers')
      errorCat.createAndReport(500, 'failed to list containers', err)
      return cb()
    }
    if (isEmpty(containers)) {
      log.error('testEvent - no running containers found')
      errorCat.createAndReport(404, 'no running containers found', err)
      return cb()
    }
    log.trace({ container: containers[0].Id }, 'testEvent - got container')
    var topTimer = datadog.timer('top.time')
    docker.getContainer(containers[0].Id).top(function (err) {
      topTimer.stop()
      if (err) {
        log.error({ container: containers[0] }, 'testEvent - failed to run top')
        errorCat.createAndReport(500, 'failed to run top', err)
      }
      log.trace({ container: containers[0].Id }, 'testEvent - top successful')
      return cb()
    })
  })
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
