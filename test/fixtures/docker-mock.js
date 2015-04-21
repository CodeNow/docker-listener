'use strict';
var dockerMock = require('docker-mock');
var debug = require('debug')('test-docker-mock');
var enableDestroy = require('server-destroy');
var server;

module.exports.start = function (cb) {
  process.env.DISABLE_RANDOM_EVENTS=true;
  debug('server start');
  server = dockerMock.listen(process.env.DOCKER_REMOTE_API_PORT, function(err) {
    enableDestroy(server);
    cb(err);
  });

};
module.exports.stop = function (cb) {
  debug('server close');
  server.close(cb);
};
module.exports.forceStop = function (cb) {
  debug('server forceStop');
  server.destroy(cb);
};
module.exports.emitEvent = function (type) {
  debug('emitEvent', type);
  dockerMock.events.stream.emit('data', JSON.stringify({
    status: type,
    from: 'registry.runnable.com/somenum:sometag',
    id: '178236478312'
  }));
};
