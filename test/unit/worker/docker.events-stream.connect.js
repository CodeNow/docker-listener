'use strict'

const Lab = require('lab')
const sinon = require('sinon')
const Promise = require('bluebird')
require('sinon-as-promised')(Promise)
const Swarm = require('@runnable/loki').Swarm
const DockerEventsSteamConnect = require('../../../lib/workers/docker.events-stream.connect.js')
const eventManager = require('../../../lib/event-manager')
const rabbitmq = require('../../../lib/rabbitmq')
const sinceMap = require('../../../lib/since-map')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const it = lab.test

describe('docker.events-stream.connect unit test', () => {
  const testHost = '10.0.0.1:3232'
  const testOrg = '12342134'
  const testJob = {
    host: testHost,
    org: testOrg
  }

  beforeEach((done) => {
    sinon.stub(Swarm.prototype, 'swarmHostExistsAsync')
    sinon.stub(eventManager, 'removeDockListener')
    sinon.stub(eventManager, 'startDockListener')
    sinon.stub(sinceMap, 'delete')
    sinon.stub(rabbitmq, 'createDisconnectedJob')
    done()
  })

  afterEach((done) => {
    Swarm.prototype.swarmHostExistsAsync.restore()
    eventManager.removeDockListener.restore()
    eventManager.startDockListener.restore()
    sinceMap.delete.restore()
    rabbitmq.createDisconnectedJob.restore()
    done()
  })

  it('should startDockListener', (done) => {
    Swarm.prototype.swarmHostExistsAsync.resolves(true)
    DockerEventsSteamConnect.task(testJob).asCallback((err) => {
      if (err) { return done(err) }
      sinon.assert.calledOnce(eventManager.startDockListener)
      sinon.assert.calledWith(eventManager.startDockListener, testHost, testOrg)
      done()
    })
  })

  it('should removeDockListener and delete map', (done) => {
    Swarm.prototype.swarmHostExistsAsync.resolves(false)
    DockerEventsSteamConnect.task(testJob).asCallback((err) => {
      if (err) { return done(err) }
      sinon.assert.calledOnce(sinceMap.delete)
      sinon.assert.calledWith(sinceMap.delete, testHost)
      sinon.assert.calledOnce(eventManager.removeDockListener)
      sinon.assert.calledWith(eventManager.removeDockListener, testHost)
      sinon.assert.calledOnce(rabbitmq.createDisconnectedJob)
      sinon.assert.calledWith(rabbitmq.createDisconnectedJob, testHost, testOrg)
      done()
    })
  })

  it('should createDisconnectedJob on final retry', (done) => {
    DockerEventsSteamConnect.finalRetryFn(testJob).asCallback((err) => {
      if (err) { return done(err) }
      sinon.assert.calledOnce(rabbitmq.createDisconnectedJob)
      sinon.assert.calledWith(rabbitmq.createDisconnectedJob, testHost, testOrg)
      done()
    })
  })
}) // end docker.events-stream.connect unit test
