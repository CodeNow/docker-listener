'use strict'
require('loadenv')()
const sinceMap = require('../since-map')
const moment = require('moment')
const log = require('../logger')()

module.exports.task = () => {
  const lastSuccsefulTestStreamTimestamp = sinceMap.get(eventManager.swarmListener.host)
  log.trace({ lastSuccsefulTestStreamTimestamp }, 'Last succseful test stream timestamp')
  if (lastSuccsefulTestStreamTimestamp) {
    const tenMinutesAgoTimestamp = moment.now().substract(10, 'minutes').format('X') // Unix timestamp
    // If last successful ping was more than 10 minutes ago, exit the process
    // New docker listener should come up
    // This depends on the `create-ping-job` job running and succeeding
    log.trace({ lastSuccsefulTestStreamTimestamp, tenMinutesAgoTimestamp }, 'Compare')
    if (lastSuccsefulTestStreamTimestamp < tenMinutesAgoTimestamp) {
      log.fatal({ lastSuccsefulTestStreamTimestamp, tenMinutesAgoTimestamp }, 'Health check failed. Exiting process')
      process.exit()
    }
  }
}
