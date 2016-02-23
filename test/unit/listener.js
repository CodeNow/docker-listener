/**
 * @module test/listener
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })
var Code = require('code')
var Lab = require('lab')
var sinon = require('sinon')
var EventEmitter = require('events').EventEmitter
var ErrorCat = require('error-cat')

var Listener = require('../../lib/listener')
var docker = require('../../lib/docker')
var datadog = require('../../lib/datadog')

var lab = exports.lab = Lab.script()

var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var describe = lab.experiment
var expect = Code.expect
var it = lab.test

describe('listener unit test', function () {
  describe('constructor', function () {
    it('should throw if invalid publisher', function (done) {
      var l
      expect(function () {
        l = new Listener({})
      }).to.throw(Error)
      expect(l).to.not.exist()
      done()
    })

    it('should setup listener', function (done) {
      var listener
      var testPub = { write: 'hi' }
      expect(function () {
        listener = new Listener(testPub)
      }).to.not.throw()
      expect(listener.publisher).to.deep.equal(testPub)
      expect(listener.dockerEventStream).to.be.null()
      expect(listener).to.be.an.instanceOf(EventEmitter)
      done()
    })
  }) // end constructor

  describe('methods', function () {
    var listener
    beforeEach(function (done) {
      listener = new Listener({ write: sinon.stub() })
      done()
    })

    describe('start', function () {
      beforeEach(function (done) {
        sinon.stub(docker, 'getEvents')
        done()
      })

      afterEach(function (done) {
        docker.getEvents.restore()
        done()
      })

      it('should reconnect on error', function (done) {
        docker.getEvents.yieldsAsync('error')
        sinon.stub(listener, 'reconnect', function () {
          sinon.assert.calledOnce(docker.getEvents)
          sinon.assert.calledWith(docker.getEvents, sinon.match.func)
          done()
        })

        listener.start()
      })

      it('should setup pipes', function (done) {
        var stubStream = {
          on: sinon.stub().returnsThis(),
          pipe: sinon.stub(),
          socket: {
            setTimeout: sinon.stub()
          }
        }
        docker.getEvents.yieldsAsync(null, stubStream)
        sinon.stub(listener, 'emit', function (name) {
          expect(name).to.equal('started')

          sinon.assert.calledTwice(stubStream.on)
          sinon.assert.calledWith(stubStream.on, 'error', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'close', sinon.match.func)

          sinon.assert.calledTwice(stubStream.pipe)
          sinon.assert.calledWith(stubStream.pipe, listener.publisher)
          done()
        })

        listener.start()
      })
    }) // end start

    describe('stop', function () {
      beforeEach(function (done) {
        listener.dockerEventStream = {
          destroy: sinon.stub()
        }
        done()
      })

      it('should call destroy', function (done) {
        listener.dockerEventStream.destroy.returns()

        sinon.stub(listener, 'emit', function (name) {
          expect(name).to.equal('stopped')
          sinon.assert.calledOnce(listener.dockerEventStream.destroy)
          done()
        })

        listener.stop()
      })

      it('should not call destroy', function (done) {
        delete listener.dockerEventStream

        sinon.stub(listener, 'emit', function (name) {
          expect(name).to.equal('stopped')
          done()
        })

        listener.stop()
      })
    }) // end stop

    describe('handleError', function () {
      beforeEach(function (done) {
        sinon.stub(datadog, 'inc')
        sinon.stub(ErrorCat.prototype, 'createAndReport')
        done()
      })

      afterEach(function (done) {
        datadog.inc.restore()
        ErrorCat.prototype.createAndReport.restore()
        done()
      })

      it('should call reporting tools', function (done) {
        var err = 'booms'
        listener.handleError(err)
        sinon.assert.calledOnce(datadog.inc)
        sinon.assert.calledWith(datadog.inc, 'error')

        sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
        sinon.assert.calledWith(ErrorCat.prototype.createAndReport, 404, 'Docker streaming error', err)
        done()
      })
    }) // end handleError

    describe('handleClose', function () {
      var destroyStub = sinon.stub()
      beforeEach(function (done) {
        listener.dockerEventStream = {
          destroy: destroyStub
        }
        sinon.stub(listener, 'reconnect')
        done()
      })

      it('should call destroy and reconnect', function (done) {
        listener.handleClose()

        expect(listener.dockerEventStream).to.be.null()
        sinon.assert.calledOnce(destroyStub)
        sinon.assert.calledOnce(listener.reconnect)
        done()
      })
    }) // end handleClose

    describe('reconnect', function () {
      beforeEach(function (done) {
        sinon.stub(listener, 'start')
        done()
      })

      it('should call reconnect', function (done) {
        listener.reconnect()
        sinon.assert.calledOnce(listener.start)
        done()
      })
    }) // end reconnect
  }) // end methods
})
