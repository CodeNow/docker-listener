'use strict'
require('loadenv')()

const eventManager = require('../event-manager')
const schemas = require('../schemas')

module.exports.jobSchema = schemas.swarmEventsStreamConnect

module.exports.task = () => {
  return eventManager.startSwarmListener()
}
