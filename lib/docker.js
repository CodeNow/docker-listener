/**
 * @module lib/docker
 */
'use strict';

var Docker = require('dockerode');

console.log('new docker', {
  protocol: process.env.DOCKER_REMOTE_API_PROTOCOL,
  host: process.env.DOCKER_REMOTE_API_HOST,
  port: process.env.DOCKER_REMOTE_API_PORT,
  timeout: 1000
});

module.exports = new Docker({
  protocol: process.env.DOCKER_REMOTE_API_PROTOCOL,
  host: process.env.DOCKER_REMOTE_API_HOST,
  port: process.env.DOCKER_REMOTE_API_PORT,
  timeout: 1000
});
