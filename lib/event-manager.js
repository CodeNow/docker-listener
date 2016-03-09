/**
 * Listen to Docker events and publish/proxy to Redis
 * @module lib/listener
 */
'use strict'
require('loadenv')({ debugName: 'docker-listener' })

var isEmpty = require('101/is-empty')
var Promise = require('bluebird')

var datadog = require('./datadog')
var docker = require('./docker')
var ErrorCat = require('error-cat')
var log = require('./logger')()
var rabbitmq = require('./rabbitmq')
var Listener = require('./Listener')

var errorCat = new ErrorCat()

module.exports = class EventManager {
  start () {
    var self = this
    return startSwarmEventListener()
      .then(function () {
        return docker.getNodes()
      })
      .then(function (nodes) {
        return Promise.map(Object.keys(nodes), function (key) {
          return nodes[key]
        })
      })
      .each(function (node) {
        if (self.dockListeners[node.Host]) {
          return
        }
        return createDockListener()
      })
    })
  }

  startSwarmEventListener () {
    this.swarmListener = new Listener(
      process.env.SWARM_HOST,
      null,
      'swarm',
      this.start.bind(this)
    )
    return this.swarmListener.start()
  }

  createDockListener (node) {
    this.dockListeners[host.Host] = new Listener(
      node.Host,
      node.Labels.org
      'dock',
      this.createDockListener.bind(this, node)
    )
    return listener.start()
  }
}
