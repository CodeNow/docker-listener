'use strict'
require('loadenv')()

const dockerUtils = require('../docker-utils')
const Docker = require('../docker')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const schemas = require('../schemas')
const Swarm = require('../swarm')

module.exports.jobSchema = schemas.containerStatePoll

module.exports.task = (job) => {
  const swarm = new Swarm(process.env.SWARM_HOST, job.githubOrgId)

  return swarm.swarmHostExistsAsync(job.host)
  .then((exists) => {
    if (!exists) {
      log.trace('host no longer exists, skip job', { job })
      return
    }
    // TODO refactor passing null as second arg
    const docker = new Docker(job.host, null, process.env.DOCKER_INSPECT_TIMEOUT)
    return docker.inspectContainerAsync(job.id)
    .then((inspectData) => {
      job.inspectData = inspectData
      log.trace('DockerContainerPoll - inspect returned')
      return job
    })
    .catch((err) => {
      return dockerUtils.handleInspectError(job.host, job.githubOrgId, err, log)
    })
    .then((event) => {
      return rabbitmq.publishEvent('container.state.polled', event)
    })
  })
}
