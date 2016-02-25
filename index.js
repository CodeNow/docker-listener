/**
 * @module index
 */
'use strict'

require('loadenv')()

var ErrorCat = require('error-cat')
var log = require('./lib/logger').getChild(__filename)
var Server = require('./server')

var error = new ErrorCat()
var server = new Server()

server.start(process.env.PORT, function (err) {
  if (err) {
    log.fatal({ err: err }, 'server failed to start')
    error.createAndReport(500, 'failed to start', err)
    process.exit(1)
  }
})
