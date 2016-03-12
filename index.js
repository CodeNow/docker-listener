'use strict'

require('loadenv')()

const ErrorCat = require('error-cat')
const log = require('./lib/logger')()
const Server = require('./server')

const error = new ErrorCat()

Server.start(process.env.PORT, (err) => {
  if (err) {
    log.fatal({ err: err }, 'server failed to start')
    error.createAndReport(500, 'failed to start', err)
    process.exit(1)
  }
})
