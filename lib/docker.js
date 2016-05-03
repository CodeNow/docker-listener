'use strict'
require('loadenv')()

const isEmpty = require('101/is-empty')
const DockerClient = require('loki').Docker

const datadog = require('./datadog')
const log = require('./logger')()

module.exports = class Docker extends DockerClient {
  /**
   * creates docker class
   * @param  {String} host docker host format: 10.0.0.0:4242
   * @return {Docker}      Docker instance
   */
  constructor (host) {
    const dockerHost = 'https://' + host
    super({ host: dockerHost })
  }

  /**
   * Do docker top on a random container.
   * This should emit the `top` event.
   * We ignore errors since we will restart if event failed
   * @param  {Function} cb [description]
   */
  testEvent () {
    log.info('Docker.prototype.testEvent')
    const listTimer = datadog.timer('listContainers.time')
    return this.listContainersAsync({
      filters: {
        state: ['running']
      }
    })
    .then((containers) => {
      listTimer.stop()
      if (isEmpty(containers)) {
        throw new Error('no running containers found')
      }
      const testContainerId = containers[0].Id
      log.trace({ container: testContainerId }, 'testEvent - got container')

      const topTimer = datadog.timer('top.time')
      return this.topContainerAsync(testContainerId)
      .then(() => {
        topTimer.stop()
        log.trace({ container: testContainerId }, 'testEvent - top successful')
      })
    })
    .catch((err) => {
      log.error({ err: err }, 'testEvent - ' + err.message)
    })
  }
}
