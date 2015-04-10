/**
 * @module lib/publisher
 */
'use strict';

require('loadenv')('docker-listener:env');

var stream = require('stream');
var util = require('util');

var debug = require('debug')('docker-listener:listener');

var datadog = require('./datadog');
var error = require('./error');
var events = require('./events');
var redis = require('./redis-client');

module.exports = function() {
  return new RedisPublisherStream();
};

/**
 * @class
 */
function RedisPublisherStream() {
  var self = this;
  stream.Writable.call(self);
  self._write = function(chunk, encoding, callback) {
    debug('publish events to redis', chunk, encoding);
    if (!chunk) { return callback(); }
    var ev;
    try {
      ev = JSON.parse(chunk.toString());
    } catch (err) {
      return callback(err);
    }
    datadog.inc(ev);
    // if this errors still send raw enhanced
    events.enhance(ev, function(err, enhanced) {
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
}

util.inherits(RedisPublisherStream, stream.Writable);
