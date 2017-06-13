'use strict'
require('loadenv')()

const Swarm = require('../swarm')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const eventManager = require('../event-manager')

module.exports.task = () => {
  const swarm = new Swarm(process.env.SWARM_HOST)

  return swarm.getNodes()
    .each((node) => {
      if (eventManager.hasListener(node.Host)) {
        log.trace({ host: node.Host }, 'Reconcile Listeners - listener already exists')
        return
      }
      rabbitmq.createStreamConnectJob('docker', node.Host, node.Labels.org)
    })
}

module.exports.maxNumRetries = 2
