'use strict'
require('loadenv')()
const Joi = require('joi')
const Promise = require('bluebird')

const datadog = require('../datadog')
const Docker = require('../docker')
const dockerUtils = require('../docker-utils')
const keypather = require('keypather')()
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const schemas = require('../schemas')
const sinceMap = require('../since-map')

module.exports.jobSchema = schemas.dockerEventPublish

const inspectSchema = Joi.object({
  Id: Joi.any(),
  Created: Joi.any(),
  State: Joi.object({
    Status: Joi.any(),
    Running: Joi.any(),
    Paused: Joi.any(),
    Restarting: Joi.any(),
    OOMKilled: Joi.any(),
    Dead: Joi.any(),
    ExitCode: Joi.any(),
    Error: Joi.any(),
    StartedAt: Joi.any(),
    FinishedAt: Joi.any()
  }).unknown(),
  Image: Joi.any(),
  Name: Joi.any(),
  HostConfig: Joi.object({
    Memory: Joi.any(),
    MemoryReservation: Joi.any()
  }).unknown(),
  Config: Joi.object({
    Hostname: Joi.any(),
    Env: Joi.any(),
    Image: Joi.any(),
    Labels: Joi.object()
  }).unknown(),
  Mounts: Joi.any(),
  NetworkSettings: Joi.object({
    Ports: Joi.any(),
    IPAddress: Joi.any()
  })
}).unknown()

const imageInspectSchema = Joi.object({
  Config: Joi.object({
    Cmd: Joi.alternatives().try(Joi.array().items(Joi.string()), null),
    Entrypoint: Joi.alternatives().try(Joi.array().items(Joi.string()), null),
    ExposedPorts: Joi.object()
  }).unknown()
})

const DockerEventPublish = (job) => {
  return Promise
    .try((cb) => {
      sinceMap.set(job.Host, job.time)
      if (!job.needsInspect) {
        log.trace('DockerEventPublish - job does not need inspect')
        return job
      }

      return DockerEventPublish._inspect(job)
        .then(function addInspectData (inspectData) {
          job.inspectData = inspectData
          log.trace('DockerEventPublish - inspect returned')
          return job
        })
        .then(function addTidIfOnLabels (newEvent) {
          const tid = keypather.get(job, 'inspectData.Config.Labels.tid')
          if (tid) {
            job.tid = tid
          }
          return newEvent
        })
    })
    .then((newEvent) => {
      return DockerEventPublish._handlePublish(newEvent, log)
    })
}

DockerEventPublish._inspect = (job) => {
  const docker = new Docker(job.Host, job.org)

  if (DockerEventPublish._isBuildContainer(job)) {
    return DockerEventPublish._handleImageInspect(job, docker)
  }

  return DockerEventPublish._handleContainerInspect(job, docker)
}

DockerEventPublish._isBuildContainer = (job) => {
  return job.type === 'image-builder-container'
}

DockerEventPublish._handleContainerInspect = (job, docker) => {
  return docker.inspectContainerAsync(job.id)
  .catch((err) => {
    return dockerUtils.handleInspectError(job.host, job.org, err, log)
  })
  .then((inspectData) => {
    Joi.assert(inspectData, inspectSchema, { stripUnknown: true })
  })
}

DockerEventPublish._handleImageInspect = (job, docker) => {
  return Promise.fromCallback((cb) => {
    docker.getImage(job.Actor.Attributes.dockerTag).inspect(cb)
  })
  .catch((err) => {
    return dockerUtils.handleInspectError(job.host, job.org, err, log)
  })
  .then((inspectData) => {
    Joi.assert(inspectData, imageInspectSchema, { stripUnknown: true })
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
    case 'top':
      break
    default:
      log.error('DockerEventPublish - we do not handle event with this status')
      return
  }
}

module.exports.task = DockerEventPublish
