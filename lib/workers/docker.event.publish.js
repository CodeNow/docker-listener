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

// Ignore events from blacklisted containers
// also ignores non engine events from swarm
function isBlacklisted (event) {
  // swarm does not send org in its events
  if (event.type === 'swarm' &&
     (event.status !== 'engine_connect' || (event.status !== 'engine_disconnect'))) {
    return true
  }

  const blackList = process.env.CONTAINERS_BLACKLIST.split(',')
  const isBlocked = blackList.some(function (item) {
    return ~event.from.indexOf(item)
  })
  return isBlocked
}

function DockerEventPublish (job) {
  const logData = {
    tx: true,
    org: job.org,
    host: job.Host,
    event: new Buffer(job.event.data).toString()
  }

  log.trace(logData, 'DockerEventPublish')
  return Promise
    .try(function () {
      const event = DockerEventPublish._formatEvent(job)
      logData.event = event
      if (isBlacklisted(event)) {
        // do nothing
        log.trace(logData, 'DockerEventPublish - event blacklisted')
        return
      }

      return Promise.try(function (cb) {
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
            log.trace(logData, 'DockerEventPublish - inspect returned')
            event.inspectData = inspectData
            return event
          })
          .catch((err) => {
            timer.stop()
            if (err.statusCode === 404) {
              // container is not there anymore. Exit
              const fatalErr = new TaskFatalError('docker.event.publish',
                err.message, { originalError: err })
              fatalErr.report = false
              log.trace(put({ err: err }, logData), 'DockerEventPublish - container not found')
              throw fatalErr
            }
            log.error(put({ err: err }, logData), 'DockerEventPublish - inspect error')
            throw err
          })
      })
      .then(function (event) {
        datadog.incEvent(event)

        switch (event.status) {
          case 'create':
            if (DockerEventPublish._isUserContainer(event)) {
              log.info(logData, 'DockerEventPublish - publishing on-instance-container-create')
              rabbitmq.publish('on-instance-container-create', event)
            } else if (DockerEventPublish._isBuildContainer(event)) {
              log.info(logData, 'DockerEventPublish - publishing on-image-builder-container-create')
              rabbitmq.publish('on-image-builder-container-create', event)
            }
            break
          case 'start':
            log.info(logData, 'DockerEventPublish - publishing container.life-cycle.started')
            rabbitmq.publish('container.life-cycle.started', event)
            break
          case 'die':
            if (DockerEventPublish._isUserContainer(event)) {
              log.info(logData, 'DockerEventPublish - publishing on-instance-container-die')
              rabbitmq.publish('on-instance-container-die', event)
            } else if (DockerEventPublish._isBuildContainer(event)) {
              log.info(logData, 'DockerEventPublish - publishing on-image-builder-container-die')
              rabbitmq.publish('on-image-builder-container-die', event)
            }
            log.info(logData, 'DockerEventPublish - publishing container.life-cycle.died')
            rabbitmq.publish('container.life-cycle.died', event)
            break
          case 'engine_connect':
            log.info(logData, 'DockerEventPublish - publishing docker.events-stream.connected')
            rabbitmq.publish('docker.events-stream.connected', event)
            break
          case 'engine_disconnect':
            log.info(logData, 'DockerEventPublish - publishing docker.events-stream.disconnected')
            rabbitmq.publish('docker.events-stream.disconnected', event)
            break
          default:
            log.info(logData, 'DockerEventPublish - we do not handle event with this status')
            return
        }
      })
    })
}

// helper
DockerEventPublish._isUserContainer = function (event) {
  return keypather.get(event, 'inspectData.Config.Labels.type') === 'user-container'
}
DockerEventPublish._isBuildContainer = function (event) {
  return keypather.get(event, 'inspectData.Config.Labels.type') === 'image-builder-container'
}

/**
 * should return true if the dockerEvent is a container dockerEvent we care about
 */
DockerEventPublish._isContainerEvent = function (dockerEvent) {
  const containerEvent = ['create', 'die', 'start']
  return containerEvent.indexOf(dockerEvent.status) >= 0
}

/**
 * add extra fields, remove event buffer
 * @param {Object} job passed to worker
 * @return Object
 * @throws {Error} If parse fails
 */
DockerEventPublish._formatEvent = function (job) {
  var dockerEvent = JSON.parse(job.event.data)
  dockerEvent.uuid = uuid.v1()
  dockerEvent.ip = job.Host.split(':')[0]
  dockerEvent.dockerPort = job.Host.split(':')[1]
  // keep tags for legacy reasons
  dockerEvent.tags = job.org
  const dockerUrl = 'http://' + job.Host
  // we expose one value as two results for compatibility reasons
  dockerEvent.host = dockerUrl
  dockerEvent.dockerUrl = dockerUrl
  // Host is to proper version of host
  dockerEvent.Host = job.Host
  dockerEvent.org = job.org

  return dockerEvent
}
