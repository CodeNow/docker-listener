/**
 * setup and manage listeners
 * @module lib/event-manager
 */
'use strict'
require('loadenv')({ debugName: 'docker-listener' })

const Docker = require('./docker')
const log = require('./logger')()
const Listener = require('./Listener')

module.exports = class EventManager {
  constuctor () {
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
        return this.startDockListener()
      })
  }

  startSwarmListener () {
    log.info('EventManager.prototype.startSwarmListener')

    this.swarmListener = new Listener(
      process.env.SWARM_HOST,
      null,
      this.start.bind(this)
    )
    return this.swarmListener.start()
  }

  startDockListener (node) {
    log.info('EventManager.prototype.startDockListener')

    this.dockListeners[node.Host] = new Listener(
      node.Host,
      node.Labels.org,
      this.startDockListener.bind(this, node)
    )
    return this.listener.start()
  }
}
