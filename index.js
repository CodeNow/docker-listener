'use strict'

require('loadenv')()

const errorCat = require('error-cat')
const log = require('./lib/logger')()
const Server = require('./server')

Server.start(process.env.PORT, (err) => {
  if (err) {
    log.fatal({ err: err }, 'server failed to start')
    errorCat.report(new Error('failed to start'))
    process.exit(1)
  }
})
