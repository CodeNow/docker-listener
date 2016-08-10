'use strict'
require('loadenv')()

const monitor = require('monitor-dog')
const put = require('101/put')

const tags = {
  env: process.env.NODE_ENV
}

module.exports = class DataDog {
  static incEvent (event) {
    monitor.increment('docker_event', 1, put({
      event: event.status,
      hostIp: event.ip,
      org: event.org,
      type: event.type
    }, tags))
  }

  static incMsg (msg, hostIp, orgId) {
    monitor.increment('err.' + msg, 1, put({
      hostIp: hostIp,
      org: orgId
    }, tags))
  }
}
