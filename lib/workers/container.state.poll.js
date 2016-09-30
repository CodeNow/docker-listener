'use strict'
require('loadenv')()

const Promise = require('bluebird')

const dockerUtils = require('../docker-utils')
const Docker = require('../docker')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const schemas = require('../schemas')

module.exports.jobSchema = schemas.containerStatePoll

module.exports.task = (job) => {
  return Promise
    .try((cb) => {
      const docker = new Docker(job.host, null, process.env.DOCKER_INSPECT_TIMEOUT)
      return docker.inspectContainerAsync(job.id)
        .then((inspectData) => {
          job.inspectData = inspectData
          log.trace('DockerContainerPoll - inspect returned')
          return job
        })
        .catch((err) => {
          return dockerUtils.handleInspectError(job.host, null, err, log)
        })
    })
    .then((event) => {
      return rabbitmq.publishEvent('container.state.polled', event)
    })
}
