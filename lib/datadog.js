/**
 * @module lib/datadog
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })
var stream = require('stream')
var util = require('util')
var monitor = require('monitor-dog')

var log = require('./logger')()

exports.tags = {
  env: process.env.NODE_ENV
}

function DatadogStream () {
  stream.Writable.call(this)
}

util.inherits(DatadogStream, stream.Writable)

DatadogStream.prototype._write = function (chunk, encoding, callback) {
  log.trace('publish events to datadog')
  if (chunk) {
    try {
      var json = JSON.parse(chunk.toString())
      inc(json.status)
      callback()
    } catch (err) {
      callback(err)
    }
  } else {
    callback()
  }
}

exports.stream = DatadogStream

var inc = exports.inc = function (eventName) {
  monitor.increment(eventName, 1, exports.tags)
}
