'use strict'
require('loadenv')()
const Promise = require('bluebird')

const eventManager = require('../event-manager')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const schemas = require('../schemas')

module.exports.jobSchema = schemas.dockerEventsStreamPing

module.exports.task = (job) => {
  return Promise.try(() => {
    const listeners = eventManager.getListeners(job.host)
    const listener = listeners[job.host]

    if (listener.state !== 'connected') {
      log.trace({ job }, 'not connected, ignore ping')
      return
    }

    return listener.testStream()
    .catch((err) => {
      log.error({ job, err }, 'failed to ping host, try to connect')
      rabbitmq.createStreamConnectJob('docker', job.host, job.org)
    })
  })
}
