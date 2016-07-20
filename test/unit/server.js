'use strict'

const Code = require('code')
const Lab = require('lab')
const monitor = require('monitor-dog')
const sinon = require('sinon')
const Promise = require('bluebird')
require('sinon-as-promised')(Promise)
const rabbitmq = require('../../lib/rabbitmq.js')
const workerServer = require('../../lib/worker-server.js')
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
      sinon.stub(monitor, 'startSocketsMonitor').returns()
      sinon.stub(rabbitmq, 'connect').resolves()
      sinon.stub(rabbitmq, 'createStreamConnectJob').returns()
      sinon.stub(workerServer, 'start').resolves()
      done()
    })

    afterEach((done) => {
      monitor.startSocketsMonitor.restore()
      rabbitmq.connect.restore()
      rabbitmq.createStreamConnectJob.restore()
      workerServer.start.restore()
      done()
    })

    it('should startup all services', (done) => {
      Server.start(3000).asCallback((err) => {
        if (err) { return done(err) }

        sinon.assert.calledOnce(monitor.startSocketsMonitor)
        sinon.assert.calledOnce(rabbitmq.connect)
        sinon.assert.calledOnce(workerServer.start)
        sinon.assert.calledOnce(rabbitmq.createStreamConnectJob)
        done()
      })
    })

    it('should fail if rabbit failed to connect', (done) => {
      const testErr = new Error('rabbitmq error')
      rabbitmq.connect.rejects(testErr)

      Server.start(3000).asCallback((err) => {
        expect(err).to.equal(testErr)

        sinon.assert.calledOnce(monitor.startSocketsMonitor)
        sinon.assert.calledOnce(rabbitmq.connect)
        sinon.assert.notCalled(workerServer.start)
        sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
        done()
      })
    })

    it('should fail if workerServer failed to start', (done) => {
      const testErr = new Error('rabbitmq error')
      workerServer.start.rejects(testErr)

      Server.start(3000).asCallback((err) => {
        expect(err).to.equal(testErr)

        sinon.assert.calledOnce(monitor.startSocketsMonitor)
        sinon.assert.calledOnce(rabbitmq.connect)
        sinon.assert.calledOnce(workerServer.start)
        sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
        done()
      })
    })
  }) // end start
}) // end server.js unit test
