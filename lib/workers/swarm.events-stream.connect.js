'use strict'
require('loadenv')()

const eventManager = require('../event-manager')
const log = require('../logger')()

module.exports = () => {
  log.trace('SwarmEventStreamConnect')
  return eventManager.startSwarmListener()
}
