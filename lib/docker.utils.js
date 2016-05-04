'use strict'

const datadog = require('./datadog')
const isEmpty = require('101/is-empty')
const log = require('./logger')()

/**
 * Do docker top on a random container.
 * This should emit the `top` event.
 * We ignore errors since we will restart if event failed
 * @param  {Function} cb
 */
module.exports.testEvent = function (dockerClient) {
  log.info('test-event')
  const listTimer = datadog.timer('listContainers.time')
  return dockerClient.listContainersAsync({
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
    log.trace({ container: testContainerId }, 'test-event - got container')

    const topTimer = datadog.timer('top.time')
    return dockerClient.topContainerAsync(testContainerId)
      .then(() => {
        topTimer.stop()
        log.trace({ container: testContainerId }, 'test-event - top successful')
      })
  })
  .catch((err) => {
    log.error({ err: err }, 'testEvent - ' + err.message)
  })
}
