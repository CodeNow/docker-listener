/**
 * @module lib/docker
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })

var Dockerode = require('dockerode')
var ErrorCat = require('error-cat')
var fs = require('fs')
var isEmpty = require('101/is-empty')
var join = require('path').join
var put = require('101/put')
var Swarmerode = require('swarmerode')

var datadog = require('./datadog')
var log = require('./logger')()

Dockerode = Swarmerode(Dockerode)
var errorCat = new ErrorCat()

var certs
try {
  var certPath = process.env.DOCKER_CERT_PATH
  certs = {
    ca: fs.readFileSync(join(certPath, 'ca.pem')),
    cert: fs.readFileSync(join(certPath, 'cert.pem')),
    key: fs.readFileSync(join(certPath, 'key.pem'))
  }
} catch (err) {
  log.error({ err: err }, 'cannot load certificates for docker!!')
}

module.exports = class Docker {
  /**
   * creates docker class
   * @param  {String} host docker host format: 10.0.0.0:4242
   * @return {Docker}      Docker instance
   */
  constructor (host) {
    this.docker = new Dockerode(put({
      host: host.split(':')[0],
      port: host.split(':')[1]
    }, certs))
  }

  getNodes () {
    log.info('Docker.prototype.getNodes')
    return Promise.fromCallback((cb) => {
      this.docker.swarmInfo(cb)
    })
    .then((info) => {
      var nodes = info.parsedSystemStatus.ParsedNodes
      return Promise.map(Object.keys(), (key) => {
        return nodes[key]
      })
    })
  }

  getEvents () {
    log.info('Docker.prototype.event')
    return Promise.fromCallback((cb) => {
      this.docker.getEvents(cb)
    })
  }

  /**
   * Do docker top on a random container.
   * This should emit the `top` event.
   * We ignore errors since we will restart if event failed
   * @param  {Function} cb [description]
   */
  testEvent () {
    log.info('Docker.prototype.testEvent')
    var listTimer = datadog.timer('listContainers.time')
    return Promise.fromCallback((cb) => {
      this.docker.listContainers({
        filters: {
          state: ['running']
        }
      }, cb)
    })
    .then((containers) => {
      listTimer.stop()
      if (isEmpty(containers)) {
        log.error('testEvent - no running containers found')
        throw errorCat.createAndReport(404, 'no running containers found')
      }

      log.trace({ container: containers[0].Id }, 'testEvent - got container')

      var topTimer = datadog.timer('top.time')
      return Promise.fromCallback((cb) => {
        this.docker.getContainer(containers[0].Id).top(cb)
      })
      .then(() => {
        topTimer.stop()
        log.trace({ container: containers[0].Id }, 'testEvent - top successful')
      })
    })
    .catch((err) => {
      log.error({ err: err }, 'testEvent - failed')
      errorCat.createAndReport(500, err.message, err)
    })
  }
}
