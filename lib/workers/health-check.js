'use strict'
require('loadenv')()
const sinceMap = require('../since-map')
const keypather = require('keypather')()

module.exports.task = () => {
  const lastSuccsefulTestStreamTimestamp = sinceMap.get(eventManager.swarmListener.host)
  if (lastSuccsefulTestStreamTimestamp) {
    const tenMinutesAgoTimestamp = moment.now().substract(10, 'minutes').format('X') // Unix timestamp
    // If last successful ping was more than 10 minutes ago, exit the process
    // New docker listener should come up
    // This depends on the `create-ping-job` job running and succeeding
    if (lastSuccsefulTestStreamTimestamp < tenMinutesAgoTimestamp) {
      process.exit()
    }
  }
}
