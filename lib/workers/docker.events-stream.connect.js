/**
 * connect to docker stream
 * @module lib/workers/docker.event-stream.connect
 */
'use strict'
require('loadenv')()

const Joi = require('joi')
const TaskFatalError = require('ponos').TaskFatalError
const Promise = require('bluebird')

const Docker = require('../docker')
const eventManager = require('../event-manager')
const log = require('../logger')()

module.exports = DockerEventStreamConnect

function DockerEventStreamConnect (job) {
  log.info({ job: job }, 'DockerEventStreamConnect')

  var schema = {
    host: Joi.string(),
    org: Joi.string()
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
    const docker = new Docker(process.env.SWARM_HOST)
    docker.swarmHostExists(job.host)
    .then((exists) => {
      if (!exists) {
        log.trace({ job: job }, 'DockerEventStreamConnect - host does not exist')
        eventManager.removeDockListener(job.host)
        return
      }
      return eventManager.startDockListener(job.host, job.org)
    })
  })
}
