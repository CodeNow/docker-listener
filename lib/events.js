'use strict';
require('loadenv.js')();
var ip = require('ip');
var uuid = require('node-uuid');

// add `ip`, `uuid`, `host` and `time` (if missing) fields
exports.enhanceEvent = function (ev) {
  ev.ip = ip.address();
  ev.uuid = uuid.v1();
  if (ev.time) {
    ev.time = new Date().getTime();
  }
  ev.host = 'http://' + ev.ip + ':' + process.env.DOCKER_REMOTE_API_PORT;
  return ev;
};