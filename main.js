'use strict';
require('./lib/loadenv')();
var app = require('./lib/app.js');
var debug = require('debug')('docker-listener:server');
var listener = require('./lib/listener');
var publisher = require('./lib/publisher')();
var monitor = require('monitor-dog');
var noop = require('101/noop');


var server;
function start (port, cb) {
  cb = cb || noop;
  server = app.listen(port, function (err) {
    if (err) { return cb(err); }
    debug('server listen on', port);
    listener.start(publisher, cb);
    monitor.startSocketsMonitor();
  });
}
function stop (cb) {
  cb = cb || noop;
  if (!server) {
    throw new Error('trying to stop when server was not started');
  }
  server.close(function (err) {
    if (err) { return cb(err); }
    listener.stop(cb);
    monitor.stopSocketsMonitor();
  });
}

module.exports = {
  start: start,
  stop: stop
};
