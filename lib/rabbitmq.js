'use strict'
require('loadenv')()

const joi = require('joi')
const RabbitMQ = require('ponos/lib/rabbitmq')
const DockerUtils = require('@runnable/loki').Utils
const schemas = require('./schemas')

const logger = require('./logger')()

class Publisher extends RabbitMQ {
  constructor () {
    const log = logger.child({
      module: 'publisher'
    })
    super({
      name: process.env.APP_NAME,
      log: log,
      events: [{
        name: 'container.life-cycle.created',
        jobSchema: schemas.containerLifeCycle
      }, {
        name: 'container.life-cycle.died',
        jobSchema: schemas.containerLifeCycle
      }, {
        name: 'container.life-cycle.started',
        jobSchema: schemas.containerLifeCycle
      }, {
        name: 'container.state.polled',
        jobSchema: schemas.containerStatePolled
      }, {
        name: 'docker.events-stream.connected',
        jobSchema: schemas.dockerEventsStreamConnected
      }, {
        name: 'docker.events-stream.disconnected',
        jobSchema: schemas.eventsStreamDisconnected
      }, {
        name: 'dock.lost',
        jobSchema: schemas.dockLost
      }, {
        name: 'swarm.events-stream.connected',
        jobSchema: schemas.swarmEventsStreamConnected
      }],
      tasks: [{
        name: 'container.state.poll',
        jobSchema: schemas.containerStatePoll
      }, {
        name: 'container.state.polled',
        jobSchema: joi.object({
          id: joi.string().required(),
          inspectData: joi.object({
            Config: joi.object({
              Labels: joi.object({
                instanceId: joi.string().required(),
                sessionUserGithubId: joi.number().required(),
                deploymentUuid: joi.string()
              }).unknown().required()
            }).unknown().required()
          }).unknown().required(),
          tid: joi.string()
        })
      }, {
        name: 'docker.event.publish',
        jobSchema: schemas.dockerEventPublish
      }, {
        name: 'docker.events-stream.connect',
        jobSchema: schemas.dockerEventsStreamConnect
      }, {
        name: 'docker.events-stream.ping',
        jobSchema: schemas.dockerEventsStreamPing
      }, {
        name: 'docker.events-stream.reconcile',
        jobSchema: joi.object().unknown().required()
      }, {
        name: 'swarm.events-stream.connect',
        jobSchema: schemas.swarmEventsStreamConnect
      }]
    })
  }

  createPingJob (job) {
    const log = logger.child({
      job,
      method: 'createPingJob'
    })
    log.info('called')
    this.publishTask('docker.events-stream.ping', job)
  }

  createPublishJob (job) {
    const log = logger.child({
      job,
      method: 'createPublishJob'
    })
    log.info('called')
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
      type,
      host,
      org,
      method: 'createConnectedJob'
    })
    log.info('called')
    // also host needs to have http://
    const job = {
      host: 'http://' + host
    }
    if (org) {
      job.org = org
    }
    this.publishEvent(type + '.events-stream.connected', job)
  }

  /**
   * send docker events stream disconnected job
   * @param  {String} host format: 10.0.0.1:4242
   * @param  {String} org  github orgId
   */
  createDisconnectedJob (host, org) {
    const log = logger.child({
      host,
      org,
      method: 'createDisconnectedJob'
    })
    log.info('called')
    // we need to send tags for backwards compatibility
    this.publishEvent('docker.events-stream.disconnected', {
      host: DockerUtils.toDockerUrl(host),
      org
    })
  }

  /**
   * send reconcile listeners job
   */
  createStreamReconcileJob (job) {
    const log = logger.child({
      method: 'createStreamReconcileJob',
      job
    })
    log.info('called')
    return this.publishTask('docker.events-stream.reconcile', job)
  }

  /**
   * send swarm or docker events stream connected job
   * @param  {String} type swarm / docker
   * @param  {String} host format: 10.0.0.1:4242
   * @param  {String} org  github orgId
   */
  createStreamConnectJob (type, host, org) {
    const log = logger.child({
      type,
      host,
      org,
      method: 'createStreamConnectJob'
    })
    log.info('called')
    this.publishTask(type + '.events-stream.connect', {
      host,
      org
    })
  }
}

module.exports = new Publisher()
