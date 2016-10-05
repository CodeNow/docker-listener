'use strict'
require('loadenv')()

const DockerClient = require('@runnable/loki').Docker
const logger = require('./logger')()

module.exports = class Docker extends DockerClient {
  /**
   * creates docker class
   * @param  {String} host docker host format: 10.0.0.0:4242
   * @param  {String} orgGitHubId org github id
   * @param  {Number} timeout optional timeout
   * @return {Docker}      Docker instance
   */
  constructor (host, orgGitHubId, timeout) {
    const dockerHost = 'https://' + Docker.toDockerHost(host)
    const opts = {
      host: dockerHost,
      log: logger
    }
    if (timeout) {
      opts.timeout = timeout
    }
    const tags = {}
    if (orgGitHubId) {
      tags.orgGitHubId = orgGitHubId
    }
    opts.datadogTags = tags
    super(opts)
  }

  static toDockerHost (url) {
    return url.replace('http://', '')
  }

  static toDockerUrl (host) {
    const ensuredHost = Docker.toDockerHost(host)
    return 'http://' + ensuredHost
  }
}
