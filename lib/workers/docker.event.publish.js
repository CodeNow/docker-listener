'use strict'
require('loadenv')()

const Joi = require('joi')
const keypather = require('keypather')()
const Promise = require('bluebird')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const datadog = require('../datadog')
const dockerUtils = require('../docker-utils')
const Docker = require('../docker')
const Swarm = require('../swarm')
const logger = require('../logger')
const rabbitmq = require('../rabbitmq')
const sinceMap = require('../since-map')

module.exports.jobSchema = Joi.object({
  dockerPort: Joi.string().required(),
  dockerUrl: Joi.string().required(),
  from: Joi.string().required(),
  host: Joi.string().required(),
  Host: Joi.string().required(),
  id: Joi.string().required(),
  ip: Joi.string().required(),
  needsInspect: Joi.boolean().required(),
  org: Joi.string().required(),
  status: Joi.string().required(),
  tags: Joi.string().required(),
  time: Joi.number().required(),
  uuid: Joi.string().required(),
  tid: Joi.string()
}).unknown().required().label('job')

const DockerEventPublish = (job) => {
  const log = logger({ job: job })

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

// helper
DockerEventPublish._isUserContainer = (event) => {
  return keypather.get(event, 'inspectData.Config.Labels.type') === 'user-container'
}
DockerEventPublish._isBuildContainer = (event) => {
  return keypather.get(event, 'inspectData.Config.Labels.type') === 'image-builder-container'
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
      if (DockerEventPublish._isUserContainer(event)) {
        rabbitmq.publishTask('on-instance-container-create', event)
      } else if (DockerEventPublish._isBuildContainer(event)) {
        rabbitmq.publishTask('on-image-builder-container-create', event)
      }
      break
    case 'start':
      rabbitmq.publishEvent('container.life-cycle.started', event)
      break
    case 'die':
      if (DockerEventPublish._isUserContainer(event)) {
        rabbitmq.publishTask('on-instance-container-die', event)
      } else if (DockerEventPublish._isBuildContainer(event)) {
        rabbitmq.publishTask('on-image-builder-container-die', event)
      }
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
