/**
 * @module test/listener
 */
'use strict'
require('loadenv')()

var Code = require('code')
var ErrorCat = require('error-cat')
var Lab = require('lab')
var Promise = require('bluebird')
var sinon = require('sinon')

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

describe('listener unit test', () => {
  describe('constructor', () => {
    it('should setup docker listener', (done) => {
      var listener
      expect(() => {
        listener = new Listener('10.0.0.1:4242', '123')
      }).to.not.throw()
      expect(listener).to.be.an.instanceOf(Listener)
      expect(listener.host).to.equal('10.0.0.1:4242')
      expect(listener.org).to.equal('123')
      expect(listener.type).to.equal('docker')
      expect(listener.events).to.deep.equal(['create', 'start', 'die', 'top'])
      expect(listener.docker).to.be.an.instanceOf(Docker)
      done()
    })

    it('should setup swarm listener', (done) => {
      var listener
      expect(() => {
        listener = new Listener('10.0.0.1:4242', null)
      }).to.not.throw()
      expect(listener).to.be.an.instanceOf(Listener)
      expect(listener.host).to.equal('10.0.0.1:4242')
      expect(listener.org).to.be.null()
      expect(listener.type).to.equal('swarm')
      expect(listener.events).to.deep.equal(['engine_connect', 'engine_disconnect', 'top'])
      expect(listener.docker).to.be.an.instanceOf(Docker)
      done()
    })
  }) // end constructor

  describe('methods', () => {
    var listener
    var testHost = '10.0.0.1:4242'
    var testOrg = '1234'

    beforeEach((done) => {
      listener = new Listener(testHost, testOrg)
      done()
    })

    describe('start', () => {
      var clock
      beforeEach((done) => {
        process.env.EVENT_TIMEOUT_MS = 15
        clock = sinon.useFakeTimers()
        sinon.stub(listener.docker, 'getEvents')
        sinon.stub(listener.docker, 'testEvent')
        sinon.stub(listener, 'handleClose')
        sinon.stub(listener, 'handleError')
        sinon.stub(listener, 'publishEvent')
        sinon.stub(listener, 'clearTimeout')
        sinon.stub(sinceMap, 'get')
        done()
      })

      afterEach((done) => {
        delete process.env.EVENT_TIMEOUT_MS
        clock.restore()
        listener.handleClose.restore()
        listener.handleError.restore()
        listener.publishEvent.restore()
        listener.clearTimeout.restore()
        sinceMap.get.restore()
        done()
      })

      it('should throw if getting events threw error', (done) => {
        var testErr = new Error('uncanny')
        sinceMap.get.returns()
        listener.docker.getEvents.returns(Promise.reject(testErr))

        listener.start().asCallback((err) => {
          expect(err).to.equal(testErr)
          done()
        })
      })

      it('should pass correct opts', (done) => {
        sinceMap.get.returns(1234)
        listener.docker.getEvents.returns(Promise.reject('error'))

        listener.start().asCallback(() => {
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

      it('should default since to 0', (done) => {
        sinceMap.get.returns()
        listener.docker.getEvents.returns(Promise.reject('error'))

        listener.start().asCallback(() => {
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

      it('should setup pipes', (done) => {
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
          sinon.assert.calledWith(stubStream.on, 'end', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'disconnect', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'data', sinon.match.func)

          sinon.assert.calledTwice(stubStream.once)
          sinon.assert.calledWith(stubStream.once, 'data', sinon.match.func)
          sinon.assert.calledWith(stubStream.once, 'readable', sinon.match.func)

          sinon.assert.notCalled(listener.handleClose)
          done()
        })
      })

      it('should not timeout and call test Event', (done) => {
        var stubStream = {
          on: sinon.stub().returnsThis(),
          once: sinon.stub().returnsThis()
        }
        sinceMap.get.returns()
        listener.docker.getEvents.returns(Promise.resolve(stubStream))

        listener.start().then(() => {
          clock.tick(10)
          sinon.assert.notCalled(listener.handleClose)
          done()
        })
        .catch(done)
      })

      it('should timeout', (done) => {
        var stubStream = {
          on: sinon.stub().returnsThis(),
          once: sinon.stub().returnsThis()
        }
        sinceMap.get.returns()
        listener.docker.getEvents.returns(Promise.resolve(stubStream))

        listener.start().asCallback((err) => {
          if (err) { return done(err) }

          clock.tick(20)
          sinon.assert.calledOnce(listener.handleClose)
          sinon.assert.calledWith(listener.handleClose, sinon.match.instanceOf(Error))
          done()
        })
      })
    }) // end start

    describe('handleError', () => {
      beforeEach((done) => {
        sinon.stub(ErrorCat.prototype, 'createAndReport')
        done()
      })

      afterEach((done) => {
        ErrorCat.prototype.createAndReport.restore()
        done()
      })

      it('should call reporting tools', (done) => {
        var err = 'booms'
        listener.handleError(err)

        sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
        sinon.assert.calledWith(ErrorCat.prototype.createAndReport, 500, 'Docker streaming error', err)
        done()
      })
    }) // end handleError

    describe('handleClose', () => {
      var eventStreamStub

      beforeEach((done) => {
        listener.eventStream = {
          destroy: eventStreamStub = sinon.stub()
        }
        sinon.stub(rabbitmq, 'createStreamConnectJob')
        sinon.stub(ErrorCat.prototype, 'createAndReport')
        done()
      })

      afterEach((done) => {
        rabbitmq.createStreamConnectJob.restore()
        ErrorCat.prototype.createAndReport.restore()
        done()
      })

      it('should report', (done) => {
        var testErr = new Error('dissatisfactory')
        ErrorCat.prototype.createAndReport.returns()
        listener.handleClose(testErr)
        sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
        sinon.assert.calledWith(ErrorCat.prototype.createAndReport, 500, testErr.message, testErr)
        done()
      })

      it('should create job', (done) => {
        var testErr = new Error('dissatisfactory')
        ErrorCat.prototype.createAndReport.returns()
        listener.handleClose(testErr)
        sinon.assert.calledOnce(rabbitmq.createStreamConnectJob)
        sinon.assert.calledWith(rabbitmq.createStreamConnectJob, 'docker', testHost, testOrg)
        done()
      })

      it('should report default message', (done) => {
        ErrorCat.prototype.createAndReport.returns()
        listener.handleClose()
        sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
        sinon.assert.calledWith(ErrorCat.prototype.createAndReport, 500, 'unknown error')
        done()
      })

      it('should destroy stream', (done) => {
        var testErr = new Error('dissatisfactory')
        ErrorCat.prototype.createAndReport.returns()
        listener.handleClose(testErr)
        sinon.assert.calledOnce(eventStreamStub)
        expect(listener.eventStream).to.be.undefined()
        done()
      })

      it('should not throw if no destroy', (done) => {
        var testErr = new Error('dissatisfactory')
        delete listener.eventStream.destroy
        expect(() => {
          listener.handleClose(testErr)
        }).to.not.throw()
        sinon.assert.notCalled(eventStreamStub)
        expect(listener.eventStream).to.be.undefined()
        done()
      })

      it('should do nothing is eventStream null', (done) => {
        delete listener.eventStream
        listener.handleClose()
        sinon.assert.notCalled(ErrorCat.prototype.createAndReport)
        sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
        sinon.assert.notCalled(eventStreamStub)
        done()
      })
    }) // end handleClose

    describe('publishEvent', () => {
      beforeEach((done) => {
        sinon.stub(rabbitmq, 'createPublishJob')
        done()
      })

      afterEach((done) => {
        rabbitmq.createPublishJob.restore()
        done()
      })

      it('should publish event', (done) => {
        var testEvent = new Buffer(JSON.stringify({ type: 'abhorrent' }))
        listener.publishEvent(testEvent)

        sinon.assert.calledOnce(rabbitmq.createPublishJob)
        sinon.assert.calledWith(rabbitmq.createPublishJob, {
          event: testEvent.toString(),
          Host: testHost,
          org: testOrg
        })
        done()
      })

      it('should not publish event', (done) => {
        listener.publishEvent()
        sinon.assert.notCalled(rabbitmq.createPublishJob)
        done()
      })
    }) // end publishEvent

    describe('clearTimeout', () => {
      var clock
      beforeEach((done) => {
        clock = sinon.useFakeTimers()
        done()
      })

      afterEach((done) => {
        clock.restore()
        done()
      })

      it('should clearTimeout', (done) => {
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
