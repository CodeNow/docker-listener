/**
 * Handle server start/stop requirements
 * @module main
 */
'use strict'
require('loadenv')()

var monitor = require('monitor-dog')

var app = require('./lib/app.js')
var log = require('./lib/logger')()
var rabbitmq = require('./lib/rabbitmq')

function Server () {}

module.exports = Server

/**
 * Listen for events from Docker and publish to rabbitmq
 * @param {String} port
 * @param {Function} cb
 */
Server.prototype.start = function (port, cb) {
  log.info({ port: port }, 'Server.prototype.start')

  app.listen(port, function (err) {
    if (err) {
      log.error({ err: err }, 'start: error starting to listen')
      return cb(err)
    }
    log.trace('start: server listening')

    monitor.startSocketsMonitor()
    rabbitmq.connect(function (err) {
      if (err) {
        log.error({ err: err }, 'start: error connecting to rabbit')
        return cb(err)
      }
      log.trace('start: rabbitmq connected')

      rabbitmq.createStreamConnectJob('swarm', process.env.SWARM_HOST, null)
    })
  })
}
