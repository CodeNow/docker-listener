/**
 * @module lib/logger
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })

var bsyslog = require('bunyan-syslog')
var bunyan = require('bunyan')
var Bunyan2Loggly = require('bunyan-loggly').Bunyan2Loggly
var execSync = require('child_process').execSync
var keypather = require('keypather')()
var path = require('path')
var put = require('101/put')

process.env.VERSION_GIT_COMMIT = execSync('git rev-parse HEAD')
process.env.VERSION_GIT_BRANCH = execSync('git rev-parse --abbrev-ref HEAD')

var streams = [{
  level: process.env.LOG_LEVEL_STDOUT,
  stream: process.stdout
}]

streams.push({
  level: process.env.LOG_LEVEL,
  type: 'raw',
  // Defaults to attempting syslogd at 127.0.0.1:514
  stream: bsyslog.createBunyanStream({
    type: 'sys',
    facility: bsyslog.local7,
    host: '127.0.0.1',
    port: 514
  })
})

if (process.env.LOGGLY_TOKEN) {
  streams.push({
    level: process.env.LOG_LEVEL,
    stream: new Bunyan2Loggly({
      token: process.env.LOGGLY_TOKEN,
      subdomain: 'sandboxes'
    }),
    type: 'raw'
  })
}

var serializers = put(bunyan.stdSerializers, {
  tx: function () {
    // TODO pull of log data
    return keypather.get(process.domain, 'runnableData')
  },
  req: function (req) {
    return {
      method: req.method,
      url: req.url,
      isInternalRequest: req.isInternalRequest
    }
  }
})

var logger = module.exports = bunyan.createLogger({
  name: 'docker-listener',
  streams: streams,
  serializers: serializers,
  // default values included in all log objects
  branch: process.env.VERSION_GIT_COMMIT,
  commit: process.env.VERSION_GIT_BRANCH,
  environment: process.env.NODE_ENV
})

/**
 * Initiate and return child instance
 */
module.exports.getChild = function (moduleName) {
  moduleName = path.relative(process.cwd(), moduleName)
  return logger.child({ module: moduleName }, true)
}
