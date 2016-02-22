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
  protocol: process.env.SWARM_REMOTE_API_PROTOCOL,
  host: process.env.SWARM_REMOTE_API_HOST,
  port: process.env.SWARM_REMOTE_API_PORT,
  timeout: parseInt(process.env.DL_DOCKER_TIMEOUT, 10)
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
