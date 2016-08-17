'use strict'

const isEmpty = require('101/is-empty')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const log = require('./logger')()
const Swarm = require('./swarm')
/**
 * Do docker top on a random container. All errors would be catched and logged
 * without propagation
 * This should emit the `top` event.
 * We ignore errors since we will restart if event failed
 * @param  {Object} dockerClient instance of Docker or Swarm client (loki)
 * @returns promise
 * @resolves (null) when test complete
 */
module.exports.testEvent = function (dockerClient) {
  log.info('test-event')
  return dockerClient.listContainersAsync({
    filters: {
      state: ['running']
    }
  })
  .then((containers) => {
    if (isEmpty(containers)) {
      throw new Error('no running containers found')
    }
    const testContainerId = containers[0].Id
    log.trace({ container: testContainerId }, 'test-event - got container')
    return dockerClient.topContainerAsync(testContainerId)
      .then(() => {
        log.trace({ container: testContainerId }, 'test-event - top successful')
      })
  })
  .catch((err) => {
    log.error({ err: err }, 'testEvent - ' + err.message)
  })
}

/**
 * handles inspect errors.
 * if 404 call task fatal
 *   else check if the dock still exists
 *   throw task fatal if it does not
 * @param  {String} host target host for inspect
 * @param  {Error}  err  error from docker inspect
 * @param  {Object} log  current logger
 * @return {Promise}
 * @resolve {undefined}
 * @reject {WorkerStopError} If 404 or dock does not exist
 *         {Error}          If error unknown
 * @throws {WorkerStopError} If 404 or dock does not exist
 */
module.exports._handleInspectError = (host, err, log) => {
  if (err.statusCode === 404) {
    // container is not there anymore. Exit
    const fatalErr = new WorkerStopError(
      err.message,
      { originalError: err }, { level: 'info' }
    )
    log.trace({ err: err }, '_handleInspectError - container not found')
    throw fatalErr
  }
  log.error({ err: err }, '_handleInspectError - inspect error')
  // check to see if host still exist before retrying
  const swarm = new Swarm(process.env.SWARM_HOST)
  return swarm.swarmHostExistsAsync(host)
    .catch((hostErr) => {
      log.trace({ err: hostErr }, '_handleInspectError - swarmHostExists error')
      // if above errors, throw original error
      throw err
    })
    .then((exists) => {
      if (!exists) {
        log.trace('_handleInspectError - host does not exist')
        const fatalErr = new WorkerStopError(
          'host does not exist',
          { host: host }
        )
        fatalErr.report = false
        throw fatalErr
      }

      throw err
    })
}
