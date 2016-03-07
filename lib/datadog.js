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

exports.incEvent = function (event) {
  monitor.increment('docker-event', 1, put({
    event: event.status,
    hostIp: event.ip,
    org: event.org
  }, exports.tags))
}

exports.timer = function (timerName, hostIp, orgId) {
  var tags = {}
  if (hostIp) { tags.hostIp = hostIp }
  if (orgId) { tags.orgId = orgId }
  return monitor.timer(timerName, true, put(tags, exports.tags))
}
