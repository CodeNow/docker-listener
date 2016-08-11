'use strict'
require('loadenv')()

const Joi = require('joi')
const Promise = require('bluebird')

const dockerUtils = require('../docker-utils')
const Docker = require('../docker')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')

module.exports.jobSchema = Joi.object({
  host: Joi.string().required(),
  id: Joi.string().required(),
  tid: Joi.string()
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
          return dockerUtils._handleInspectError(job.Host, err, log)
        })
    })
    .then((event) => {
      return rabbitmq.publishEvent('container.state.polled', event)
    })
}
