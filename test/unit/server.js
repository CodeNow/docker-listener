'use strict'

const Code = require('code')
const Lab = require('lab')
const monitor = require('monitor-dog')
const sinon = require('sinon')

const rabbitmq = require('../../lib/rabbitmq.js')
const Server = require('../../server.js')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.describe
const expect = Code.expect
const it = lab.it

describe('server.js unit test', () => {
  describe('start', () => {
    beforeEach((done) => {
      sinon.stub(monitor, 'startSocketsMonitor')
      sinon.stub(rabbitmq, 'connect')
      sinon.stub(rabbitmq, 'createStreamConnectJob')
      done()
    })

    afterEach((done) => {
      monitor.startSocketsMonitor.restore()
      rabbitmq.connect.restore()
      rabbitmq.createStreamConnectJob.restore()
      done()
    })

    it('should startup all services', (done) => {
      monitor.startSocketsMonitor.returns()
      rabbitmq.connect.yieldsAsync()
      rabbitmq.createStreamConnectJob.returns()

      Server.start(3000, (err) => {
        if (err) { return done(err) }

        sinon.assert.calledOnce(monitor.startSocketsMonitor)
        sinon.assert.calledOnce(rabbitmq.connect)
        sinon.assert.calledOnce(rabbitmq.createStreamConnectJob)
        done()
      })
    })

    it('should fail if rabbit failed to connect', (done) => {
      const testErr = new Error('rabbitmq error')
      rabbitmq.connect.yieldsAsync(testErr)

      Server.start(3000, (err) => {
        expect(err).to.equal(testErr)

        sinon.assert.calledOnce(monitor.startSocketsMonitor)
        sinon.assert.calledOnce(rabbitmq.connect)
        sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
        done()
      })
    })
  }) // end start
}) // end server.js unit test
