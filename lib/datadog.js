/**
 * @module lib/datadog
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })
var monitor = require('monitor-dog')
var put = require('101/put')

exports.tags = {
  env: process.env.NODE_ENV
}

exports.inc = function (eventName, hostIp, orgId) {
  monitor.increment(eventName, 1, put({ hostIp: hostIp }, exports.tags))
}

exports.timer = function (timerName, hostIp, orgId) {
  return monitor.timer(timerName, true, put({ hostIp: hostIp }, exports.tags))
}
