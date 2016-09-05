'use strict'
require('loadenv')()

const RabbitMQ = require('ponos/lib/rabbitmq')
const Docker = require('./docker')
const logger = require('./logger')()

class Publisher extends RabbitMQ {
  constructor () {
    super({ name: process.env.APP_NAME })
  }

  createPublishJob (job) {
    const log = logger.child({
      job: job,
      method: 'createPublishJob'
    })
    log.info('call')
    this.publishTask('docker.event.publish', job)
  }

  /**
   * send swarm or docker events stream connected job
   * @param  {String} type swarm / docker
   * @param  {String} host format: 10.0.0.1:4242
   * @param  {String} org  github orgId
   */
  createConnectedJob (type, host, org) {
    const log = logger.child({
      type: type,
      host: host,
      org: org,
      method: 'createConnectedJob'
    })
    log.info('call')
    // we need to send tags for backwards compatibility
    this.publishEvent(type + '.events-stream.connected', {
      host: Docker.toDockerUrl(host),
      org: org,
      tags: org
    })
  }

  /**
   * send docker events stream disconnected job
   * @param  {String} host format: 10.0.0.1:4242
   * @param  {String} org  github orgId
   */
  createDisconnectedJob (host, org) {
    const log = logger.child({
      host: host,
      org: org,
      method: 'createDisconnectedJob'
    })
    log.info('call')
    // we need to send tags for backwards compatibility
    this.publishEvent('docker.events-stream.disconnected', {
      host: Docker.toDockerUrl(host),
      org: org
    })
  }

  /**
   * send swarm or docker events stream connected job
   * @param  {String} type swarm / docker
   * @param  {String} host format: 10.0.0.1:4242
   * @param  {String} org  github orgId
   */
  createStreamConnectJob (type, host, org) {
    const log = logger.child({
      type: type,
      host: host,
      org: org,
      method: 'createStreamConnectJob'
    })
    log.info('call')
    this.publishTask(type + '.events-stream.connect', {
      host: host,
      org: org
    })
  }
}

module.exports = new Publisher()
