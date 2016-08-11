'use strict'
require('loadenv')()

const Joi = require('joi')
const Promise = require('bluebird')

const Swarm = require('../swarm')
const eventManager = require('../event-manager')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const sinceMap = require('../since-map')

exports.jobSchema = Joi.object({
  host: Joi.string().required(),
  org: Joi.string().required(),
  tid: Joi.string()
}).unknown().required().label('job')

module.exports.task = (job) => {
  log.info({ job: job }, 'DockerEventStreamConnect')
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
