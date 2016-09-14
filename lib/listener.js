'use strict'
require('loadenv')()

const equals = require('101/equals')
const errorCat = require('error-cat')
const isString = require('101/is-string')
const Promise = require('bluebird')
const uuid = require('node-uuid')
const Warning = require('error-cat/errors/warning')

const Docker = require('./docker')
const Swarm = require('./swarm')
const logger = require('./logger')
const rabbitmq = require('./rabbitmq')
const sinceMap = require('./since-map')
const datadog = require('./datadog')
const dockerUtils = require('./docker-utils')

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
      ? ['engine_connect']
      : ['create', 'start', 'die']
    this.docker = this.host === process.env.SWARM_HOST
      ? new Swarm(this.host) : new Docker(this.host)
    this.log = logger({
      host: this.host,
      org: this.org,
      type: this.type,
      state: this.state
    })
    this.state = 'connecting'
  }

  /**
   * connects to docker event stream and attaches handlers
   * @return {Promise}
   * @resolves nothing
   */
  start () {
    this.log.info('Listener.prototype.start')
    return this.docker.getEventsAsync({
      filters: {
        event: this.events
      },
      since: sinceMap.get(this.host) || 0
    })
    .catch((error) => {
      this.state = 'disconnected'
      throw new Warning('Failed to get events', { err: error })
    })
    .then((eventStream) => {
      this.log.trace('start - got event stream')
      datadog.incMsg('stream.connect', this.host, this.org)

      this.eventStream = eventStream
      this.eventStream
        .on('error', this.handleError.bind(this))
        .on('close', this.handleClose.bind(this, new Warning('stream closed')))
        .on('end', this.handleClose.bind(this, new Warning('stream ended')))
        .on('disconnect', this.handleClose.bind(this, new Warning('stream disconnected')))
        .on('data', this.publishEvent.bind(this))

      return this.setTimeout()
    })
  }

  /**
   * we test to see if the stream is connected
   * 1. start timeout
   * 2. if we get data, clear timeout and stay connected
   * @returns {Promise}
   * @resolve {undefined} when stream connected
   * @rejects {Error}     when stream failed to get event in time
   */
  setTimeout () {
    return new Promise((resolve) => {
      this.eventStream
        .once('data', () => {
          datadog.incMsg('stream.connected', this.host, this.org)
          this.state = 'connected'
          this.log.trace('setTimeout - event data received, clear timeout')
          rabbitmq.createConnectedJob(this.type, this.host, this.org)
          resolve()
        })

      dockerUtils.testEvent(this.docker)
    })
    .timeout(process.env.EVENT_TIMEOUT_MS)
    .catch(Promise.TimeoutError, (err) => {
      this._destroyEventStream(err)
      this.log.error('setTimeout - timeout getting events')
      throw new Error('timeout getting events')
    })
  }

  /**
   * publish event to rabbit
   * @param  {Buffer} event from docker event stream
   */
  publishEvent (event) {
    if (!event) { return }
    this.log.trace('Listener.prototype.publishEvent')
    try {
      event = JSON.parse(event)
    } catch (err) {
      return this.log.error({ err: err, event: event.toString() }, 'publishEvent - error parsing logs')
    }
    this.log.trace({ event: event }, 'Listener.prototype.publishEvent')

    if (this.isBlacklisted(event)) {
      // do nothing
      return this.log.trace({ event: event }, 'publishEvent - event ignored')
    }

    const job = this.formatEvent(event)
    rabbitmq.createPublishJob(job)
  }

  /**
   * add extra fields to event
   * @param {Object} event event from docker
   * @return {Object} event with required data
   */
  formatEvent (event) {
    event.Host = this.host
    event.org = this.org
    event.uuid = uuid.v1()

    if (this.type === 'swarm') {
      event.org = event.node.Name.split('.')[1]
      event.Host = event.node.Addr
      event.id = event.uuid
    }

    event.ip = event.Host.split(':')[0]
    event.dockerPort = event.Host.split(':')[1]
    // keep tags for legacy reasons
    event.tags = event.org
    const dockerUrl = Docker.toDockerUrl(event.Host)

    // we expose one value as two results for compatibility reasons
    event.host = dockerUrl
    event.dockerUrl = dockerUrl
    // we only need to inspect build and runnable containers
    // build containers are from: registry.runnable.com runnable from: localhost
    event.needsInspect = this.eventOnList(event, process.env.IMAGE_INSPECT_LIST)
    this.log.trace({ event: event }, 'Listener.prototype.formatEvent')
    return event
  }

  /**
   * ignore events from blacklisted containers
   * ignore filtered events
   * @param {Object} event event from docker
   * @return {Boolean}     true if on blacklist
   */
  isBlacklisted (event) {
    const isFiltered = this.events.some(equals(event.status))
    if (!isFiltered) { return true }

    return this.eventOnList(event, process.env.IMAGE_BLACKLIST)
  }

  /**
   * should return true if event from image is on the list
   * @param {Object} event event from docker
   * @param {String} list  list to search in
   */
  eventOnList (event, list) {
    this.log.trace({ event: event, list: list }, 'eventOnList')
    if (!event || !isString(event.from)) { return false }
    return list.split(',').some((item) => {
      return ~event.from.indexOf(item)
    })
  }

  /**
   * reports stream error
   * @param  {Error} err stream error
   */
  handleError (err) {
    datadog.incMsg('stream.error', this.host, this.org)
    this.log.error({ err: err }, 'stream error')
    const streamError = new Error('Docker streaming error')
    errorCat.report(streamError, { err: err })
  }

  /**
   * destroy event stream and call closeCb
   * ensure closeCb is only called once
   * @param  {Error} err error to log before close
   */
  handleClose (err) {
    this.log.error({ err: err }, 'Listener.prototype.handleClose')
    // only emit connect job if we were connected before
    if (this.state === 'connected') {
      rabbitmq.createStreamConnectJob(this.type, this.host, this.org)
    }
    this._destroyEventStream(err)
  }

  /**
   * @param {Error} err
   * @return {undefined}
   */
  _destroyEventStream (err) {
    if (this.eventStream && this.eventStream.destroy) {
      this.eventStream.destroy()
    }
    delete this.eventStream
    this.state = 'disconnected'
    datadog.incMsg('stream.closed', this.host, this.org)
    errorCat.report(err)
  }

  /**
   * checks if stream is disconnected
   * @return {Boolean} true if stream is disconnected
   */
  isDisconnected () {
    return this.state === 'disconnected'
  }
}
