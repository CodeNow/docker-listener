'use strict'
require('loadenv')()

const equals = require('101/equals')
const ErrorCat = require('error-cat')
const Promise = require('bluebird')
const uuid = require('node-uuid')

const Docker = require('./docker')
const logger = require('./logger')
const rabbitmq = require('./rabbitmq')
const sinceMap = require('./since-map')
const datadog = require('./datadog')

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
    return this.docker.getEvents({
      filters: {
        event: this.events
      },
      since: sinceMap.get(this.host) || 0
    })
    .then((eventStream) => {
      this.log.trace('start - got event stream')
      datadog.incMsg('stream.connect', this.host, this.org)

      this.eventStream = eventStream
      this.eventStream
        .on('error', (e) => this.handleError(e))
        .on('close', () => this.handleClose(new Error('stream closed')))
        .on('end', () => this.handleClose(new Error('stream ended')))
        .on('disconnect', () => this.handleClose(new Error('stream disconnected')))
        .on('data', (d) => this.publishEvent(d))
        .once('readable', () => this.docker.testEvent())

      return this.setTimeout()
    })
  }

  /**
   * we test to see if the stream is connected
   * 1. start timeout
   * 2. if we get data, clear timeout and say connected
   *    if we end without getting data before timeout, just resolve the
   *      main close handler will emit connect event
   * @returns {Promise}
   * @resolve {undefined} when stream connected
   * @rejects {Error}     when stream failed to get event in time
   */
  setTimeout () {
    return new Promise((resolve, reject) => {
      this.timeout = setTimeout(() => {
        delete this.timeout
        this.state = 'timeout'
        this.log.error('start - timeout getting events')
        reject(new Error('timeout getting events'))
      }, process.env.EVENT_TIMEOUT_MS)

      this.eventStream
        .once('end', () => {
          clearTimeout(this.timeout)
          resolve()
        })
        .once('data', () => {
          datadog.incMsg('stream.connected', this.host, this.org)
          this.state = 'connected'
          this.log.trace('clearTimeout - event data received, clear timeout')
          clearTimeout(this.timeout)
          rabbitmq.createConnectedJob(this.type, this.host, this.org)
          resolve()
        })
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

    if (this.isBlacklisted(event)) {
      // do nothing
      return this.log.trace({ event: event }, 'publishEvent - event blacklisted')
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

    if (this.type === 'swarm') {
      event.org = event.node.Name.split('.')[1]
      event.Host = event.node.Addr
    }

    event.uuid = uuid.v1()
    event.ip = event.Host.split(':')[0]
    event.dockerPort = event.Host.split(':')[1]
    // keep tags for legacy reasons
    event.tags = event.org
    const dockerUrl = 'http://' + event.Host

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

    const isBlocked = this.eventOnList(event, process.env.IMAGE_BLACKLIST)

    return isBlocked
  }

  /**
   * should return true if event from image is on the list
   * @param {Object} event event from docker
   * @param {String} list  list to search in
   */
  eventOnList (event, list) {
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
    errorCat.createAndReport(500, 'Docker streaming error', err)
  }

  /**
   * destroy event stream and call closeCb
   * ensure closeCb is only called once
   * @param  {Error} err error to log before close
   */
  handleClose (err) {
    if (this.eventStream) {
      this.log.error({ err: err }, 'Listener.prototype.handleClose')
      if (this.eventStream.destroy) {
        this.eventStream.destroy()
      }
      rabbitmq.createStreamConnectJob(this.type, this.host, this.org)
      this.state = 'disconnected'
      delete this.eventStream
      datadog.incMsg('stream.closed', this.host, this.org)
      errorCat.createAndReport(500, err ? err.message : 'unknown error', err)
    }
  }

  /**
   * checks if stream is disconnected
   * @return {Boolean} true if stream is disconnected
   */
  isDisconnected () {
    return this.connected === 'disconnected'
  }
}
