/**
 * setup and manage listeners
 * @module lib/event-manager
 */
'use strict'
require('loadenv')()

const Listener = require('./listener')
const log = require('./logger')()

class EventManager {
  constructor () {
    this.dockListeners = {}
  }

  /**
   * create and start listener for swarm node
   * @return {Promise}
   * @resolves nothing when listener started
   */
  startSwarmListener () {
    log.info('EventManager.prototype.startSwarmListener')

    var swarmListener = new Listener(process.env.SWARM_HOST, null)
    return swarmListener.start()
  }

  /**
   * create listener for node and add it to map
   * @param  {Object} host address of docker deamon format: 10.0.0.1:4242
   * @param  {Object} org  github org of node
   * @return {Promise}
   * @resolves nothing when listener started
   */
  startDockListener (host, org) {
    log.info({ host: host, org: org }, 'EventManager.prototype.startDockListener')

    this.dockListeners[host] = new Listener(host, org)
    return this.dockListeners[host].start()
  }

  removeDockListener (host) {
    delete this.dockListeners[host]
  }
}

module.exports = new EventManager()
