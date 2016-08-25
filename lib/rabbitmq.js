'use strict'
require('loadenv')()

const RabbitMQ = require('ponos/lib/rabbitmq')
const Joi = require('joi')

const publisher = new RabbitMQ({
  name: process.env.APP_NAME,
  events: [{
    name: 'docker.events-stream.connected',
    jobSchema: Joi.object({
      host: Joi.string().uri({ scheme: 'http' }).required(),
      org: Joi.number().required()
    })
  }, {
    name: 'swarm.events-stream.connected',
    jobSchema: Joi.object({
      host: Joi.string().uri({ scheme: 'http' }).required(),
      org: Joi.number().required()
    })
  }, {
    name: 'docker.events-stream.disconnected',
    jobSchema: Joi.object({
      host: Joi.string().uri({ scheme: 'http' }).required(),
      org: Joi.number().required()
    })
  }],
  tasks: [{
    name: 'docker.event.publish',
    jobSchema: Joi.object({
      dockerPort: Joi.string().required(),
      dockerUrl: Joi.string().required(),
      from: Joi.string().required(),
      host: Joi.string().required(),
      Host: Joi.string().required(),
      id: Joi.string().required(),
      ip: Joi.string().required(),
      needsInspect: Joi.boolean().required(),
      org: Joi.string().required(),
      status: Joi.string().only('create', 'start', 'die', 'engine_connect').required(),
      tags: Joi.string().required(),
      time: Joi.number().required(),
      uuid: Joi.string().required(),
      tid: Joi.string()
    }).unknown()
  }, {
    name: 'swarm.events-stream.connect',
    jobSchema: Joi.object({
      host: Joi.string().required(),
      org: Joi.number().required()
    })
  }, {
    name: 'docker.events-stream.connect',
    jobSchema: Joi.object({
      host: Joi.string().required(),
      org: Joi.number().required()
    })
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
