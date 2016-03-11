/**
 * @module lib/docker
 */
'use strict'
require('loadenv')()

const Promise = require('bluebird')
var Dockerode = require('dockerode')
const ErrorCat = require('error-cat')
const fs = require('fs')
const isEmpty = require('101/is-empty')
const join = require('path').join
const put = require('101/put')
const Swarmerode = require('swarmerode')

const datadog = require('./datadog')
const log = require('./logger')()

Dockerode = Swarmerode(Dockerode)
Promise.promisifyAll(Dockerode)
Promise.promisifyAll(Dockerode.prototype)

const errorCat = new ErrorCat()
const certPath = process.env.DOCKER_CERT_PATH
const certs = {
  ca: fs.readFileSync(join(certPath, 'ca.pem')),
  cert: fs.readFileSync(join(certPath, 'cert.pem')),
  key: fs.readFileSync(join(certPath, 'key.pem'))
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

  /**
   * get array of nodes
   * @return {Promise}
   * @resolves {Object[]} array of nodes
   */
  getNodes () {
    log.info('Docker.prototype.getNodes')
    return this.docker.swarmInfoAsync()
      .then((info) => {
        log.trace({ info: info }, 'getNodes - got nodes')
        const nodes = info.parsedSystemStatus.ParsedNodes
        return Promise.map(Object.keys(nodes), (key) => {
          return nodes[key]
        })
      })
  }

  /**
   * checks if host is connected to swarm
   * @param  {String} host format: 10.0.0.1:4242
   * @return {Promise}
   * @resolves {Boolean} true if exist
   */
  swarmHostExists (host) {
    log.info({ host: host }, 'Docker.prototype.swarmHostExists')
    return this.docker.swarmHostExistsAsync(host)
  }

  /**
   * returns docker event stream
   * @return {Promise}
   * @resolves {Object} docker event stream
   */
  getEvents (opts) {
    log.info({ opts: opts }, 'Docker.prototype.event')
    return this.docker.getEventsAsync(opts)
  }

  /**
   * gets inspect data from container
   * @return {Promise}
   * @resolves {Object} inspect data
   */
  inspectContainer (id) {
    log.info({ id: id }, 'Docker.prototype.inspectContainer')
    return Promise.fromCallback((cb) => {
      this.docker.getContainer(id).inspect(cb)
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
    return this.docker.listContainersAsync({
      filters: {
        state: ['running']
      }
    })
    .then((containers) => {
      listTimer.stop()
      if (isEmpty(containers)) {
        log.error('testEvent - no running containers found')
        throw new Error('no running containers found')
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
