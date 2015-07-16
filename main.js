/**
 * Handle server start/stop requirements
 * @module main
 */
'use strict';
require('loadenv')();

var debug = require('debug')('docker-listener:server');
var execSync = require('exec-sync');
var monitor = require('monitor-dog');
var noop = require('101/noop');

var app = require('./lib/app.js');
var listener = require('./lib/listener');
var publisher = require('./lib/publisher')();

module.exports = {
  start: start,
  stop: stop
};

var server;
process.env.VERSION_GIT_COMMIT = execSync('git rev-parse HEAD');
process.env.VERSION_GIT_BRANCH = execSync('git rev-parse --abbrev-ref HEAD');

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
    monitor.startSocketsMonitor();
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
    monitor.stopSocketsMonitor();
    listener.stop(cb);
  });
}
