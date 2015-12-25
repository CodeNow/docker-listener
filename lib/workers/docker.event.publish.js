/**
 * Publish docker event
 * @module lib/workers/docker.event.publish
 */
'use strict'

require('loadenv')()

var ip = require('ip')
var os = require('os')
var uuid = require('node-uuid')
var ErrorCat = require('error-cat')
var errorCat = new ErrorCat()
var keypather = require('keypather')()
var docker = require('../docker')

var rabbitmq = require('../rabbitmq')
var Promise = require('bluebird')
var log = require('../logger').getChild(__filename)

// added here because we only want to call these once for speed
var numCpus = os.cpus().length
var tags = process.env.HOST_TAGS + ''
var hostIp = ip.address()
var totalmem = os.totalmem()

module.exports = DockerEventPublish

function DockerEventPublish (job) {
  var logData = {
    tx: true,
    data: job
  }
  var data = DockerEventPublish._addBasicFields(job.data)
  return Promise.fromCallback(function (cb) {
      if (!DockerEventPublish._isContainerEvent(data)) {
        return cb(null, data)
      }
      var container = docker.getContainer(data.id)
      container.inspect(function (err, inspectData) {
        if (err) {
          return cb(err)
        }
        data.inspectData = inspectData
        cb(null, data)
      })
    })
    .then(function (enhanced) {
      /**
       * RabbitMQ Jobs in response to docker events
       */
      switch (enhanced.status) {
        case 'create':
          // ignore build containers
          if (DockerEventPublish._isUserContainer(enhanced)) {
            log.info(logData, 'inserting on-instance-container-create task into queue')
            rabbitmq.publish('on-instance-container-create', enhanced)
          } else if (DockerEventPublish._isBuildContainer(enhanced)) {
            log.info(logData, 'inserting on-image-builder-container-create task into queue')
            rabbitmq.publish('on-image-builder-container-create', enhanced)
          }
          break
        case 'start':
          log.info(logData, 'publishing container.life-cycle.started event')
          rabbitmq.publish('container.life-cycle.started', enhanced,
            DockerEventPublish._createRoutingKey())
          break
        case 'die':
          if (DockerEventPublish._isUserContainer(enhanced)) {
            log.info(logData, 'inserting on-instance-container-die task into queue')
            rabbitmq.publish('on-instance-container-die', enhanced)
          } else if (DockerEventPublish._isBuildContainer(enhanced)) {
            log.info(logData, 'inserting on-image-builder-container-die task into queue')
            rabbitmq.publish('on-image-builder-container-die', enhanced)
          }
          log.info(logData, 'publishing container.life-cycle.died event')
          rabbitmq.publish('container.life-cycle.died', enhanced,
            DockerEventPublish._createRoutingKey())
          break
        case 'docker.events-stream.connected':
          log.info(logData, 'inserting docker.events-stream.connected task into queue')
          rabbitmq.publish('docker.events-stream.connected', enhanced)
          break
        case 'docker.events-stream.disconnected':
          log.info(logData, 'inserting docker.events-stream.disconnected task into queue')
          rabbitmq.publish('docker.events-stream.disconnected', enhanced)
          break
      }
    })
}

//helper
DockerEventPublish._isUserContainer = function (enhanced) {
  return keypather.get(enhanced, 'inspectData.Config.Labels.type') === 'user-container'
}
DockerEventPublish._isBuildContainer = function (enhanced) {
  return keypather.get(enhanced, 'inspectData.Config.Labels.type') === 'image-builder-container'
}


/**
 * should return true if the dockerEvent is a container dockerEvent
 */
DockerEventPublish._isContainerEvent = function (dockerEvent) {
  var containerEvent =
    ['create', 'die', 'export', 'kill', 'pause', 'restart', 'start', 'stop', 'unpause']
  return ~containerEvent.indexOf(dockerEvent.status)
}

/**
 * add `ip`, `uuid`, `host` and `time` (if missing) fields
 * @param {Object} dockerEvent
 * @return Object
 */
DockerEventPublish._addBasicFields = function (dockerEvent) {
  dockerEvent.uuid = uuid.v1()
  dockerEvent.ip = hostIp
  dockerEvent.numCpus = numCpus
  dockerEvent.mem = totalmem
  dockerEvent.tags = tags
  if (!dockerEvent.time) {
    dockerEvent.time = new Date().getTime()
  }
  dockerEvent.host = 'http://' + dockerEvent.ip + ':' + process.env.DOCKER_REMOTE_API_PORT
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
