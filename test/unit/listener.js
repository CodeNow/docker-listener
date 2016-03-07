/**
 * @module test/listener
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })
var Code = require('code')
var ErrorCat = require('error-cat')
var Lab = require('lab')
var sinon = require('sinon')

var docker = require('../../lib/docker')
var Listener = require('../../lib/listener')

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
        listener = new Listener()
      }).to.not.throw()
      expect(listener).to.be.an.instanceOf(Listener)
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
      var clock
      beforeEach(function (done) {
        process.env.EVENT_TIMEOUT_MS = 100
        clock = sinon.useFakeTimers()
        sinon.stub(docker, 'getEvents')
        sinon.stub(ErrorCat.prototype, 'createAndReport')
        sinon.stub(listener, 'handleClose')
        done()
      })

      afterEach(function (done) {
        docker.getEvents.restore()
        ErrorCat.prototype.createAndReport.restore()
        listener.handleClose.restore()
        clock.restore()
        delete process.env.EVENT_TIMEOUT_MS
        done()
      })

      it('should report error', function (done) {
        docker.getEvents.yields('error')
        ErrorCat.prototype.createAndReport.yields()
        listener.handleClose.returns()

        listener.start()
        sinon.assert.calledOnce(listener.handleClose)
        sinon.assert.calledWith(listener.handleClose, 'error')
        done()
      })

      it('should setup pipes', function (done) {
        var stubStream = {
          on: sinon.stub().returnsThis(),
          once: sinon.stub().returnsThis()
        }
        docker.getEvents.yieldsAsync(null, stubStream)

        listener.start(function () {
          sinon.assert.callCount(stubStream.on, 3)
          sinon.assert.calledWith(stubStream.on, 'error', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'close', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'data', sinon.match.func)

          sinon.assert.calledOnce(stubStream.once)
          sinon.assert.calledWith(stubStream.once, 'data', sinon.match.func)
          done()
        })
      })

      it('should timeout', function (done) {
        var stubStream = {
          on: sinon.stub().returnsThis(),
          once: sinon.stub().returnsThis()
        }
        docker.getEvents.yieldsAsync(null, stubStream)

        listener.start(function () {
          clock.tick(200)

          sinon.assert.calledOnce(listener.handleClose)

          done()
        })
      })

      it('should not timeout', function (done) {
        var stubStream = {
          on: sinon.stub().returnsThis(),
          once: sinon.stub().yields()
        }
        docker.getEvents.yieldsAsync(null, stubStream)

        listener.start(function () {
          clock.tick(200)

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
      beforeEach(function (done) {
        sinon.stub(process, 'exit')
        sinon.stub(ErrorCat.prototype, 'createAndReport')
        done()
      })

      afterEach(function (done) {
        process.exit.restore()
        ErrorCat.prototype.createAndReport.restore()
        done()
      })

      it('should call exit', function (done) {
        ErrorCat.prototype.createAndReport.yields()
        listener.handleClose()
        sinon.assert.calledOnce(process.exit)
        sinon.assert.calledWith(process.exit, 1)
        done()
      })
    }) // end handleClose
  }) // end methods
})
