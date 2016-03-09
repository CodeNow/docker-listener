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
var sinceMap = require('./sinceMap')

var errorCat = new ErrorCat()

module.exports = class EventListener {
  constructor (hostUrl, type, closeCb) {
    this.hostUrl = hostUrl
    this.type = type
    // https://docs.docker.com/engine/reference/api/docker_remote_api_v1.22/#monitor-docker-s-events
    this.events = (type === 'swarm')
      ? ['engine_connect', 'engine_disconnect']
      : ['create', 'start', 'die']
    this.events.push('top')
    this.closeCb = closeCb
  }

  start () {
    var self = this
    log.info('Listener.prototype.start')
    sinceMap.get(this.hostUrl).then(function (since) {
      var opts = {
        filters: {
          event: this.events
        }
      }
      if (since) {
        opts.since = since
      }
      return docker.getEvents(opts)
    })
    .then(function (eventStream) {
      log.trace('start - got event stream')

      eventStream
        .on('error', self.handleError.bind(self))
        .on('close', self.handleClose.bind(self))
        .on('disconnect', self.handleClose.bind(self))
        .on('data', self.publishEvent.bind(self))
        .once('data', self.clearTimeout.bind(self))
        .once('readable', function () {
          log.trace('start - stream readable')
          self.startTimeout()
          self.testEvent()
        })
    })
    .catch(function (err) {
      log.error({ err: err }, 'error connecting to /events')
      return self.handleClose(err)
    })
  }

  startTimeout () {
    var self = this
    // timeout is used to ensure we are getting events
    self.timeout = setTimeout(function () {
      log.error('timeout getting events')
      self.handleClose(new Error('timeout getting events'))
    }, process.env.EVENT_TIMEOUT_MS)
  }

  clearTimeout () {
    log.trace('start - event data received, clear timeout')
    clearTimeout(this.timeout)
  }

  /**
   * Do docker top on a random container.
   * This should emit the `top` event.
   * We ignore errors since we will restart if event failed
   * @param  {Function} cb [description]
   */
  testEvent () {
    log.info('Listener.prototype.testEvent')
    var listTimer = datadog.timer('listContainers.time')
    docker.listContainers({
      filters: {
        state: ['running']
      }
    })
    .then(function (containers) {
      listTimer.stop()
      if (isEmpty(containers)) {
        log.error('testEvent - no running containers found')
        throw errorCat.createAndReport(404, 'no running containers found')
      }

      log.trace({ container: containers[0].Id }, 'testEvent - got container')

      var topTimer = datadog.timer('top.time')
      return Promise.fromCallback(function (cb) {
        docker.getContainer(containers[0].Id).top(cb)
      })
      .then(function () {
        topTimer.stop()

        log.trace({ container: containers[0].Id }, 'testEvent - top successful')
      })
    })
    .catch(function (err) {
      log.error({ err: err }, 'testEvent - failed')
      errorCat.createAndReport(500, err.message, err)
    })
  }

  /**
   * publish event to rabbit
   * @param  {Buffer} chunk from docker event stream
   */
  publishEvent (chunk) {
    if (!chunk) { return }
    log.info({ chunk: chunk.toString() }, 'Listener.prototype.publishEvent')

    rabbitmq.createPublishJob({
      event: chunk,
      host: this.host,
      org: this.org
    })
  }

  /**
   * reports error
   * @param  {Object} err stream error
   */
  handleError (err) {
    log.error({ err: err }, 'stream error')
    errorCat.createAndReport(500, 'Docker streaming error', err)
  }

  /**
   * exit if we closed the socket
   * @param  {Object} err error to log before close
   */
  handleClose (err) {
    log.info('Listener.prototype.handleClose')
    errorCat.createAndReport(500, err.message, err)
    if (this.eventStream && this.eventStream.destory) {
      this.eventStream.destory()
    }
    this.closeCb()
  }
}
