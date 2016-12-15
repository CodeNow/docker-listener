'use strict'
require('loadenv')()

const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')
require('sinon-as-promised')(Promise)

const dockerEventsStreamPing = require('../../../lib/workers/docker.events-stream.ping.js').task
const eventManager = require('../../../lib/event-manager')
const rabbitmq = require('../../../lib/rabbitmq')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const it = lab.test

describe('docker.events-stream.ping worker unit test', () => {
  describe('worker', () => {
    let testListener
    let testListeners = {}
    let testJob

    beforeEach((done) => {
      sinon.stub(eventManager, 'getListeners')
      sinon.stub(rabbitmq, 'createStreamConnectJob')
      testListener = {
        host: 'host',
        org: 'org',
        state: 'connected',
        testStream: sinon.stub()
      }

      testJob = {
        host: 'host',
        org: 'org'
      }

      testListeners[testListener.host] = testListener
      done()
    })

    afterEach((done) => {
      eventManager.getListeners.restore()
      rabbitmq.createStreamConnectJob.restore()
      done()
    })

    it('should test stream', (done) => {
      testListener.testStream.resolves()

      eventManager.getListeners.returns(testListeners)

      dockerEventsStreamPing(testJob)
      .then(() => {
        sinon.assert.calledOnce(eventManager.getListeners)
        sinon.assert.calledOnce(testListener.testStream)
      })
      .asCallback(done)
    })

    it('should reconnect on error', (done) => {
      testListener.testStream.rejects()
      eventManager.getListeners.returns(testListeners)

      dockerEventsStreamPing(testJob)
      .then(() => {
        sinon.assert.calledOnce(rabbitmq.createStreamConnectJob)
        sinon.assert.calledWith(rabbitmq.createStreamConnectJob, 'docker', testJob.host, testJob.org)
      })
      .asCallback(done)
    })

    it('should do nothing if not connected', (done) => {
      testListener.state = 'bad'
      testListener.testStream.rejects()
      eventManager.getListeners.returns(testListeners)

      dockerEventsStreamPing(testJob)
      .then(() => {
        sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
        sinon.assert.notCalled(testListener.testStream)
      })
      .asCallback(done)
    })
  }) // end worker
})
