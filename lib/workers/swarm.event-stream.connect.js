/**
 * connect to swarm stream
 * @module lib/workers/swarm.event-stream.connect
 */
'use strict'
require('loadenv')()

const eventManager = require('../event-manager')
const log = require('./logger')()

module.exports = SwarmEventStreamConnect

function SwarmEventStreamConnect () {
  log.trace('SwarmEventStreamConnect')
  return eventManager.startSwarmListener()
}
