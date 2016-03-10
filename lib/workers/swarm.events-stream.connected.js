/**
 * Get nodes and connect to them
 * @module lib/workers/swarm.event-stream.connected
 */
'use strict'
require('loadenv')()

const Docker = require('../docker')
const log = require('../logger')()
const rabbitmq = require('../rabbitmq')
const eventManager = require('../event-manager')

module.exports = SwarmEventStreamConnected

function SwarmEventStreamConnected () {
  log.trace('SwarmEventStreamConnected')
  const docker = new Docker(process.env.SWARM_HOST)
  return docker.getNodes()
    .each((node) => {
      if (eventManager.getListener[node.Host]) {
        // do nothing if already listening
        return
      }
      rabbitmq.createStreamConnectJob('docker', node.Host, node.Labels.org)
    })
}
