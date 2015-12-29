/**
 * Publish docker event
 * @module lib/workers/docker.event.publish
 */
'use strict'

require('loadenv')()

var ip = require('ip')
var uuid = require('node-uuid')
var ErrorCat = require('error-cat')
var errorCat = new ErrorCat()
var keypather = require('keypather')()
var put = require('101/put')
var docker = require('../docker')

var rabbitmq = require('../rabbitmq')
var Promise = require('bluebird')
var log = require('../logger').getChild(__filename)
var TaskFatalError = require('ponos').TaskFatalError

var tags = process.env.HOST_TAGS + ''
var hostIp = ip.address()

module.exports = DockerEventPublish

function DockerEventPublish (job) {
  var logData = {
    tx: true,
    data: job
  }
  var data = DockerEventPublish._addBasicFields(job)
  return Promise.fromCallback(function (cb) {
      if (!DockerEventPublish._isContainerEvent(data)) {
        return cb(null, data)
      }
      var container = docker.getContainer(data.id)
      container.inspect(function (err, inspectData) {
        if (err) {
          if (err.statusCode === 404) {
            // container is not there anymore. Exit
            var fatalErr = new TaskFatalError('docker.event.publish',
             err.message, { originalError: err })
            log.error(put({ err: err }, logData), 'DockerEventPublish - container not found')
            return cb(fatalErr)
          }
          return cb(err)
        }
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
          rabbitmq.publish('container.life-cycle.started', payload,
            DockerEventPublish._createRoutingKey())
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
          rabbitmq.publish('container.life-cycle.died', payload,
            DockerEventPublish._createRoutingKey())
          break
        case 'docker.events-stream.connected':
          log.info(logData, 'DockerEventPublish - publishing docker.events-stream.connected')
          rabbitmq.publish('docker.events-stream.connected', payload)
          break
        case 'docker.events-stream.disconnected':
          log.info(logData, 'DockerEventPublish - publishing docker.events-stream.disconnected')
          rabbitmq.publish('docker.events-stream.disconnected', payload)
          break
        default:
          log.error(logData, 'DockerEventPublish - paylod status is invalid')
          throw new TaskFatalError('docker.event.publish', 'Paylod status is invalid')
      }
    })
}

//helper
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
  dockerEvent.ip = hostIp
  dockerEvent.tags = tags
  var org = tags.split(',')[0]
  dockerEvent.org = org
  // time is `undefined` for non-docker events - that is why we need to se it ourselves
  if (!dockerEvent.time) {
    dockerEvent.time = new Date().getTime()
  }
  var dockerUrl = 'http://' + dockerEvent.ip + ':' + process.env.DOCKER_REMOTE_API_PORT
  // we expose one value as two results for compatibility reasons
  dockerEvent.host = dockerUrl
  dockerEvent.dockerUrl = dockerUrl
  return dockerEvent
}

/**
 * returns routing key. format:
 * <org>.<host_ip>
 * org is org id which is parsed from HOST_TAGS
 * host_ip is the private ip of the dock replacing `.` with `-`
 * @return {String} routing key
 */
DockerEventPublish._createRoutingKey = function () {
  return [
    process.env.HOST_TAGS.split(',')[0],
    hostIp.replace('.', '-')
  ].join('.')
}
