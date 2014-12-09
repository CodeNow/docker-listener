'use strict';
require('loadenv.js')();
var app = require('./lib/app.js');
var debug = require('debug')('docker-listener:server');
var listener = require('./lib/listener');
var publisher = require('./lib/publisher')();

if (!module.parent) { // start the docker listener
  start();
}
else {
  module.exports = {
    start: start,
    stop: stop
  };
}
var server;
function start (cb) {
  cb = cb || console.log.bind(console);
  server = app.listen(process.env.PORT, function (err) {
    if (err) { return cb(err); }
    listener.start(publisher, process.stdout, cb);
    debug('server listen on', process.env.PORT);
  });
}
function stop (cb) {
  server.close(function (err) {
    if (err) { return cb(err); }
    listener.stop(cb);
  });
}