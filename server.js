/**
 * Handle server start/stop requirements
 * @module main
 */
'use strict'
require('loadenv')()

var monitor = require('monitor-dog')

var app = require('./lib/app.js')
var eventManager = require('./lib/event-manager')
var log = require('./lib/logger')()
var RabbitMQ = require('./lib/rabbitmq')

function Server () {}

module.exports = Server

/**
 * Listen for events from Docker and publish to RabbitMQ
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
    RabbitMQ.connect(function (err) {
      if (err) {
        log.error({ err: err }, 'start: error connecting to rabbit')
        return cb(err)
      }
      log.trace('start: rabbitmq connected')

      eventManager.start().asCallback(cb)
    })
  })
}
