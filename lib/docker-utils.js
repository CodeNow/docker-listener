'use strict'
const DockerUtils = require('@runnable/loki').Utils
const isEmpty = require('101/is-empty')
const Promise = require('bluebird')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const Docker = require('./docker')
const log = require('./logger')()
const rabbitmq = require('./rabbitmq')
const Swarm = require('./swarm')

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
    const log = log.child({
      method: 'testEvent',
      host: dockerClient.dockerHost
    })
    log.info('called')
    return Utils._findTestContainer(dockerClient)
    .then((testContainerId) => {
      return dockerClient.topContainerAsync(testContainerId)
      .then(() => {
        log.trace({ container: testContainerId }, 'top successful')
      })
    })
    .catch((err) => {
      log.error({ err: err }, 'failed test event: ' + err.message)
    })
  }

  /**
   * find a running container to test with. Docker clients can just use swarm
   * @param  {Docker|Swarm} dockerClient
   * @return {String} running container id
   */
  static _findTestContainer (dockerClient) {
    return Promise.try(() => {
      if (dockerClient instanceof Docker) {
        return 'swarm'
      }

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
        return testContainerId
      })
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
            {
              dockerUrl: DockerUtils.toDockerUrl(dockerHost),
              githubOrgId
            }, { level: 'info' }
          )
          throw fatalErr
        }
        throw err
      })
  }
}
