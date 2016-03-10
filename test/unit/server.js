'use strict'
require('loadenv')()

var Code = require('code')
var Lab = require('lab')
var monitor = require('monitor-dog')
var sinon = require('sinon')

var rabbitmq = require('../../lib/rabbitmq.js')
var Server = require('../../server.js')

var lab = exports.lab = Lab.script()

var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var describe = lab.describe
var expect = Code.expect
var it = lab.it

describe('server.js unit test', function () {
  describe('start', function () {
    beforeEach(function (done) {
      sinon.stub(monitor, 'startSocketsMonitor')
      sinon.stub(rabbitmq, 'connect')
      sinon.stub(rabbitmq, 'createStreamConnectJob')
      done()
    })

    afterEach(function (done) {
      monitor.startSocketsMonitor.restore()
      rabbitmq.connect.restore()
      rabbitmq.createStreamConnectJob.restore()
      done()
    })

    it('should startup all services', function (done) {
      monitor.startSocketsMonitor.returns()
      rabbitmq.connect.yieldsAsync()
      rabbitmq.createStreamConnectJob.returns()

      Server.start(3000, function (err) {
        if (err) { return done(err) }

        sinon.assert.calledOnce(monitor.startSocketsMonitor)
        sinon.assert.calledOnce(rabbitmq.connect)
        sinon.assert.calledOnce(rabbitmq.createStreamConnectJob)
        done()
      })
    })

    it('should fail if rabbit failed to connect', function (done) {
      var testErr = new Error('rabbitmq error')
      rabbitmq.connect.yieldsAsync(testErr)

      Server.start(3000, function (err) {
        expect(err).to.equal(testErr)

        sinon.assert.calledOnce(monitor.startSocketsMonitor)
        sinon.assert.calledOnce(rabbitmq.connect)
        sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
        done()
      })
    })
  }) // end start
}) // end server.js unit test
