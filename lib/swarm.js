'use strict'
require('loadenv')()

const Promise = require('bluebird')
const SwarmClient = require('@runnable/loki').Swarm
const logger = require('./logger')()

module.exports = class Swarm extends SwarmClient {
  /**
   * creates swarm class
   * @param  {String} host docker host format: 10.0.0.0:4242
   * @param  {String} orgGitHubId org github id
   * @return {Docker}      Docker instance
   */
  constructor (host, orgGitHubId) {
    const dockerHost = 'https://' + host
    const tags = {}
    if (orgGitHubId) {
      tags.orgGitHubId = orgGitHubId
    }
    super({ host: dockerHost, log: logger, datadogTags: tags })
  }

  /**
   * get array of nodes
   * @return {Promise}
   * @resolves {Object[]} array of nodes
   */
  getNodes () {
    const log = logger.child({
      module: 'Swarm',
      method: 'getNodes'
    })
    log.info('call')
    return this.swarmInfoAsync()
      .then((info) => {
        log.trace({ info: info }, 'got nodes')
        const nodes = info.parsedSystemStatus.ParsedNodes
        return Promise.map(Object.keys(nodes), (key) => {
          return nodes[key]
        })
      })
  }
}
