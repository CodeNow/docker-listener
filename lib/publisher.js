'use strict';
require('loadenv.js')();
var stream = require('stream');
var redis = require('./redis-client');
var debug = require('debug')('docker-listener:publisher');
var ip = require('ip');

var util = require('util');


function RedisPublisherStream() {
  var self = this;

  stream.Writable.call(self);

  self._write = function(chunk, encoding, callback) {
    debug('publish events to redis');
    var json = JSON.parse(chunk.toString());
    json.ip = ip.address();
    redis.publish('runnable:docker:' + json.status, JSON.stringify(json), function (err) {
      if (err) {
        debug('error publishing to redis');
        callback(err);
      }
      callback(null);
    });
  };
}

util.inherits(RedisPublisherStream, stream.Writable);

module.exports = function() {
  return new RedisPublisherStream();
};