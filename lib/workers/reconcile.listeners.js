'use strict'
require('loadenv')()
const Promise = require('bluebird')

const eventManager = require('../event-manager')

module.exports.task = () => {
  return Promise.try(() => {
    const listeners = eventManager.getListeners()

    // Check swarm for active servers
    // Diff with current l listeners
    // If there is a mismatch create connect event
    console.log(listeners)
  })
}
