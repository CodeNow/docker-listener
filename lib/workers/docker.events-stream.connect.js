'use strict'
require('loadenv')()

const Joi = require('joi')
const Promise = require('bluebird')
const TaskFatalError = require('ponos').TaskFatalError

const Swarm = require('../swarm')
const eventManager = require('../event-manager')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const sinceMap = require('../since-map')

module.exports = (job) => {
  log.info({ job: job }, 'DockerEventStreamConnect')

  const schema = {
    host: Joi.string().required(),
    org: Joi.string().required()
  }

  return Promise.fromCallback((cb) => {
    Joi.validate(job, schema, cb)
  })
  .catch(() => {
    throw new TaskFatalError(
      'docker.event-stream.connect',
      'Job has invalid data',
      { job: job, schema: Object.keys(schema) }
    )
  })
  .then(() => {
    const swarm = new Swarm(process.env.SWARM_HOST)
    return swarm.swarmHostExistsAsync(job.host)
      .then((exists) => {
        if (!exists) {
          log.trace({ job: job }, 'DockerEventStreamConnect - host does not exist')
          sinceMap.delete(job.host)
          eventManager.removeDockListener(job.host)
          rabbitmq.createDisconnectedJob(job.host, job.org)
          return
        }
        return eventManager.startDockListener(job.host, job.org)
      })
  })
}
