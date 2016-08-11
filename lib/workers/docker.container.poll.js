'use strict'
require('loadenv')()

const Joi = require('joi')
const keypather = require('keypather')()
const Promise = require('bluebird')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const datadog = require('../datadog')
const dockerUtils = require('../docker-utils')
const Docker = require('../docker')
const Swarm = require('../swarm')
const logger = require('../logger')
const rabbitmq = require('../rabbitmq')
const sinceMap = require('../since-map')

module.exports.jobSchema = Joi.object({
  host: Joi.string().required(),
  id: Joi.string().required(),
  tid: Joi.string()
}).unknown().required().label('job')

const DockerContainerPoll = (job) => {
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
      return rabbitmq.publishTask('instance.container.polled', event)
    })
}

module.exports.task = DockerContainerPoll
