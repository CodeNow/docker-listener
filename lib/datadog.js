/**
 * @module lib/datadog
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })
var monitor = require('monitor-dog')
var put = require('101/put')

var baseName = 'docker-listener.'

exports.tags = {
  env: process.env.NODE_ENV
}

exports.incEvent = function (event) {
  monitor.increment(baseName + '.docker-event', 1, put({
    event: event.status,
    hostIp: event.ip,
    org: event.org
  }, exports.tags))
}

exports.timer = function (timerName, hostIp, orgId) {
  return monitor.timer(baseName + timerName, true, put({ hostIp: hostIp }, exports.tags))
}
