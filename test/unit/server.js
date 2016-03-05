'use strict'
require('loadenv')({ debugName: 'docker-listener' })

var Code = require('code')
var Lab = require('lab')
var monitor = require('monitor-dog')
var sinon = require('sinon')

var app = require('../../lib/app.js')
var Listener = require('../../lib/listener')
var RabbitMQ = require('../../lib/rabbitmq.js')
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
      sinon.stub(monitor, 'startSocketsMonitor').returns()
      sinon.stub(app, 'listen')
      sinon.stub(RabbitMQ, 'connect')
      sinon.stub(Listener.prototype, 'start')
      done()
    })

    afterEach(function (done) {
      app.listen.restore()
      RabbitMQ.connect.restore()
      monitor.startSocketsMonitor.restore()
      Listener.prototype.start.restore()
      done()
    })

    it('should startup all services', function (done) {
      var server = new Server()
      app.listen.yieldsAsync()
      Listener.prototype.start.yieldsAsync()
      monitor.startSocketsMonitor.returns()
      RabbitMQ.connect.yieldsAsync()

      server.start(3000, function (err) {
        if (err) { return done(err) }

        sinon.assert.calledOnce(app.listen)
        sinon.assert.calledOnce(monitor.startSocketsMonitor)
        sinon.assert.calledOnce(RabbitMQ.connect)
        sinon.assert.calledOnce(Listener.prototype.start)
        done()
      })
    })

    it('should fail if web server failed to start', function (done) {
      var server = new Server()
      var testErr = new Error('Express error')
      app.listen.yieldsAsync(testErr)

      server.start(3000, function (err) {
        expect(err).to.equal(testErr)
        sinon.assert.calledOnce(app.listen)
        sinon.assert.notCalled(monitor.startSocketsMonitor)
        sinon.assert.notCalled(RabbitMQ.connect)
        sinon.assert.notCalled(Listener.prototype.start)
        done()
      })
    })

    it('should fail if rabbit failed to connect', function (done) {
      var server = new Server()
      var testErr = new Error('RabbitMQ error')
      app.listen.yieldsAsync()
      RabbitMQ.connect.yieldsAsync(testErr)

      server.start(3000, function (err) {
        expect(err).to.equal(testErr)

        sinon.assert.calledOnce(app.listen)
        sinon.assert.calledOnce(monitor.startSocketsMonitor)
        sinon.assert.calledOnce(RabbitMQ.connect)
        sinon.assert.notCalled(Listener.prototype.start)
        done()
      })
    })
  }) // end start
}) // end server.js unit test
