/**
 * Handle server start/stop requirements
 * @module main
 */
'use strict';
require('loadenv')('docker-listener:env');

var debug = require('debug')('docker-listener:server');
var noop = require('101/noop');

var app = require('./lib/app.js');
var listener = require('./lib/listener');
var publisher = require('./lib/publisher')();

module.exports = {
  start: start,
  stop: stop
};

var server;

/**
 * Listen for events from Docker and publish to Redis
 * @param {String} port
 * @param {Function} cb
 */
function start (port, cb) {
  cb = cb || noop;
  server = app.listen(port, function (err) {
    if (err) { return cb(err); }
    debug('server listen on', port);
    listener.start(publisher, cb);
  });
}

/**
 * Drain remaining requests and shut down
 * @param {Function} cb
 */
function stop (cb) {
  cb = cb || noop;
  if (!server) {
    throw new Error('trying to stop when server was not started');
  }
  server.close(function (err) {
    if (err) { return cb(err); }
    listener.stop(cb);
  });
}
