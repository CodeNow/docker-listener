'use strict'

require('loadenv')()
const log = require('./lib/logger')()

//TODO: hack
const dgram = require('dgram')
const originalCreateSocket = dgram.createSocket
dgram.createSocket = function () {
  log.warn({ stack: new Error('stack check createSocket').stack }, 'XXXX createSocket')
  const out = originalCreateSocket.apply(this, arguments)
  const oldSend = out.send

  out.send = function () {
    log.warn({ stack: new Error('stack check send').stack }, 'XXXX send')
    return oldSend.apply(this, arguments)
  }
  return out
}

const CriticalError = require('error-cat/errors/critical-error')
const ErrorCat = require('error-cat')
const Server = require('./server')

Server.start()
  .catch((err) => {
    if (err) {
      log.fatal({ err: err }, 'server failed to start')
      ErrorCat.report(new CriticalError(
        'server failed to start',
        { err: err }
      ))
      process.exit(1)
    }
  })
