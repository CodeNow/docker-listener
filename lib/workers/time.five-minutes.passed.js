'use strict'
require('loadenv')()
const Promise = require('bluebird')

const eventManager = require('../event-manager')
const rabbitmq = require('../rabbitmq')

module.exports.task = () => {
  return Promise.all([
    rabbitmq.createReconcileListenersJob({}),
    Promise.try(() => {
      const listeners = eventManager.getListeners()
      Object.keys(listeners).forEach((key) => {
        rabbitmq.createPingJob({
          host: listeners[key].host,
          org: listeners[key].org
        })
      })
    })
  ])
}
