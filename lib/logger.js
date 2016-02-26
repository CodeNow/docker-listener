/**
 * @module lib/logger
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })

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

module.exports = function () {
  return logger.child({
    module: stack()[1].getFileName()
  }, true)
}
