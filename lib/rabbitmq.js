'use strict'
require('loadenv')()

const async = require('async')
const ErrorCat = require('error-cat')
const Hermes = require('runnable-hermes')
const ponos = require('ponos')
const put = require('101/put')

const logger = require('./logger')

const error = new ErrorCat()
const log = logger()

const publishedEvents = [
  'container.life-cycle.died',
  'container.life-cycle.started',
  'docker.events-stream.connected',
  'docker.events-stream.disconnected',
  'swarm.events-stream.connected'
]

const subscribedEvents = [
  'swarm.events-stream.connected'
]

const publishedQueues = [
  'docker.events-stream.connect',
  'docker.event.publish',
  'on-image-builder-container-create',
  'on-image-builder-container-die',
  'on-instance-container-create',
  'on-instance-container-die',
  'swarm.events-stream.connect'
]

const subscribedQueues = [
  'docker.events-stream.connect',
  'docker.event.publish',
  'swarm.events-stream.connect'
]

const opts = {
  name: 'docker-listener',
  heartbeat: 10,
  hostname: process.env.RABBITMQ_HOSTNAME,
  password: process.env.RABBITMQ_PASSWORD,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USERNAME
}

class RabbitMQ {
  connect (cb) {
    // needs to be defined at runtime due to circler dependency
    const tasks = {
      'docker.event.publish': require('./workers/docker.event.publish.js'),
      'docker.events-stream.connect': require('./workers/docker.events-stream.connect.js'),
      'swarm.events-stream.connect': require('./workers/swarm.events-stream.connect.js'),
      'swarm.events-stream.connected': require('./workers/swarm.events-stream.connected.js')
    }
    log.info('RabbitMQ.prototype.connect')
    this.publisher = new Hermes(put({
      queues: publishedQueues,
      publishedEvents: publishedEvents
    }, opts)).on('error', this._handleFatalError)

    this.subscriber = new Hermes(put({
      queues: subscribedQueues,
      subscribedEvents: subscribedEvents
    }, opts)).on('error', this._handleFatalError)

    this.ponosServer = new ponos.Server({
      hermes: this.subscriber,
      log: logger({ module: 'ponos' }),
      queues: Object.keys(tasks)
    })

    this.ponosServer.setAllTasks(tasks)
    const startTasks = [
      this.publisher.connect.bind(this.publisher),
      this.subscriber.connect.bind(this.subscriber)
    ]
    async.series(startTasks, (err) => {
      if (err) { return cb(err) }

      this.ponosServer.start().asCallback(cb)
    })
  }

  publish (name, job) {
    log.info({ queue: name, job: job }, 'RabbitMQ.prototype.publish')
    this.publisher.publish(name, job)
  }

  createPublishJob (job) {
    this.publish('docker.event.publish', job)
  }

  /**
   * send swarm or docker events stream connected job
   * @param  {String} type swarm / docker
   * @param  {String} host format: 10.0.0.1:4242
   * @param  {String} org  github orgId
   */
  createConnectedJob (type, host, org) {
    // we need to send tags for backwards compatibility
    // also host needs to have http://
    this.publish(type + '.events-stream.connected', {
      host: 'http://' + host,
      org: org,
      tags: org
    })
  }

  /**
   * send swarm or docker events stream connected job
   * @param  {String} type swarm / docker
   * @param  {String} host format: 10.0.0.1:4242
   * @param  {String} org  github orgId
   */
  createStreamConnectJob (type, host, org) {
    this.publish(type + '.events-stream.connect', {
      host: host,
      org: org
    })
  }

  /**
   * reports errors on clients
   */
  _handleFatalError (err) {
    log.error({ err: err }, '_handleFatalError')
    throw error.createAndReport(502, 'RabbitMQ error', err)
  }
}

module.exports = new RabbitMQ()
