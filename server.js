/**
 * Handle server start/stop requirements
 * @module main
 */
'use strict'
require('loadenv')()

var monitor = require('monitor-dog')

var app = require('./lib/app.js')
var Publisher = require('./lib/publisher')
var RabbitMQ = require('./lib/rabbitmq')
var log = require('./lib/logger').getChild(__filename)
var Listener = require('./lib/listener')

function Server () {
  this.server = null
  this.listener = null
}
module.exports = Server

/**
 * Listen for events from Docker and publish to RabbitMQ
 * @param {String} port
 * @param {Function} cb
 */
Server.prototype.start = function (port, cb) {
  var self = this
  log.info({ port: port }, 'start: server listen')

  this.server = app.listen(port, function (err) {
    log.trace({ err: err }, 'start: server listen')
    if (err) { return cb(err) }
    monitor.startSocketsMonitor()
    RabbitMQ.connect(function (err) {
      log.trace({ err: err }, 'start: rabbitmq connected')
      if (err) { return cb(err) }
      var publisher = new Publisher()
      var listener = new Listener(publisher)
      self.listener = listener
      listener.once('started', function () {
        log.trace('start: listener started')
        cb()
      })
      listener.start()
    })
  })
}

/**
 * Drain remaining requests and shut down
 * @param {Function} cb
 */
Server.prototype.stop = function (cb) {
  var self = this
  if (!this.server) {
    return cb(new Error('Trying to stop when server was not started'))
  }
  this.server.close(function (err) {
    if (err) { return cb(err) }
    monitor.stopSocketsMonitor()
    if (self.listener) {
      self.listener.stop()
    }
    RabbitMQ.close(cb)
  })
}
