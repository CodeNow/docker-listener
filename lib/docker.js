/**
 * @module lib/docker
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })
var fs = require('fs')
var assign = require('101/assign')
var join = require('path').join

var Docker = require('dockerode')

var dockerOpts = {
  host: process.env.SWARM_HOSTNAME,
  port: process.env.SWARM_PORT,
  timeout: process.env.SWARM_TIMEOUT_MS
}

try {
  var certPath = process.env.DOCKER_CERT_PATH || '/etc/ssl/docker'
  var certs = {
    ca: fs.readFileSync(join(certPath, 'ca.pem')),
    cert: fs.readFileSync(join(certPath, 'cert.pem')),
    key: fs.readFileSync(join(certPath, 'key.pem'))
  }
  assign(dockerOpts, certs)
} catch (e) {
  console.error('cannot load certificates for docker!!', e.message)
}

module.exports = new Docker(dockerOpts)
