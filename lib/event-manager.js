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

  /**
   * start one listener for swarm and one listener per dock
   * @return {Promise}
   * @resolves nothing when listener started
   */
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

  /**
   * create and start listener for swarm node
   * @return {Promise}
   * @resolves nothing when listener started
   */
  startSwarmListener () {
    log.info('EventManager.prototype.startSwarmListener')

    var swarmListener = new Listener(
      process.env.SWARM_HOST,
      null,
      this.start.bind(this)
    )
    return swarmListener.start()
  }

  /**
   * create listener for node and add it to map
   * @param  {Object} node             to attach listener to
   * @param  {Object} node.Host        address of docker deamon format: 10.0.0.1:4242
   * @param  {Object} node.Labels.org  github org of node
   * @return {Promise}
   * @resolves nothing when listener started
   */
  startDockListener (node) {
    log.info({ node: node }, 'EventManager.prototype.startDockListener')

    this.dockListeners[node.Host] = new Listener(
      node.Host,
      node.Labels.org,
      this.startDockListener.bind(this, node)
    )
    return this.dockListeners[node.Host].start()
  }
}

module.exports = new EventManager()
