'use strict'
require('loadenv')()

const bunyan = require('bunyan')
const stack = require('callsite')
const put = require('101/put')

const logger = bunyan.createLogger({
  name: process.env.APP_NAME,
  streams: [{
    level: process.env.LOG_LEVEL_STDOUT,
    stream: process.stdout
  }],
  serializers: bunyan.stdSerializers,
  // default values included in all log objects
  commit: process.env.npm_package_gitHead,
  environment: process.env.NODE_ENV
})

module.exports = (opts) => {
  opts = opts || {}
  return logger.child(put({
    module: stack()[1].getFileName()
  }, opts), true)
}
