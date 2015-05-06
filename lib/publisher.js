/**
 * @module lib/publisher
 */
'use strict';
var stream = require('stream');
var util = require('util');

var debug = require('auto-debug')();
var error = require('./error');
var events = require('./events');
var redis = require('./redis-client');
var status = require('./status');

module.exports = RedisPublisherStream;

/**
 * @class
 */
function RedisPublisherStream () {
  stream.Writable.call(this);
}

util.inherits(RedisPublisherStream, stream.Writable);

RedisPublisherStream.prototype._write = function (chunk, encoding, callback) {
  debug('publish events to redis', chunk, encoding);
  if (!chunk) { return callback(); }
  var ev;
  try {
    ev = JSON.parse(chunk.toString());
  } catch (err) {
    return callback(err);
  }
  status.count_events = status.count_events + 1;
  status.last_event_time = new Date().toISOString();
  // if this errors still send raw enhanced
  events.enhance(ev, function (err, enhanced) {
    if (err) { enhanced = ev; }
    var channel = process.env.DOCKER_EVENTS_NAMESPACE + enhanced.status;
    var data = JSON.stringify(enhanced);
    debug('redis.publish', channel);
    redis.publish(channel, data, function (err) {
      if (err) {
        debug('error publishing to redis', err);
        error.log(err);
        return callback(err);
      }
      debug('published', data);
      callback(null);
    });
  });
};
