/**
 * @module lib/datadog
 */
'use strict';


require('loadenv')('docker-listener:env');
var debug = require('auto-debug')();
var ip = require('ip');
var stream = require('stream');
var util = require('util');

var debug = require('auto-debug')();
var monitor = require('monitor-dog');


function DatadogPublisherStream() {
  var self = this;

  stream.Writable.call(self);

  self._write = function(chunk, encoding, callback) {
    debug('publish events to datadog');
    if (chunk) {
      try {
        var json = JSON.parse(chunk.toString());
        inc(json.status);
        callback();
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

util.inherits(DatadogPublisherStream, stream.Writable);

exports.stream = function() {
  return new DatadogPublisherStream();
};


function createEvent () {
  var json = {
    ip: ip.address(),
    env: process.env.NODE_ENV
  };
  return json;
}

var inc = exports.inc = function (eventName) {
  monitor.increment(eventName, 1, createEvent());
};
