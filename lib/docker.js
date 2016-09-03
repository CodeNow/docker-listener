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
    const dockerHost = 'https://' + Docker.toDockerHost(host)
    super({ host: dockerHost, log: logger })
  }

  static toDockerHost (url) {
    return url.replace('http://', '')
  }

  static toDockerUrl (host) {
    const ensuredHost = Docker.toDockerHost(host)
    return 'http://' + ensuredHost
  }
}
