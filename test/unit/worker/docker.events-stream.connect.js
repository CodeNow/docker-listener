'use strict'

const Code = require('code')
const Lab = require('lab')
const sinon = require('sinon')
const TaskFatalError = require('ponos').TaskFatalError

const Docker = require('../../../lib/docker')
const DockerEventsSteamConnect = require('../../../lib/workers/docker.events-stream.connect.js')
const eventManager = require('../../../lib/event-manager')
const rabbitmq = require('../../../lib/rabbitmq')
const sinceMap = require('../../../lib/since-map')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const expect = Code.expect
const it = lab.test

describe('docker.events-stream.connect unit test', () => {
  const testHost = '10.0.0.1:3232'
  const testOrg = '12342134'
  const testJob = {
    host: testHost,
    org: testOrg
  }

  beforeEach((done) => {
    sinon.stub(Docker.prototype, 'swarmHostExists')
    sinon.stub(eventManager, 'removeDockListener')
    sinon.stub(eventManager, 'startDockListener')
    sinon.stub(sinceMap, 'delete')
    sinon.stub(rabbitmq, 'createDisconnectedJob')
    done()
  })

  afterEach((done) => {
    Docker.prototype.swarmHostExists.restore()
    eventManager.removeDockListener.restore()
    eventManager.startDockListener.restore()
    sinceMap.delete.restore()
    rabbitmq.createDisconnectedJob.restore()
    done()
  })

  it('should startDockListener', (done) => {
    Docker.prototype.swarmHostExists.returns(Promise.resolve(true))
    DockerEventsSteamConnect(testJob).asCallback((err) => {
      if (err) { return done(err) }
      sinon.assert.calledOnce(eventManager.startDockListener)
      sinon.assert.calledWith(eventManager.startDockListener, testHost, testOrg)
      done()
    })
  })

  it('should removeDockListener and delete map', (done) => {
    Docker.prototype.swarmHostExists.returns(Promise.resolve(false))
    DockerEventsSteamConnect(testJob).asCallback((err) => {
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

  it('should TaskFatalError if invalid job', (done) => {
    DockerEventsSteamConnect({}).asCallback((err) => {
      expect(err).to.be.an.instanceOf(TaskFatalError)
      done()
    })
  })
}) // end docker.events-stream.connect unit test
