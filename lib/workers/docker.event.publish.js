/**
 * Publish docker event
 * @module lib/workers/docker.event.publish
 */
'use strict'

require('loadenv')()

var keypather = require('keypather')()

var events = require('../events')
var rabbitmq = require('../rabbitmq')
var Promise = require('bluebird')
var log = require('../logger').getChild(__filename)

module.exports = DockerEventPublish

function DockerEventPublish (job) {
  var logData = {
    tx: true,
    data: job
  }
  // var schema = joi.object({
  //   host: joi.string().required(),
  //   githubId: joi.number()
  // })
  var data = job.data
  return Promise.fromCallback(function (cb) {
      events.enhance(data, cb)
    })
    .then(function (enhanced) {
      /**
       * RabbitMQ Jobs in response to docker events
       */
      switch (enhanced.status) {
        case 'create':
          // ignore build containers
          if (isUserContainer(enhanced)) {
            log.info(logData, 'inserting on-instance-container-create task into queue');
            rabbitmq.publish('on-instance-container-create', enhanced);
          } else if (isBuildContainer(enhanced)) {
            log.info(logData, 'inserting on-image-builder-container-create task into queue');
            rabbitmq.publish('on-image-builder-container-create', enhanced);
          }
          break;
        case 'start':
          log.info(logData, 'publishing container.life-cycle.started event');
          rabbitmq.publish('container.life-cycle.started', enhanced,
            DockerEventPublish._createRoutingKey());
          break;
        case 'die':
          if (isUserContainer(enhanced)) {
            log.info(logData, 'inserting on-instance-container-die task into queue');
            rabbitmq.publish('on-instance-container-die', enhanced);
          } else if (isBuildContainer(enhanced)) {
            log.info(logData, 'inserting on-image-builder-container-die task into queue');
            rabbitmq.publish('on-image-builder-container-die', enhanced);
          }
          log.info(logData, 'publishing container.life-cycle.died event');
          rabbitmq.publish('container.life-cycle.died', enhanced,
            DockerEventPublish._createRoutingKey());
          break;
        case 'docker.events-stream.connected':
          log.info(logData, 'inserting docker.events-stream.connected task into queue');
          rabbitmq.publish('docker.events-stream.connected', enhanced);
          break;
        case 'docker.events-stream.disconnected':
          log.info(logData, 'inserting docker.events-stream.disconnected task into queue');
          rabbitmq.publish('docker.events-stream.disconnected', enhanced);
          break;
      }
    })
}

//helper
function isUserContainer (enhanced) {
  return keypather.get(enhanced, 'inspectData.Config.Labels.type') === 'user-container';
}
function isBuildContainer (enhanced) {
  return keypather.get(enhanced, 'inspectData.Config.Labels.type') === 'image-builder-container';
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
    ip.address().replace('.', '-')
  ].join('.')
}
