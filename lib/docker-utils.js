'use strict'

const isEmpty = require('101/is-empty')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const log = require('./logger')()
const Docker = require('./docker')
const Swarm = require('./swarm')
const rabbitmq = require('./rabbitmq')

module.exports = class Utils {
  /**
   * Do docker top on a random container. All errors would be catched and logged
   * without propagation
   * This should emit the `top` event.
   * We ignore errors since we will restart if event failed
   * @param  {Object} dockerClient instance of Docker or Swarm client (loki)
   * @returns promise
   * @resolves (null) when test complete
   */
  static testEvent (dockerClient) {
    log.info('test-event')
    return dockerClient.listContainersAsync({
      filters: {
        status: ['running']
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
   * @param  {String} host target host for inspect in the format 10.0.0.1:4242
   * @param  {Error}  err  error from docker inspect
   * @param  {Object} log  current logger
   * @return {Promise}
   * @resolve {undefined}
   * @reject {WorkerStopError} If 404 or dock does not exist
   *         {Error}           If error unknown
   */
  static handleInspectError (host, err, log) {
    const dockerHost = Docker.toDockerHost(host)
    if (err.statusCode === 404) {
      // container is not there anymore. Exit
      const fatalErr = new WorkerStopError(
        err.message,
        { originalError: err }, { level: 'info' }
      )
      log.trace({ err: err }, 'handleInspectError - container not found')
      throw fatalErr
    }
    log.error({ err: err }, 'handleInspectError - inspect error')
    // check to see if host still exist before retrying
    const swarm = new Swarm(process.env.SWARM_HOST)
    return swarm.swarmHostExistsAsync(dockerHost)
      .catch((hostErr) => {
        log.trace({ err: hostErr }, 'handleInspectError - swarmHostExists error')
        // if above errors, throw original error
        throw err
      })
      .then((exists) => {
        if (!exists) {
          rabbitmq.publishEvent('dock.lost', {
            host: Docker.toDockerUrl(dockerHost)
          })
          log.trace('handleInspectError - host does not exist')
          const fatalErr = new WorkerStopError(
            'host does not exist',
            { host: host }, { level: 'info' }
          )
          throw fatalErr
        }

        throw err
      })
  }
}
