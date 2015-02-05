'use strict';
require('./loadenv')();
var stream = require('stream');
var util = require('util');
var redis = require('./redis-client');
var error = require('./error');
var debug = require('debug')('docker-listener:publisher');
var datadog = require('./datadog');
var events = require('./events');

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

module.exports = function() {
  return new RedisPublisherStream();
};