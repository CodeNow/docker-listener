'use strict'
require('loadenv')()

const rabbitmq = require('../rabbitmq')
const schemas = require('../schemas')

module.exports.jobSchema = schemas.swarmEventsStreamConnected

module.exports.task = () => {
  return rabbitmq.createStreamReconcileJob({})
}
