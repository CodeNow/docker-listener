'use strict'
require('loadenv')()

const Joi = require('joi')
const keypather = require('keypather')()
const Promise = require('bluebird')
const TaskFatalError = require('ponos').TaskFatalError

const datadog = require('../datadog')
const Docker = require('../docker')
const logger = require('../logger')
const rabbitmq = require('../rabbitmq')
const sinceMap = require('../since-map')

const DockerEventPublish = (job) => {
  const log = logger({ job: job })

  const schema = Joi.object({
    dockerPort: Joi.string().required(),
    dockerUrl: Joi.string().required(),
    from: Joi.string().required(),
    host: Joi.string().required(),
    Host: Joi.string().required(),
    id: Joi.string().required(),
    ip: Joi.string().required(),
    org: Joi.string().required(),
    status: Joi.string().required(),
    tags: Joi.string().required(),
    time: Joi.number().required(),
    uuid: Joi.string().required()
  }).unknown().required().label('job')

  return Promise.fromCallback((cb) => {
    Joi.validate(job, schema, cb)
  })
  .catch((err) => {
    log.error({ err: err }, 'invalid job')
    throw new TaskFatalError(
      'docker.event-stream.connect',
      'Job has invalid data: ' + err.message,
      { job: job, schema: Object.keys(schema) }
    )
  })
  .then(() => {
    return Promise.try((cb) => {
      sinceMap.set(job.Host, job.time)
      if (!DockerEventPublish._isContainerEvent(job)) {
        log.trace('DockerEventPublish - not container job')
        return job
      }

      const docker = new Docker(job.Host)
      const timer = datadog.timer('inspect.time', job.ip, job.org)
      return docker.inspectContainer(job.id)
        .then((inspectData) => {
          timer.stop()
          job.inspectData = inspectData
          log.trace('DockerEventPublish - inspect returned')
          return job
        })
        .catch((err) => {
          if (err.statusCode === 404) {
            // container is not there anymore. Exit
            const fatalErr = new TaskFatalError(
              'docker.event.publish',
              err.message,
              { originalError: err }
            )
            fatalErr.report = false
            log.trace({ err: err }, 'DockerEventPublish - container not found')
            throw fatalErr
          }
          log.error({ err: err }, 'DockerEventPublish - inspect error')
          // check to see if host still exist before retrying
          const swarm = new Docker(process.env.SWARM_HOST)
          return swarm.swarmHostExists(job.Host)
            .catch((hostErr) => {
              log.trace({ err: hostErr }, 'DockerEventPublish - swarmHostExists error')
              // if above errors, throw original error
              throw err
            })
            .then((exists) => {
              if (!exists) {
                log.trace('DockerEventPublish - host does not exist')
                const fatalErr = new TaskFatalError(
                  'docker.event.publish',
                  'host does not exist',
                  { host: job.Host }
                )
                fatalErr.report = false
                throw fatalErr
              }

              throw err
            })
        })
    })
    .then((event) => {
      datadog.incEvent(event)

      switch (event.status) {
        case 'create':
          if (DockerEventPublish._isUserContainer(event)) {
            rabbitmq.publish('on-instance-container-create', event)
          } else if (DockerEventPublish._isBuildContainer(event)) {
            rabbitmq.publish('on-image-builder-container-create', event)
          }
          break
        case 'start':
          rabbitmq.publish('container.life-cycle.started', event)
          break
        case 'die':
          if (DockerEventPublish._isUserContainer(event)) {
            rabbitmq.publish('on-instance-container-die', event)
          } else if (DockerEventPublish._isBuildContainer(event)) {
            rabbitmq.publish('on-image-builder-container-die', event)
          }
          rabbitmq.publish('container.life-cycle.died', event)
          break
        case 'engine_connect':
          rabbitmq.createStreamConnectJob('docker', event.Host, event.org)
          break
        default:
          log.warn('DockerEventPublish - we do not handle event with this status')
          return
      }
    })
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
 * should return true if the dockerEvent is a container dockerEvent we care about
 */
DockerEventPublish._isContainerEvent = (dockerEvent) => {
  const containerEvent = ['create', 'die', 'start']
  return containerEvent.indexOf(dockerEvent.status) >= 0
}

module.exports = DockerEventPublish
