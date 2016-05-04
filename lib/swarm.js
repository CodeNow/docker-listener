'use strict'
require('loadenv')()

const Promise = require('bluebird')
const SwarmClient = require('@runnable/loki').Swarm
const log = require('./logger')()

module.exports = class Swarm extends SwarmClient {
  /**
   * creates swarm class
   * @param  {String} host docker host format: 10.0.0.0:4242
   * @return {Docker}      Docker instance
   */
  constructor (host) {
    const dockerHost = 'https://' + host
    super({ host: dockerHost, log: log })
  }

  /**
   * get array of nodes
   * @return {Promise}
   * @resolves {Object[]} array of nodes
   */
  getNodes () {
    log.info('Swarm.prototype.getNodes')
    return this.swarmInfoAsync()
      .then((info) => {
        log.trace({ info: info }, 'getNodes - got nodes')
        const nodes = info.parsedSystemStatus.ParsedNodes
        return Promise.map(Object.keys(nodes), (key) => {
          return nodes[key]
        })
      })
  }
}
