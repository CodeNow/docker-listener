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
   * @return {EventListener}     instance of EventListener
   */
  constructor (host, org) {
    this.host = host
    this.org = org
    this.type = this.org === null ? 'swarm' : 'docker'
    // https://docs.docker.com/engine/reference/api/docker_remote_api_v1.22/#monitor-docker-s-events
    this.events = (this.type === 'swarm')
      ? ['engine_connect', 'engine_disconnect']
      : ['create', 'start', 'die']
    this.events.push('top')
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

      this.timeout = setTimeout(() => {
        log.error('timeout getting events')
        this.handleClose(new Error('timeout getting events'))
      }, process.env.EVENT_TIMEOUT_MS)

      this.eventStream = eventStream
      this.eventStream
        .on('error', this.handleError.bind(this))
        .on('close', this.handleClose.bind(this, new Error('stream closed')))
        .on('end', this.handleClose.bind(this, new Error('stream ended')))
        .on('disconnect', this.handleClose.bind(this, new Error('stream disconnected')))
        .on('data', this.publishEvent.bind(this))
        .once('data', this.clearTimeout.bind(this))
        .once('readable', this.docker.testEvent.bind(this.docker))
    })
    .catch((err) => {
      log.error({ err: err }, 'error connecting to /events')
      throw err
    })
  }

  /**
   * clear timeout and emit connected event
   * @return {[type]} [description]
   */
  clearTimeout () {
    log.trace('clearTimeout - event data received, clear timeout')
    clearTimeout(this.timeout)
    rabbitmq.createConnectedJob(this.type, this.host, this.org)
  }

  /**
   * publish event to rabbit
   * @param  {Buffer} chunk from docker event stream
   */
  publishEvent (chunk) {
    if (!chunk) { return }
    chunk = chunk.toString()
    log.info({ chunk: chunk }, 'Listener.prototype.publishEvent')

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
    if (this.eventStream) {
      if (this.eventStream.destroy) {
        this.eventStream.destroy()
      }
      delete this.eventStream
      log.error({ err: err, host: this.host, type: this.type, org: this.org }, 'Listener.prototype.handleClose')
      errorCat.createAndReport(500, err ? err.message : 'unknown error', err)
      rabbitmq.createStreamConnectJob(this.type, this.host, this.org)
    }
  }
}
