'use strict'
require('loadenv')()

const RabbitMQ = require('ponos/lib/rabbitmq')
const schemas = require('./schemas')

const publisher = new RabbitMQ({
  name: process.env.APP_NAME,
  events: [{
    name: 'docker.events-stream.connected',
    jobSchema: schemas.eventsStreamConnected
  }, {
    name: 'swarm.events-stream.connected',
    jobSchema: schemas.eventsStreamConnected
  }, {
    name: 'docker.events-stream.disconnected',
    jobSchema: schemas.eventsStreamDisconnected
  }],
  tasks: [{
    name: 'docker.event.publish',
    jobSchema: schemas.dockerEventPublish
  }, {
    name: 'swarm.events-stream.connect',
    jobSchema: schemas.eventsStreamConnect
  }, {
    name: 'docker.events-stream.connect',
    jobSchema: schemas.eventsStreamConnect
  }, {
    name: 'container.state.poll',
    jobSchema: schemas.containerStatePoll
  }]
})
const logger = require('./logger')()

module.exports = publisher

publisher.createPublishJob = function (job) {
  const log = logger.child({
    job: job,
    method: 'createPublishJob'
  })
  log.info('call')
  publisher.publishTask('docker.event.publish', job)
}

/**
 * send swarm or docker events stream connected job
 * @param  {String} type swarm / docker
 * @param  {String} host format: 10.0.0.1:4242
 * @param  {String} org  github orgId
 */
publisher.createConnectedJob = function (type, host, org) {
  const log = logger.child({
    type: type,
    host: host,
    org: org,
    method: 'createConnectedJob'
  })
  log.info('call')
  // we need to send tags for backwards compatibility
  // also host needs to have http://
  publisher.publishEvent(type + '.events-stream.connected', {
    host: 'http://' + host,
    org: org
  })
}

/**
 * send docker events stream disconnected job
 * @param  {String} host format: 10.0.0.1:4242
 * @param  {String} org  github orgId
 */
publisher.createDisconnectedJob = function (host, org) {
  const log = logger.child({
    host: host,
    org: org,
    method: 'createDisconnectedJob'
  })
  log.info('call')
  // we need to send tags for backwards compatibility
  // also host needs to have http://
  publisher.publishEvent('docker.events-stream.disconnected', {
    host: 'http://' + host,
    org: org
  })
}

/**
 * send swarm or docker events stream connected job
 * @param  {String} type swarm / docker
 * @param  {String} host format: 10.0.0.1:4242
 * @param  {String} org  github orgId
 */
publisher.createStreamConnectJob = function (type, host, org) {
  const log = logger.child({
    type: type,
    host: host,
    org: org,
    method: 'createStreamConnectJob'
  })
  log.info('call')
  publisher.publishTask(type + '.events-stream.connect', {
    host: host,
    org: org
  })
}
