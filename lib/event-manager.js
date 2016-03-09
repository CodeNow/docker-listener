/**
 * setup and manage listeners
 * @module lib/event-manager
 */
'use strict'
require('loadenv')()

const Docker = require('./docker')
const Listener = require('./listener')
const log = require('./logger')()

var EventManager = class EventManager {
  constructor () {
    this.dockListeners = {}
  }

  start () {
    log.info('EventManager.prototype.start')

    return this.startSwarmListener()
      .then(() => {
        const docker = new Docker(process.env.SWARM_HOST)
        return docker.getNodes()
      })
      .each((node) => {
        if (this.dockListeners[node.Host]) {
          return
        }
        return this.startDockListener(node)
      })
  }

  startSwarmListener () {
    log.info('EventManager.prototype.startSwarmListener')

    var swarmListener = new Listener(
      process.env.SWARM_HOST,
      null,
      this.start.bind(this)
    )
    return swarmListener.start()
  }

  startDockListener (node) {
    log.info('EventManager.prototype.startDockListener')

    this.dockListeners[node.Host] = new Listener(
      node.Host,
      node.Labels.org,
      this.startDockListener.bind(this, node)
    )
    return this.dockListeners[node.Host].start()
  }
}

module.exports = new EventManager()
