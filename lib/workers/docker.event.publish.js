/**
 * Publish docker event
 * @module lib/workers/docker.event.publish
 */
'use strict'

require('loadenv')()

var keypather = require('keypather')()
var Promise = require('bluebird')
var put = require('101/put')
var TaskFatalError = require('ponos').TaskFatalError
var uuid = require('node-uuid')

var docker = require('../docker')
var log = require('../logger')()
var rabbitmq = require('../rabbitmq')

module.exports = DockerEventPublish

function DockerEventPublish (job) {
  var logData = {
    tx: true,
    job: job
  }
  var data = DockerEventPublish._addBasicFields(job)
  return Promise.fromCallback(function (cb) {
    if (!DockerEventPublish._isContainerEvent(data)) {
      log.trace(logData, 'DockerEventPublish - not container event')
      return cb(null, data)
    }
    var container = docker.getContainer(data.id)
    container.inspect(function (err, inspectData) {
      if (err) {
        if (err.statusCode === 404) {
          // container is not there anymore. Exit
          var fatalErr = new TaskFatalError('docker.event.publish',
            err.message, { originalError: err })
          log.trace(put({ err: err }, logData), 'DockerEventPublish - container not found')
          return cb(fatalErr)
        }
        log.error(put({ err: err }, logData), 'DockerEventPublish - inspect error')
        return cb(err)
      }
      log.trace(logData, 'DockerEventPublish - inspect returned')
      data.inspectData = inspectData
      cb(null, data)
    })
  })
    .then(function (payload) {
      switch (payload.status) {
        case 'create':
          if (DockerEventPublish._isUserContainer(payload)) {
            log.info(logData, 'DockerEventPublish - publishing on-instance-container-create')
            rabbitmq.publish('on-instance-container-create', payload)
          } else if (DockerEventPublish._isBuildContainer(payload)) {
            log.info(logData, 'DockerEventPublish - publishing on-image-builder-container-create')
            rabbitmq.publish('on-image-builder-container-create', payload)
          }
          break
        case 'start':
          log.info(logData, 'DockerEventPublish - publishing container.life-cycle.started')
          rabbitmq.publish('container.life-cycle.started', payload)
          break
        case 'die':
          if (DockerEventPublish._isUserContainer(payload)) {
            log.info(logData, 'DockerEventPublish - publishing on-instance-container-die')
            rabbitmq.publish('on-instance-container-die', payload)
          } else if (DockerEventPublish._isBuildContainer(payload)) {
            log.info(logData, 'DockerEventPublish - publishing on-image-builder-container-die')
            rabbitmq.publish('on-image-builder-container-die', payload)
          }
          log.info(logData, 'DockerEventPublish - publishing container.life-cycle.died')
          rabbitmq.publish('container.life-cycle.died', payload)
          break
        case 'engine_connect':
          log.info(logData, 'DockerEventPublish - publishing docker.events-stream.connected')
          rabbitmq.publish('docker.events-stream.connected', payload)
          break
        case 'engine_disconnect':
          log.info(logData, 'DockerEventPublish - publishing docker.events-stream.disconnected')
          rabbitmq.publish('docker.events-stream.disconnected', payload)
          break
        default:
          log.info(logData, 'DockerEventPublish - we do not handle event with this status')
          return
      }
    })
}

// helper
DockerEventPublish._isUserContainer = function (payload) {
  return keypather.get(payload, 'inspectData.Config.Labels.type') === 'user-container'
}
DockerEventPublish._isBuildContainer = function (payload) {
  return keypather.get(payload, 'inspectData.Config.Labels.type') === 'image-builder-container'
}

/**
 * should return true if the dockerEvent is a container dockerEvent
 */
DockerEventPublish._isContainerEvent = function (dockerEvent) {
  var containerEvent =
  ['create', 'die', 'export', 'kill', 'pause', 'restart', 'start', 'stop', 'unpause']
  return containerEvent.indexOf(dockerEvent.status) >= 0
}

/**
 * add `ip`, `uuid`, `host` and `time` (if missing) fields
 * @param {Object} dockerEvent
 * @return Object
 */
DockerEventPublish._addBasicFields = function (dockerEvent) {
  dockerEvent.uuid = uuid.v1()
  dockerEvent.ip = dockerEvent.node.Ip
  var org = dockerEvent.node.Name.split('.')[1]
  // keep tags for legacy reasons
  dockerEvent.tags = org
  dockerEvent.org = org
  dockerEvent.time = dockerEvent.time
  var dockerUrl = 'http://' + dockerEvent.node.Addr
  // we expose one value as two results for compatibility reasons
  dockerEvent.host = dockerUrl
  dockerEvent.dockerUrl = dockerUrl
  return dockerEvent
}
