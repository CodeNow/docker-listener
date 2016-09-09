'use strict'
require('loadenv')()

const Swarm = require('../swarm')
const eventManager = require('../event-manager')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const sinceMap = require('../since-map')

const schemas = require('../schemas')

module.exports.jobSchema = schemas.eventsStreamConnect

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
