/**
 * @module lib/datadog
 */
'use strict'
require('loadenv')()

var monitor = require('monitor-dog')
var put = require('101/put')

exports.tags = {
  env: process.env.NODE_ENV
}

exports.incEvent = (event) => {
  monitor.increment('docker_event', 1, put({
    event: event.status,
    hostIp: event.ip,
    org: event.org,
    type: event.type
  }, exports.tags))
}

exports.incMsg = (msg, hostIp, orgId) => {
  monitor.increment('err.' + msg, 1, put({
    hostIp: hostIp,
    org: orgId
  }, exports.tags))
}

exports.timer = (timerName, hostIp, orgId) => {
  var tags = {}
  if (hostIp) { tags.hostIp = hostIp }
  if (orgId) { tags.orgId = orgId }
  return monitor.timer(timerName, true, put(tags, exports.tags))
}
