/**
 * Handle server start/stop requirements
 * @module main
 */
'use strict'
require('loadenv')()

const monitor = require('monitor-dog')

const log = require('./lib/logger')()
const rabbitmq = require('./lib/rabbitmq')
const workerServer = require('./lib/worker-server')

module.exports = class Server {
  /**
   * Listen for events from Docker and publish to rabbitmq
   * @param {String} port
   * @return {Promise}
   */
  static start (port) {
    log.info({ port: port }, 'Server.prototype.start')
    monitor.startSocketsMonitor()
    rabbitmq.connect()
      .then(() => {
        log.info('rabbimq publisher started')
        return workerServer.start()
          .then(() => {
            log.info('all components started')
            rabbitmq.createStreamConnectJob('swarm', process.env.SWARM_HOST, null)
          })
      })
  }
}
