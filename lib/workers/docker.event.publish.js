'use strict'
require('loadenv')()

const Promise = require('bluebird')

const datadog = require('../datadog')
const dockerUtils = require('../docker-utils')
const Docker = require('../docker')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const sinceMap = require('../since-map')

const schemas = require('../schemas')

module.exports.jobSchema = schemas.dockerEventPublish

const DockerEventPublish = (job) => {
  return Promise
    .try((cb) => {
      sinceMap.set(job.Host, job.time)
      if (!job.needsInspect) {
        log.trace('DockerEventPublish - job does not need inspect')
        return job
      }

      const docker = new Docker(job.Host)
      return docker.inspectContainerAsync(job.id)
        .then((inspectData) => {
          job.inspectData = inspectData
          log.trace('DockerEventPublish - inspect returned')
          return job
        })
        .catch((err) => {
          return dockerUtils._handleInspectError(job.Host, err, log)
        })
    })
    .then((event) => {
      return DockerEventPublish._handlePublish(event, log)
    })
}

/**
 * publishes jobs based on event type
 * @param  {Object} event event to publish
 * @param  {Object} log   current logger
 */
DockerEventPublish._handlePublish = (event, log) => {
  datadog.incEvent(event)

  switch (event.status) {
    case 'create':
      rabbitmq.publishEvent('container.life-cycle.created', event)
      break
    case 'start':
      rabbitmq.publishEvent('container.life-cycle.started', event)
      break
    case 'die':
      rabbitmq.publishEvent('container.life-cycle.died', event)
      break
    case 'engine_connect':
      rabbitmq.createStreamConnectJob('docker', event.Host, event.org)
      break
    default:
      log.error('DockerEventPublish - we do not handle event with this status')
      return
  }
}

module.exports.task = DockerEventPublish
