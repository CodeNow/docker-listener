'use strict'

require('loadenv')()
const log = require('./lib/logger')()

//TODO: hack
const dgram = require('dgram')
const originalCreateSocket = dgram.createSocket
dgram.createSocket = function (type, a, b, c, d, f, g) {
  log.warn({ stack: new Error('stack check createSocket').stack }, 'XXXX createSocket')
  const out = originalCreateSocket(type, a, b, c, d, f, g)
  const oldSend = out.send
  out.send = function (a,b,c,d,e,f,g,h,i) {
    log.warn({ stack: new Error('stack check send').stack }, 'XXXX send')
    return oldSend(a,b,c,d,e,f,g,h,i)
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
