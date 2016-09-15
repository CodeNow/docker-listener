'use strict'
require('loadenv')()

const eventManager = require('../event-manager')
const schemas = require('../schemas')

module.exports.jobSchema = schemas.swarmEventsStreamConnect

// we should try to reconnect forever
module.exports.maxNumRetries = Number.MAX_SAFE_INTEGER

module.exports.task = () => {
  return eventManager.startSwarmListener()
}
