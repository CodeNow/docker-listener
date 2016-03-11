/**
 * @module lib/logger
 */
'use strict'

require('loadenv')()

var bunyan = require('bunyan')
var stack = require('callsite')

var logger = bunyan.createLogger({
  name: 'docker-listener',
  streams: [{
    level: process.env.LOG_LEVEL_STDOUT,
    stream: process.stdout
  }],
  serializers: bunyan.stdSerializers,
  // default values included in all log objects
  commit: process.env.npm_package_gitHead,
  environment: process.env.NODE_ENV
})

module.exports = (module) => {
  return logger.child({
    module: module || stack()[1].getFileName()
  }, true)
}
