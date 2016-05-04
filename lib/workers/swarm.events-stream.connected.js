'use strict'
require('loadenv')()

const Swarm = require('../swarm')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const eventManager = require('../event-manager')

module.exports = () => {
  log.trace('SwarmEventStreamConnected')
  const swarm = new Swarm(process.env.SWARM_HOST)

  return swarm.getNodes()
    .each((node) => {
      if (eventManager.hasListener(node.Host)) {
        // do nothing if already listening
        log.trace({ host: node.Host }, 'SwarmEventStreamConnected - listener already exists')
        return
      }
      rabbitmq.createStreamConnectJob('docker', node.Host, node.Labels.org)
    })
}
