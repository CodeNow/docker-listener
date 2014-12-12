'use strict';
var spawn = require('child_process').fork;
var debug = require('debug')('test-docker-mock');

module.exports.start = function (cb) {
  this.server = spawn('test/fixtures/docker-server.js');

  debug('Spawned child pid: ', this.server.pid);
  this.server.on('message', function (msg) {
    if (msg === 'started') {
      cb();
    }
  });
  return this;
};
module.exports.stop = function (cb) {
  if (this.server) {
    this.server.on('exit', function (code) {
      debug('docker server process exited with code ', code);
      cb();
    });
    this.server.kill('SIGHUP');
    this.server = null;
  }
  return this;
};
