'use strict';
require('./lib/loadenv')();
var app = require('./lib/app.js');
var debug = require('debug')('docker-listener:server');
var listener = require('./lib/listener');
var publisher = require('./lib/publisher')();
var noop = require('101/noop');

var server;
function start (port, cb) {
  cb = cb || noop;
  server = app.listen(port, function (err) {
    if (err) { return cb(err); }
    debug('server listen on', port);
    listener.start(publisher, cb);
  });
}
function stop (cb) {
  cb = cb || noop;
  server.close(function (err) {
    if (err) { return cb(err); }
    listener.stop(cb);
  });
}

module.exports = {
  start: start,
  stop: stop
};