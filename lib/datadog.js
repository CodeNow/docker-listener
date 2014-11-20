'use strict';
require('loadenv.js')();
var stream = require('stream');
var util = require('util');
var debug = require('debug')('docker-listener:datadog');
var StatsD = require('node-dogstatsd').StatsD;
var client = module.exports = new StatsD(
  process.env.DATADOG_HOST,
  process.env.DATADOG_PORT);


function DatadogPublisherStream() {
  var self = this;

  stream.Writable.call(self);

  self._write = function(chunk, encoding, callback) {
    debug('publish events to datadog');
    var json = JSON.parse(chunk.toString());
    client.increment('docker.listener.' + json.status);
    callback();
  };
}

util.inherits(DatadogPublisherStream, stream.Writable);

module.exports.stream = function() {
  return new DatadogPublisherStream();
};