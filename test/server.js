'use strict'

var Lab = require('lab')
var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it
var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var Code = require('code')
var expect = Code.expect

var createCount = require('callback-count')

var sinon = require('sinon')
var monitor = require('monitor-dog')
var app = require('../lib/app.js')
var RabbitMQ = require('../lib/rabbitmq.js')
var Server = require('../server.js')
var Listener = require('../lib/listener')

describe('server.js unit test', function () {
  describe('start', function () {
    beforeEach(function (done) {
      sinon.stub(monitor, 'startSocketsMonitor').returns()
      done()
    })

    afterEach(function (done) {
      app.listen.restore()
      RabbitMQ.connect.restore()
      monitor.startSocketsMonitor.restore()
      done()
    })

    it('should startup all services', function (done) {
      var server = new Server()
      sinon.stub(app, 'listen').yieldsAsync()
      sinon.stub(RabbitMQ, 'connect').yieldsAsync()
      sinon.stub(Listener.prototype, 'start', function () {
        this.emit('started')
        return
      })
      server.start(3000, function (err) {
        expect(err).to.not.exist()
        expect(app.listen.calledOnce).to.be.true()
        expect(monitor.startSocketsMonitor.calledOnce).to.be.true()
        expect(RabbitMQ.connect.calledOnce).to.be.true()
        expect(Listener.prototype.start.calledOnce).to.be.true()
        Listener.prototype.start.restore()
        done()
      })
    })
    it('should fail if web server failed to start', function (done) {
      var server = new Server()
      sinon.stub(app, 'listen').yieldsAsync(new Error('Express error'))
      sinon.stub(RabbitMQ, 'connect').yieldsAsync()
      sinon.stub(Listener.prototype, 'start', function () {
        this.emit('started')
        return
      })
      server.start(3000, function (err) {
        expect(err).to.exist()
        expect(app.listen.calledOnce).to.be.true()
        expect(monitor.startSocketsMonitor.calledOnce).to.be.false()
        expect(RabbitMQ.connect.calledOnce).to.be.false()
        expect(Listener.prototype.start.calledOnce).to.be.false()
        Listener.prototype.start.restore()
        done()
      })
    })
    it('should fail if rabbit failed to connect', function (done) {
      var server = new Server()
      sinon.stub(app, 'listen').yieldsAsync()
      sinon.stub(RabbitMQ, 'connect').yieldsAsync(new Error('Rabbit error'))
      sinon.stub(Listener.prototype, 'start', function () {
        this.emit('started')
        return
      })
      server.start(3000, function (err) {
        expect(err).to.exist()
        expect(app.listen.calledOnce).to.be.true()
        expect(monitor.startSocketsMonitor.calledOnce).to.be.true()
        expect(RabbitMQ.connect.calledOnce).to.be.true()
        expect(Listener.prototype.start.calledOnce).to.be.false()
        Listener.prototype.start.restore()
        done()
      })
    })
  }) // end start

  describe('stop', function () {
    beforeEach(function (done) {
      sinon.stub(monitor, 'stopSocketsMonitor').returns()
      done()
    })

    afterEach(function (done) {
      monitor.stopSocketsMonitor.restore()
      done()
    })

    it('should error if web server was closed with an error', function (done) {
      var server = new Server()
      server.server = {
        close: function (cb) {
          cb(new Error('Express error'))
        }
      }
      server.stop(function (err) {
        expect(err).to.exist()
        expect(err.message).to.equal('Express error')
        done()
      })
    })
    it('should error if rabbit was closed with an error', function (done) {
      var server = new Server()
      server.server = {
        close: function (cb) {
          cb(null)
        }
      }
      sinon.stub(RabbitMQ, 'close').yieldsAsync(new Error('Rabbit error'))
      server.stop(function (err) {
        expect(err).to.exist()
        expect(err.message).to.equal('Rabbit error')
        expect(monitor.stopSocketsMonitor.calledOnce).to.be.true()
        expect(RabbitMQ.close.calledOnce).to.be.true()
        RabbitMQ.close.restore()
        done()
      })
    })

    it('should stop everything successfully', function (done) {
      var server = new Server()
      server.server = {
        close: function (cb) {
          cb(null)
        }
      }
      sinon.stub(RabbitMQ, 'close').yieldsAsync()
      server.stop(function (err) {
        expect(err).to.not.exist()
        expect(monitor.stopSocketsMonitor.calledOnce).to.be.true()
        expect(RabbitMQ.close.calledOnce).to.be.true()
        RabbitMQ.close.restore()
        done()
      })
    })

    it('should stop everything+listener successfully', function (done) {
      var server = new Server()
      var count = createCount(3, done)
      server.server = {
        close: function (cb) {
          count.next()
          cb(null)
        }
      }
      server.listener = {
        stop: function () {
          count.next()
          return
        }
      }
      sinon.stub(RabbitMQ, 'close').yieldsAsync()
      server.stop(function (err) {
        expect(err).to.not.exist()
        expect(monitor.stopSocketsMonitor.calledOnce).to.be.true()
        expect(RabbitMQ.close.calledOnce).to.be.true()
        RabbitMQ.close.restore()
        count.next()
      })
    })

    it('should cb err if server was not defined', function (done) {
      var server = new Server()
      server.stop(function (err) {
        expect(err).to.exist()
        expect(err.message).to.equal('Trying to stop when server was not started')
        done()
      })
    })
  }) // end stop
}); // end server.js unit test
