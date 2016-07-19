'use strict'

require('loadenv')()

const ErrorCat = require('error-cat')
const log = require('./lib/logger')()
const Server = require('./server')

Server.start(process.env.PORT)
  .catch((err) => {
    if (err) {
      log.fatal({ err: err }, 'server failed to start')
      ErrorCat.report(new CriticalError(
        'server failed to start',
        { err: err }
      ))
      process.exit(1)
    }
  }
