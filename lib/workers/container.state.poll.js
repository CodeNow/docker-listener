'use strict'
require('loadenv')()

const joi = require('joi')
const Promise = require('bluebird')

const dockerUtils = require('../docker-utils')
const Docker = require('../docker')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')

module.exports.jobSchema = joi.object({
  host: joi.string().required(),
  id: joi.string().required(),
  tid: joi.string()
}).unknown().required().label('DockerContainerPoll job')

module.exports.task = (job) => {
  return Promise
    .try((cb) => {
      const docker = new Docker(job.host)
      return docker.inspectContainerAsync(job.id)
        .then((inspectData) => {
          job.inspectData = inspectData
          log.trace('DockerContainerPoll - inspect returned')
          return job
        })
        .catch((err) => {
          return dockerUtils._handleInspectError(job.host, err, log)
        })
    })
    .then((event) => {
      return rabbitmq.publishEvent('container.state.polled', event)
    })
}
