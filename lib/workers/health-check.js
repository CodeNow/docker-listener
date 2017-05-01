'use strict'
require('loadenv')()
const eventManager = require('../event-manager')
const keypather = require('keypather')()

module.exports.task = () => {
  const lastSuccsefulTestStream = keypather.get(eventManager,'swarmListener.lastSuccsefulTestStream')
  if (lastSuccsefulTestStream) {
    const lastSuccsefulTestStreamTimestamp = lastSuccsefulTestStream.format('X') // Unix timestamp
    const tenMinutesAgoTimestamp = moment.now().substract(10, 'minutes').format('X')
    // If last successful ping was more than 10 minutes ago, exit the process
    // New docker listener should come up
    // This depends on the `create-ping-job` job running and succeeding
    if (lastSuccsefulTestStreamTimestamp < tenMinutesAgoTimestamp) {
      process.exit()
    }
  }
}
