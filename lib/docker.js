'use strict'
require('loadenv')()

const DockerClient = require('@runnable/loki').Docker

const logger = require('./logger')()

module.exports = class Docker extends DockerClient {
  /**
   * creates docker class
   * @param  {String} host docker host format: 10.0.0.0:4242
   * @return {Docker}      Docker instance
   */
  constructor (host) {
    const dockerHost = 'https://' + host
    super({ host: dockerHost, log: logger })
  }
}
