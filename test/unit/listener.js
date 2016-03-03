/**
 * @module test/listener
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })
var Code = require('code')
var ErrorCat = require('error-cat')
var EventEmitter = require('events').EventEmitter
var Lab = require('lab')
var sinon = require('sinon')

var datadog = require('../../lib/datadog')
var docker = require('../../lib/docker')
var Listener = require('../../lib/listener')
var status = require('../../lib/status')

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
        sinon.stub(ErrorCat.prototype, 'createAndReport')
        done()
      })

      afterEach(function (done) {
        docker.getEvents.restore()
        ErrorCat.prototype.createAndReport.restore()
        done()
      })

      it('should on error', function (done) {
        docker.getEvents.yieldsAsync('error')
        ErrorCat.prototype.createAndReport.yieldsAsync()

        sinon.stub(listener, 'handleClose', function () {
          sinon.assert.calledOnce(docker.getEvents)
          sinon.assert.calledWith(docker.getEvents, sinon.match.func)
          done()
        })

        listener.start()
      })

      it('should setup pipes', function (done) {
        var stubStream = {
          on: sinon.stub().returnsThis(),
          socket: {
            setTimeout: sinon.stub()
          }
        }
        docker.getEvents.yieldsAsync(null, stubStream)
        sinon.stub(listener, 'emit', function (name) {
          expect(name).to.equal('started')

          sinon.assert.callCount(stubStream.on, 4)
          sinon.assert.calledWith(stubStream.on, 'error', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'close', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'data', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'data', sinon.match.func)
          done()
        })

        listener.start()
      })
    }) // end start

    describe('stop', function () {
      it('should emit stop and set connection', function (done) {
        status.docker_connected = true

        listener.on('stopped', function () {
          expect(status.docker_connected).to.be.false()
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
      beforeEach(function (done) {
        sinon.stub(process, 'exit')
        done()
      })

      afterEach(function (done) {
        process.exit.restore()
        done()
      })

      it('should call exit', function (done) {
        listener.handleClose()
        sinon.assert.calledOnce(process.exit)
        sinon.assert.calledWith(process.exit, 1)

        done()
      })
    }) // end handleClose
  }) // end methods
})
