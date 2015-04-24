/**
 * @module lib/status
 */
'use strict';

var status = {
  docker_connected: false,
  count_events: 0,
  env: process.env.NODE_ENV || 'development'
};

module.exports = status;
