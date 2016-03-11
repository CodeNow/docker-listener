/**
 * Publish docker event
 * @module lib/workers/docker.event.publish
 */
'use strict'
require('loadenv')()

const keypather = require('keypather')()
const Promise = require('bluebird')
const put = require('101/put')
const TaskFatalError = require('ponos').TaskFatalError
const uuid = require('node-uuid')

const datadog = require('../datadog')
const Docker = require('../docker')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const sinceMap = require('../since-map')

module.exports = DockerEventPublish

function DockerEventPublish (job) {
  const logData = {}

  log.trace({ job: job }, 'DockerEventPublish')
  return Promise
    .try(() => {
      job.event = JSON.parse(job.event)
      return job
    })
    .catch((err) => {
      throw new TaskFatalError(
        'docker.event.publish',
        'event parse error',
        { originalError: err }
      )
    })
    .then((parsedJob) => {
      const event = DockerEventPublish._formatEvent(parsedJob)
      logData.event = event
      if (DockerEventPublish._isBlacklisted(event)) {
        // do nothing
        log.trace(logData, 'DockerEventPublish - event blacklisted')
        return
      }

      return Promise.try((cb) => {
        sinceMap.set(event.Host, event.time)
        if (!DockerEventPublish._isContainerEvent(event)) {
          log.trace(logData, 'DockerEventPublish - not container event')
          return event
        }

        const docker = new Docker(event.Host)
        const timer = datadog.timer('inspect.time', event.ip, event.org)
        return docker.inspectContainer(event.id)
          .then((inspectData) => {
            timer.stop()
            event.inspectData = inspectData
            log.trace(logData, 'DockerEventPublish - inspect returned')
            return event
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
              log.trace(put({ err: err }, logData), 'DockerEventPublish - container not found')
              throw fatalErr
            }
            log.error(put({ err: err }, logData), 'DockerEventPublish - inspect error')
            // check to see if host still exist before retrying
            const swarm = new Docker(process.env.SWARM_HOST)
            return swarm.swarmHostExists(job.Host)
              .catch(() => {
                // if above errors, throw original error
                throw err
              })
              .then((exists) => {
                if (!exists) {
                  log.trace(logData, 'DockerEventPublish - host does not exist')
                  var fatalErr = new TaskFatalError(
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
            log.warn(logData, 'DockerEventPublish - we do not handle event with this status')
            return
        }
      })
    })
}

// Ignore events from blacklisted containers
// also ignores non engine events from swarm
DockerEventPublish._isBlacklisted = (event) => {
  if (event.status === 'engine_connect' || event.status === 'engine_disconnect') {
    return false
  }

  if (event.type === 'swarm') {
    return true
  }

  const blackList = process.env.CONTAINERS_BLACKLIST.split(',')
  const isBlocked = blackList.some((item) => {
    return ~event.from.indexOf(item)
  })

  return isBlocked
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

/**
 * add extra fields, remove event buffer
 * @param {Object} job passed to worker
 * @return Object
 * @throws {Error} If parse fails
 */
DockerEventPublish._formatEvent = (job) => {
  const dockerEvent = job.event
  dockerEvent.type = 'docker'
  // swarm does not send Host or org
  if (!job.org) {
    dockerEvent.type = 'swarm'
    job.org = dockerEvent.node.Name.split('.')[1]
    job.Host = dockerEvent.node.Addr
  }

  dockerEvent.uuid = uuid.v1()
  dockerEvent.ip = job.Host.split(':')[0]
  dockerEvent.dockerPort = job.Host.split(':')[1]
  // keep tags for legacy reasons
  dockerEvent.tags = job.org
  dockerEvent.org = job.org
  const dockerUrl = 'http://' + job.Host

  // we expose one value as two results for compatibility reasons
  dockerEvent.host = dockerUrl
  dockerEvent.dockerUrl = dockerUrl
  // Host is to proper version of host
  dockerEvent.Host = job.Host
  dockerEvent.org = job.org

  return dockerEvent
}
