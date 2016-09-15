'use strict'
require('loadenv')()
const Promise = require('bluebird')

const eventManager = require('../event-manager')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const schemas = require('../schemas')
const sinceMap = require('../since-map')
const Swarm = require('../swarm')

module.exports.jobSchema = schemas.dockerEventsStreamConnect

module.exports.maxNumRetries = 9

module.exports.retryDelay = 1000

// if we can not connect, we must destory
module.exports.finalRetryFn = (job) => {
  return Promise.try(() => {
    rabbitmq.createDisconnectedJob(job.host, job.org)
  })
}

module.exports.task = (job) => {
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
}
