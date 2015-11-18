/**
 * Handle server start/stop requirements
 * @module main
 */
'use strict';
require('loadenv')();

var execSync = require('exec-sync');
var monitor = require('monitor-dog');
var noop = require('101/noop');

var app = require('./lib/app.js');
var Publisher = require('./lib/publisher');
var RabbitMQ = require('./lib/hermes-client.js');
var log = require('./lib/logger').getChild(__filename);
var Listener = require('./lib/listener');

module.exports = {
  start: start,
  stop: stop
};

process.env.VERSION_GIT_COMMIT = execSync('git rev-parse HEAD');
process.env.VERSION_GIT_BRANCH = execSync('git rev-parse --abbrev-ref HEAD');
var server;
var listener;

/**
 * Listen for events from Docker and publish to Redis
 * @param {String} port
 * @param {Function} cb
 */
function start (port, cb) {
  cb = cb || noop;
  server = app.listen(port, function (err) {
    if (err) { return cb(err); }
    log.info({
      port: port
    }, 'server listen');
    monitor.startSocketsMonitor();
    RabbitMQ.connect(function (err) {
      if (err) { return cb(err); }
      var publisher = new Publisher();
      listener = new Listener(publisher);
      listener.once('started', function () {
        log.info('listener started');
        cb();
      });
      listener.start();
    });
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
    if (listener) {
      listener.stop();
    }
    RabbitMQ.close(cb);
  });
}
