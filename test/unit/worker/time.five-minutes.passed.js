'use strict'
require('loadenv')()

const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')
require('sinon-as-promised')(Promise)

const timeFiveMinutesPassed = require('../../../lib/workers/time.five-minutes.passed.js').task
const eventManager = require('../../../lib/event-manager')
const rabbitmq = require('../../../lib/rabbitmq')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const it = lab.test

describe('time.five-minutes.passed worker unit test', () => {
  describe('worker', () => {
    beforeEach((done) => {
      sinon.stub(eventManager, 'getListeners')
      sinon.stub(rabbitmq, 'createPingJob')
      done()
    })

    afterEach((done) => {
      eventManager.getListeners.restore()
      rabbitmq.createPingJob.restore()
      done()
    })

    it('should call create ping for each listener', (done) => {
      const testListener1 = {
        host: 'host',
        org: 'org'
      }
      const testListener2 = {
        host: 'host2',
        org: 'org2'
      }
      const testListeners = { a: testListener1, b: testListener2 }

      eventManager.getListeners.returns(testListeners)
      timeFiveMinutesPassed()
      .then(() => {
        sinon.assert.calledOnce(eventManager.getListeners)

        sinon.assert.calledTwice(rabbitmq.createPingJob)
        sinon.assert.calledWith(rabbitmq.createPingJob, testListener1)
        sinon.assert.calledWith(rabbitmq.createPingJob, testListener2)
      })
      .asCallback(done)
    })
  }) // end worker
})
