'use strict'
require('loadenv')()

const log = require('./logger')()
const ponos = require('ponos')

/**
 * The docker-listener ponos server.
 * @type {docker-listener~Server}
 * @module docker-listener/worker-server
 */
module.exports = new ponos.Server({
  name: process.env.APP_NAME,
  rabbitmq: {
    channel: {
      prefetch: process.env.WORKER_PREFETCH
    }
  },
  tasks: {
    'container.state.poll': require('./workers/container.state.poll.js'),
    'docker.event.publish': require('./workers/docker.event.publish.js'),
    'docker.events-stream.connect': require('./workers/docker.events-stream.connect.js'),
    'swarm.events-stream.connect': require('./workers/swarm.events-stream.connect.js')
  },
  events: {
    'swarm.events-stream.connected': require('./workers/swarm.events-stream.connected.js'),
    'instance.container.health-check.failed': require('./workers/instance.container.health-check.failed.js')
  },
  log: log
})
