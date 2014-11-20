'use strict';
require('loadenv.js')();
var stream = require('stream');
var ip = require('ip');
var util = require('util');
var debug = require('debug')('docker-listener:datadog');
var StatsD = require('node-dogstatsd').StatsD;
var client = new StatsD(
  process.env.DATADOG_HOST,
  process.env.DATADOG_PORT);


function DatadogPublisherStream() {
  var self = this;

  stream.Writable.call(self);

  self._write = function(chunk, encoding, callback) {
    debug('publish events to datadog');
    var json = JSON.parse(chunk.toString());
    inc(json);
    callback();
  };
}

util.inherits(DatadogPublisherStream, stream.Writable);

exports.stream = function() {
  return new DatadogPublisherStream();
};


function toTags (event) {
  var json = {
    event: event.status,
    ip: ip.address(),
    env: process.env.NODE_ENV
  };
  return Object.keys(json).map(function(key) {
    return key + ':' + json:[key];
  });
}

var inc = exports.inc = function (event) {
  client.increment('docker.listener.' + event.status, 1, toTags(event));
};