'use strict'

const isEmpty = require('101/is-empty')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const log = require('./logger')()
const DockerUtils = require('@runnable/loki').Utils
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
    log.info('testEvent')
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
      log.trace({ container: testContainerId }, 'testEvent - got container')
      return dockerClient.topContainerAsync(testContainerId)
        .then(() => {
          log.trace({ container: testContainerId }, 'testEvent - top successful')
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
   * @param  {String} githubOrgId org github id
   * @param  {Error}  err  error from docker inspect
   * @param  {Object} log  current logger
   * @return {Promise}
   * @resolve {undefined}
   * @reject {WorkerStopError} If 404 or dock does not exist
   *         {Error}           If error unknown
   */
  static handleInspectError (host, githubOrgId, err, log) {
    const dockerHost = DockerUtils.toDockerHost(host)
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
    const swarm = new Swarm(process.env.SWARM_HOST, githubOrgId)
    return swarm.swarmHostExistsAsync(dockerHost)
      .catch((hostErr) => {
        log.info({ err: hostErr }, 'handleInspectError - swarmHostExists error')
        // if above errors, throw original error
        throw err
      })
      .then((exists) => {
        if (!exists) {
          const dockLostPayload = {
            host: DockerUtils.toDockerUrl(dockerHost),
            githubOrgId: githubOrgId
          }
          rabbitmq.publishEvent('dock.lost', dockLostPayload)
          log.info(dockLostPayload, 'handleInspectError - host does not exist')
          const fatalErr = new WorkerStopError(
            'host does not exist',
            dockLostPayload, { level: 'info' }
          )
          throw fatalErr
        }
        throw err
      })
  }
}
