/**
 * @module test/listener
 */
'use strict'

require('loadenv')()
var Code = require('code')
var ErrorCat = require('error-cat')
var Lab = require('lab')
var sinon = require('sinon')
var noop = require('101/noop')

var Docker = require('../../lib/docker')
var Listener = require('../../lib/listener')
var rabbitmq = require('../../lib/rabbitmq')
var sinceMap = require('../../lib/since-map')

var lab = exports.lab = Lab.script()

var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var describe = lab.experiment
var expect = Code.expect
var it = lab.test

describe('listener unit test', function () {
  describe('constructor', function () {
    it('should setup listener', function (done) {
      var listener
      expect(function () {
        listener = new Listener('10.0.0.1:4242', '123', noop)
      }).to.not.throw()
      expect(listener).to.be.an.instanceOf(Listener)
      expect(listener.docker).to.be.an.instanceOf(Docker)
      expect(listener.host).to.equal('10.0.0.1:4242')
      expect(listener.org).to.equal('123')
      expect(listener.closeCb).to.equal(noop)
      done()
    })

    it('should setup dock', function (done) {
      var listener
      expect(function () {
        listener = new Listener('10.0.0.1:4242', '123', noop)
      }).to.not.throw()
      expect(listener.type).to.equal('dock')
      expect(listener.events).to.deep.equal(['create', 'start', 'die', 'top'])
      done()
    })

    it('should setup swarm', function (done) {
      var listener
      expect(function () {
        listener = new Listener('10.0.0.1:4242', null, noop)
      }).to.not.throw()
      expect(listener.type).to.equal('swarm')
      expect(listener.events).to.deep.equal(['engine_connect', 'engine_disconnect', 'top'])
      done()
    })
  }) // end constructor

  describe('methods', function () {
    var listener
    var testHost = '10.0.0.1:4242'
    var testOrg = '1234'
    var testCb = sinon.stub()

    beforeEach(function (done) {
      listener = new Listener(testHost, testOrg, testCb)
      done()
    })

    describe('start', function () {
      beforeEach(function (done) {
        sinon.stub(listener.docker, 'getEvents')
        sinon.stub(listener.docker, 'testEvent')
        sinon.stub(listener, 'handleClose')
        sinon.stub(listener, 'handleError')
        sinon.stub(listener, 'publishEvent')
        sinon.stub(listener, 'clearTimeout')
        sinon.stub(listener, 'startTimeout')
        sinon.stub(sinceMap, 'get')
        done()
      })

      afterEach(function (done) {
        listener.handleClose.restore()
        listener.handleError.restore()
        listener.publishEvent.restore()
        listener.clearTimeout.restore()
        listener.startTimeout.restore()
        sinceMap.get.restore()
        done()
      })

      it('should close if getting events threw error', function (done) {
        sinceMap.get.returns()
        listener.docker.getEvents.returns(Promise.reject('error'))

        listener.start().asCallback((err) => {
          if (err) { return done(err) }
          sinon.assert.calledOnce(listener.handleClose)
          sinon.assert.calledWith(listener.handleClose, 'error')
          done()
        })
      })

      it('should pass correct opts', function (done) {
        sinceMap.get.returns(1234)
        listener.docker.getEvents.returns(Promise.reject('error'))

        listener.start().asCallback((err) => {
          if (err) { return done(err) }
          sinon.assert.calledOnce(listener.docker.getEvents)
          sinon.assert.calledWith(listener.docker.getEvents, {
            filters: {
              event: listener.events
            },
            since: 1234
          })
          done()
        })
      })

      it('should default since to 0', function (done) {
        sinceMap.get.returns()
        listener.docker.getEvents.returns(Promise.reject('error'))

        listener.start().asCallback((err) => {
          if (err) { return done(err) }
          sinon.assert.calledOnce(listener.docker.getEvents)
          sinon.assert.calledWith(listener.docker.getEvents, {
            filters: {
              event: listener.events
            },
            since: 0
          })
          done()
        })
      })

      it('should setup pipes', function (done) {
        var stubStream = {
          on: sinon.stub().returnsThis(),
          once: sinon.stub().returnsThis()
        }
        sinceMap.get.returns()
        listener.docker.getEvents.returns(Promise.resolve(stubStream))

        listener.start().asCallback((err) => {
          if (err) { return done(err) }
          sinon.assert.callCount(stubStream.on, 5)
          sinon.assert.calledWith(stubStream.on, 'error', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'close', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'disconnect', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'end', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'data', sinon.match.func)

          sinon.assert.calledTwice(stubStream.once)
          sinon.assert.calledWith(stubStream.once, 'data', sinon.match.func)
          sinon.assert.calledWith(stubStream.once, 'readable', sinon.match.func)

          sinon.assert.notCalled(listener.handleClose)
          done()
        })
      })
    }) // end start

    describe('handleError', function () {
      beforeEach(function (done) {
        sinon.stub(ErrorCat.prototype, 'createAndReport')
        done()
      })

      afterEach(function (done) {
        ErrorCat.prototype.createAndReport.restore()
        done()
      })

      it('should call reporting tools', function (done) {
        var err = 'booms'
        listener.handleError(err)

        sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
        sinon.assert.calledWith(ErrorCat.prototype.createAndReport, 500, 'Docker streaming error', err)
        done()
      })
    }) // end handleError

    describe('handleClose', function () {
      var eventStreamStub
      var closeCbStub

      beforeEach(function (done) {
        listener.eventStream = {
          destroy: eventStreamStub = sinon.stub()
        }
        listener.closeCb = closeCbStub = sinon.stub()
        sinon.stub(ErrorCat.prototype, 'createAndReport')
        done()
      })

      afterEach(function (done) {
        ErrorCat.prototype.createAndReport.restore()
        done()
      })

      it('should report', function (done) {
        var testErr = new Error('dissatisfactory')
        ErrorCat.prototype.createAndReport.returns()
        listener.handleClose(testErr)
        sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
        sinon.assert.calledWith(ErrorCat.prototype.createAndReport, 500, testErr.message, testErr)
        done()
      })

      it('should report default message', function (done) {
        ErrorCat.prototype.createAndReport.returns()
        listener.handleClose()
        sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
        sinon.assert.calledWith(ErrorCat.prototype.createAndReport, 500, 'unknown error')
        done()
      })

      it('should destroy stream', function (done) {
        var testErr = new Error('dissatisfactory')
        ErrorCat.prototype.createAndReport.returns()
        listener.handleClose(testErr)
        sinon.assert.calledOnce(eventStreamStub)
        expect(listener.eventStream).to.be.undefined()
        done()
      })

      it('should not throw if no destroy', function (done) {
        var testErr = new Error('dissatisfactory')
        ErrorCat.prototype.createAndReport.returns()
        delete listener.eventStream.destroy
        expect(() => {
          listener.handleClose(testErr)
        }).to.not.throw()
        sinon.assert.notCalled(eventStreamStub)
        expect(listener.eventStream.destroy).to.be.undefined()
        done()
      })

      it('should not throw if no eventStream', function (done) {
        var testErr = new Error('dissatisfactory')
        ErrorCat.prototype.createAndReport.returns()
        delete listener.eventStream
        expect(() => {
          listener.handleClose(testErr)
        }).to.not.throw()
        sinon.assert.notCalled(eventStreamStub)
        expect(listener.eventStream).to.be.undefined()
        done()
      })

      it('should not throw if no closeCb', function (done) {
        var testErr = new Error('dissatisfactory')
        ErrorCat.prototype.createAndReport.returns()
        delete listener.closeCb
        expect(() => {
          listener.handleClose(testErr)
        }).to.not.throw()
        sinon.assert.notCalled(closeCbStub)
        expect(listener.closeCb).to.be.undefined()
        done()
      })

      it('should call closeCb', function (done) {
        var testErr = new Error('dissatisfactory')
        ErrorCat.prototype.createAndReport.returns()
        expect(() => {
          listener.handleClose(testErr)
        }).to.not.throw()
        sinon.assert.calledOnce(closeCbStub)
        expect(listener.closeCb).to.be.undefined()
        done()
      })
    }) // end handleClose

    describe('publishEvent', function () {
      beforeEach(function (done) {
        sinon.stub(rabbitmq, 'createPublishJob')
        done()
      })

      afterEach(function (done) {
        rabbitmq.createPublishJob.restore()
        done()
      })

      it('should publish event', function (done) {
        var testEvent = { type: 'abhorrent' }
        listener.publishEvent(testEvent)

        sinon.assert.calledOnce(rabbitmq.createPublishJob)
        sinon.assert.calledWith(rabbitmq.createPublishJob, {
          event: testEvent,
          Host: testHost,
          org: testOrg
        })
        done()
      })

      it('should not publish event', function (done) {
        listener.publishEvent()
        sinon.assert.notCalled(rabbitmq.createPublishJob)
        done()
      })
    }) // end publishEvent

    describe('startTimeout', function () {
      var clock
      beforeEach(function (done) {
        process.env.EVENT_TIMEOUT_MS = 15
        clock = sinon.useFakeTimers()
        sinon.stub(listener.docker, 'testEvent')
        sinon.stub(listener, 'handleClose')
        done()
      })

      afterEach(function (done) {
        delete process.env.EVENT_TIMEOUT_MS
        clock.restore()
        done()
      })

      it('should timeout', function (done) {
        listener.startTimeout()
        clock.tick(20)
        sinon.assert.calledOnce(listener.handleClose)
        sinon.assert.calledWith(listener.handleClose, sinon.match.instanceOf(Error))
        done()
      })

      it('should not timeout and call test Event', function (done) {
        listener.startTimeout()
        clock.tick(5)
        sinon.assert.notCalled(listener.handleClose)
        sinon.assert.calledOnce(listener.docker.testEvent)
        done()
      })
    }) // end startTimeout

    describe('clearTimeout', function () {
      var clock
      beforeEach(function (done) {
        clock = sinon.useFakeTimers()
        done()
      })

      afterEach(function (done) {
        clock.restore()
        done()
      })

      it('should clearTimeout', function (done) {
        var testStub = sinon.stub()
        listener.timeout = setTimeout(testStub, 15)
        listener.clearTimeout()
        clock.tick(100)
        sinon.assert.notCalled(testStub)
        done()
      })
    }) // end clearTimeout
  }) // end methods
})
