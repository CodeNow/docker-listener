/**
 * @module lib/status
 */
'use strict'

var status = {
  docker_connected: false,
  count_events: 0,
  last_event_time: null,
  env: process.env.NODE_ENV
}

module.exports = status
