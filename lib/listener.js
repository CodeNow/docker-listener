/**
 * connect to docker streams and publish to rabbit
 * @module lib/listener
 */
'use strict'
require('loadenv')({ debugName: 'docker-listener' })

const Promise = require('bluebird')

const Docker = require('./docker')
const ErrorCat = require('error-cat')
const log = require('./logger')()
const rabbitmq = require('./rabbitmq')
const sinceMap = require('./since-map')

const errorCat = new ErrorCat()

module.exports = class EventListener {
  /**
   * setup EventListener
   * @param  {String} host       docker host to connect to format: 10.0.0.1:4242
   * @param  {String} org        github orgId of dock
   * @param  {Function} closeCb  callback to call when closed
   * @return {EventListener}     instance of EventListener
   */
  constructor (host, org, closeCb) {
    this.host = host
    this.type = org === null ? 'swarm' : 'dock'
    this.org = org
    // https://docs.docker.com/engine/reference/api/docker_remote_api_v1.22/#monitor-docker-s-events
    this.events = (this.type === 'swarm')
      ? ['engine_connect', 'engine_disconnect']
      : ['create', 'start', 'die']
    this.events.push('top')
    this.closeCb = closeCb
    this.docker = new Docker(this.host)
  }

  /**
   * connects to docker event stream and attaches handlers
   * @return {Promise}
   * @resolves nothing
   */
  start () {
    log.info('Listener.prototype.start')
    return Promise.try(() => {
      var opts = {
        filters: {
          event: this.events
        },
        since: sinceMap.get(this.host) || 0
      }
      return this.docker.getEvents(opts)
    })
    .then((eventStream) => {
      log.trace('start - got event stream')
      this.eventStream = eventStream
      this.eventStream
        .on('error', this.handleError.bind(this))
        .on('close', this.handleClose.bind(this, new Error('stream closed')))
        .on('end', this.handleClose.bind(this, new Error('stream ended')))
        .on('disconnect', this.handleClose.bind(this, new Error('stream disconnected')))
        .on('data', this.publishEvent.bind(this))
        .once('data', this.clearTimeout.bind(this))
        .once('readable', this.startTimeout.bind(this))
    })
    .catch((err) => {
      log.error({ err: err }, 'error connecting to /events')
      this.handleClose(err)
    })
  }
  /**
   * setup timeout and emit test event
   * this ensures we get events on the event stream
   */
  startTimeout () {
    log.trace('start - stream readable')
    // timeout is used to ensure we are getting events
    this.timeout = setTimeout(() => {
      log.error('timeout getting events')
      this.handleClose(new Error('timeout getting events'))
    }, process.env.EVENT_TIMEOUT_MS)
    this.docker.testEvent()
  }

  clearTimeout () {
    log.trace('start - event data received, clear timeout')
    clearTimeout(this.timeout)
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
      Host: this.host,
      org: this.org
    })
  }

  /**
   * reports stream error
   * @param  {Error} err stream error
   */
  handleError (err) {
    log.error({ err: err }, 'stream error')
    errorCat.createAndReport(500, 'Docker streaming error', err)
  }

  /**
   * destroy event stream and call closeCb
   * ensure closeCb is only called once
   * @param  {Error} err error to log before close
   */
  handleClose (err) {
    log.error({ err: err }, 'Listener.prototype.handleClose')
    errorCat.createAndReport(500, err ? err.message : 'unknown error', err)

    if (this.eventStream && this.eventStream.destroy) {
      this.eventStream.destroy()
      delete this.eventStream
    }

    if (this.closeCb) {
      var cb = this.closeCb
      delete this.closeCb
      cb()
    }
  }
}
