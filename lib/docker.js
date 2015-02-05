'use strict';
require('../lib/loadenv')();
var Docker = require('dockerode');

module.exports = new Docker({
  protocol: process.env.DOCKER_REMOTE_API_PROTOCOL,
  host: process.env.DOCKER_REMOTE_API_HOST,
  port: process.env.DOCKER_REMOTE_API_PORT,
  timeout: 1000
});
