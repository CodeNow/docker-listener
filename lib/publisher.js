'use strict';
require('loadenv.js')();
var stream = require('stream');
var redis = require('./redis-client');
var debug = require('debug')('docker-listener:publisher');
var ip = require('ip');


// Stream that publishes messages to the redis.
// TODO (Anton) do we need to use stream2 to handle backpressure and errors?
module.exports = function () {
  var ws = new stream.Stream();
  ws.writable = true;
  ws.write = function (data) {
    debug('publish events to redis');
    var json = JSON.parse(data.toString());
    json.ip = ip.address();
    redis.publish('runnable:docker:' + json.status, JSON.stringify(json), function (err) {
      if (err) {
        debug('error publishing to redis');
      }
    });
  };
  ws.end = function () {
    debug('disconnect');
  };
  return ws;
};