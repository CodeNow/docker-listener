'use strict'
require('loadenv')()

const Joi = require('joi')
const Promise = require('bluebird')

const dockerUtils = require('../docker-utils')
const Docker = require('../docker')
const logger = require('../logger')
const rabbitmq = require('../rabbitmq')

module.exports.jobSchema = Joi.object({
  host: Joi.string().required(),
  id: Joi.string().required(),
  tid: Joi.string()
}).unknown().required().label('job')

module.exports.task = (job) => {
  const log = logger({ job: job })

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
      return rabbitmq.publishEvent('instance.container.polled', event)
    })
}
