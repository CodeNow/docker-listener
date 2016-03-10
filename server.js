/**
 * Handle server start/stop requirements
 * @module main
 */
'use strict'
require('loadenv')()

var monitor = require('monitor-dog')

var log = require('./lib/logger')()
var rabbitmq = require('./lib/rabbitmq')

module.exports = class Server {
  /**
   * Listen for events from Docker and publish to rabbitmq
   * @param {String} port
   * @param {Function} cb
   */
  static start (port, cb) {
    log.info({ port: port }, 'Server.prototype.start')
    monitor.startSocketsMonitor()
    rabbitmq.connect((err) => {
      if (err) {
        log.error({ err: err }, 'start: error connecting to rabbit')
        return cb(err)
      }
      log.trace('start: rabbitmq connected')

      rabbitmq.createStreamConnectJob('swarm', process.env.SWARM_HOST, null)
      cb()
    })
  }
}
