'use strict'
require('loadenv')()

const RabbitMQ = require('ponos/lib/rabbitmq')
const publisher = new RabbitMQ({ name: process.env.APP_NAME })

module.exports = publisher

publisher.createPublishJob = function (job) {
  publisher.publishTask('docker.event.publish', job)
}

/**
 * send swarm or docker events stream connected job
 * @param  {String} type swarm / docker
 * @param  {String} host format: 10.0.0.1:4242
 * @param  {String} org  github orgId
 */
publisher.createConnectedJob = function (type, host, org) {
  // we need to send tags for backwards compatibility
  // also host needs to have http://
  publisher.publishEvent(type + '.events-stream.connected', {
    host: 'http://' + host,
    org: org,
    tags: org
  })
}

/**
 * send docker events stream disconnected job
 * @param  {String} host format: 10.0.0.1:4242
 * @param  {String} org  github orgId
 */
publisher.createDisconnectedJob = function (host, org) {
  // we need to send tags for backwards compatibility
  // also host needs to have http://
  publisher.publishEvent('docker.events-stream.disconnected', {
    host: 'http://' + host,
    org: org
  })
}

/**
 * send swarm or docker events stream connected job
 * @param  {String} type swarm / docker
 * @param  {String} host format: 10.0.0.1:4242
 * @param  {String} org  github orgId
 */
publisher.createStreamConnectJob = function (type, host, org) {
  publisher.publishTask(type + '.events-stream.connect', {
    host: host,
    org: org
  })
}
