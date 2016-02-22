/**
 * @module lib/publisher
 */
'use strict'
var stream = require('stream')
var util = require('util')

var rabbitmq = require('./rabbitmq')
var log = require('./logger').getChild(__filename)
var status = require('./status')

module.exports = RabbitPublisherStream

/**
 * @class
 */
function RabbitPublisherStream () {
  stream.Writable.call(this)
}

util.inherits(RabbitPublisherStream, stream.Writable)

RabbitPublisherStream.prototype._write = function (chunk, encoding, callback) {
  log.trace({
    chunk: chunk,
    encoding: encoding
  }, 'RabbitPublisherStream.prototype._write')
  if (!chunk) { return callback() }
  var ev
  try {
    ev = JSON.parse(chunk.toString())
  } catch (err) {
    return callback(err)
  }
  if (isBlacklisted(ev)) {
    // do nothing
    return callback(null)
  }
  status.count_events = status.count_events + 1
  status.last_event_time = new Date().toISOString()
  rabbitmq.createPublishJob(ev)
  callback(null)
}

// Ignore events from blacklisted containers
function isBlacklisted (ev) {
  // swarm format of from includes node ex.
  // from: "swarm:1.0.1 node:ip-10-4-129-158"
  var fromImage = ev.from.split(' ')[0]
  var blackList = process.env.CONTAINERS_BLACKLIST.split(',')
  var isBlocked = blackList.some(function (item) {
    return ~fromImage.indexOf(item)
  })
  return isBlocked
}
