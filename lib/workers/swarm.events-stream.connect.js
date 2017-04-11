'use strict'
require('loadenv')()

const eventManager = require('../event-manager')
const schemas = require('../schemas')

module.exports.jobSchema = schemas.swarmEventsStreamConnect

// we should try to reconnect forever
module.exports.maxNumRetries = Number.MAX_SAFE_INTEGER
// make this 3 times the event timeout
module.exports.msTimeout = process.env.EVENT_TIMEOUT_MS * 3

module.exports.task = () => {
  return eventManager.startSwarmListener()
}
