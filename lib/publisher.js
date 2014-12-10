'use strict';
require('./loadenv')();
var stream = require('stream');
var util = require('util');
var redis = require('./redis-client');
var error = require('./error');
var debug = require('debug')('docker-listener:publisher');
var events = require('./events');



function RedisPublisherStream() {
  var self = this;

  stream.Writable.call(self);

  self._write = function(chunk, encoding, callback) {
    debug('publish events to redis');
    if (chunk) {
      try {
        var json = JSON.parse(chunk.toString());
        json = events.enhanceEvent(json);
        var channel = process.env.DOCKER_EVENTS_NAMESPACE + json.status;
        redis.publish(channel, JSON.stringify(json), function (err) {
          if (err) {
            debug('error publishing to redis');
            error.log(err);
            callback(err);
          }
          callback(null);
        });
      }
      catch (err) {
        callback(err);
      }
    }
    else {
      callback();
    }
  };
}

util.inherits(RedisPublisherStream, stream.Writable);

module.exports = function() {
  return new RedisPublisherStream();
};