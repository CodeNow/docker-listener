/**
 * @module lib/logger
 */
'use strict'

require('loadenv')()

var bunyan = require('bunyan')
var clone = require('101/clone')
var hasKeypaths = require('101/has-keypaths')
var put = require('101/put')
var stack = require('callsite')

var serializers = put(bunyan.stdSerializers, {
  job: function (job) {
    job = clone(job)
    if (hasKeypaths(job, { 'event.type': 'Buffer' })) {
      job.event = new Buffer(job.event.data).toString()
    }

    if (Buffer.isBuffer(job.event)) {
      job.event = job.event.toString()
    }
    return job
  }
})

var logger = bunyan.createLogger({
  name: 'docker-listener',
  streams: [{
    level: process.env.LOG_LEVEL_STDOUT,
    stream: process.stdout
  }],
  serializers: serializers,
  // default values included in all log objects
  commit: process.env.npm_package_gitHead,
  environment: process.env.NODE_ENV
})

module.exports = function () {
  return logger.child({
    module: stack()[1].getFileName()
  })
}

module.exports.logger = logger
