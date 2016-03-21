'use strict'
require('loadenv')()

const Listener = require('./listener')
const log = require('./logger')()

class EventManager {
  constructor () {
    this.dockListeners = {}
    this.swarmConnected = null
  }

  /**
   * create and start listener for swarm node
   * @return {Promise}
   * @resolves nothing when listener started
   */
  startSwarmListener () {
    log.info('EventManager.prototype.startSwarmListener')
    // if swarm listener has not disconnected, do nothing
    if (this.swarmListener && !this.swarmListener.isDisconnected())  {
      log.warn('swarm listener is still connected')
      return
    }

    this.swarmListener = new Listener(process.env.SWARM_HOST, null)
    return this.swarmListener.start()
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

    // if dock listener has not disconnected, do nothing
    if (this.dockListeners[host] && !this.dockListeners[host].isDisconnected())  {
      log.warn({ host: host }, 'docker listener is still connected')
      return
    }
    this.dockListeners[host] = new Listener(host, org)
    return this.dockListeners[host].start()
  }

  /**
   * checks if listener exists
   * @param  {String} host format: 10.0.0.1:4242
   * @return {Boolean}     true if listener exists
   */
  hasListener (host) {
    const exists = !!this.dockListeners[host]
    log.info({ host: host, exists: !!exists }, 'EventManager.prototype.hasListener')

    return exists
  }

  /**
   * delete listener from map
   * @param  {String} host formatL 10.0.0.1:4242
   */
  removeDockListener (host) {
    log.info({ host: host }, 'EventManager.prototype.removeDockListener')

    delete this.dockListeners[host]
  }
}

module.exports = new EventManager()
