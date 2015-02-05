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
    debug('publish events to redis');
    if (!chunk) { return callback(); }
    var ev;
    try {
      ev = JSON.parse(chunk.toString());
    } catch (err) {
      return callback(err);
    }

    datadog.inc(ev);
    // if this errors still send raw enchantedEvent
    events.enhance(ev, function(err, enchantedEvent) {
      if (err) { enchantedEvent = ev; }
      var channel = process.env.DOCKER_EVENTS_NAMESPACE + enchantedEvent.status;
      redis.publish(channel, JSON.stringify(enchantedEvent), function (err) {
        if (err) {
          debug('error publishing to redis');
          error.log(err);
          return callback(err);
        }
        callback(null);
      });
    });
  };
}

util.inherits(RedisPublisherStream, stream.Writable);

module.exports = function() {
  return new RedisPublisherStream();
};