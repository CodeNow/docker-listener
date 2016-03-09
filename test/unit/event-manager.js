'use strict'
require('loadenv')()

var Code = require('code')
var Lab = require('lab')
var Promise = require('bluebird')
var sinon = require('sinon')

var eventManager = require('../../lib/event-manager')
var Docker = require('../../lib/docker')
var Listener = require('../../lib/listener')

var lab = exports.lab = Lab.script()

var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var describe = lab.describe
var expect = Code.expect
var it = lab.it

describe('event-manager.js unit test', function () {
  describe('singleton', function () {
    it('should be a singleton', function (done) {
      expect(eventManager).to.be.an.instanceOf(eventManager.constructor)
      expect(eventManager.dockListeners).to.deep.equal({})
      done()
    })
  }) // end singleton

  describe('methods', function () {
    describe('start', function () {
      beforeEach(function (done) {
        eventManager.dockListeners = {}
        sinon.stub(eventManager, 'startSwarmListener')
        sinon.stub(eventManager, 'startDockListener')
        sinon.stub(Docker.prototype, 'getNodes')
        done()
      })

      afterEach(function (done) {
        eventManager.startSwarmListener.restore()
        eventManager.startDockListener.restore()
        Docker.prototype.getNodes.restore()
        done()
      })

      it('should listen on all nodes', function (done) {
        var testNode1 = {Host: '10.1.1.1'}
        var testNode2 = {Host: '10.1.1.2'}
        eventManager.startSwarmListener.returns(Promise.resolve())
        eventManager.startDockListener.returns(Promise.resolve())
        Docker.prototype.getNodes.returns(Promise.resolve([testNode1, testNode2]))

        eventManager.start().asCallback((err) => {
          if (err) { return done(err) }

          sinon.assert.calledOnce(eventManager.startSwarmListener)

          sinon.assert.calledTwice(eventManager.startDockListener)
          sinon.assert.calledWith(eventManager.startDockListener, testNode2)
          sinon.assert.calledWith(eventManager.startDockListener, testNode1)
          done()
        })
      })

      it('should skip listening nodes', function (done) {
        var testNode1 = {Host: '10.0.0.1:4242'}
        var testNode2 = {Host: '10.0.0.2:4242'}
        var testNode3 = {Host: '10.0.0.3:4242'}
        eventManager.dockListeners = {
          '10.0.0.1:4242': 'stuff'
        }
        eventManager.startSwarmListener.returns(Promise.resolve())
        eventManager.startDockListener.returns(Promise.resolve())
        Docker.prototype.getNodes.returns(Promise.resolve([testNode1, testNode2, testNode3]))

        eventManager.start().asCallback((err) => {
          if (err) { return done(err) }

          sinon.assert.calledOnce(eventManager.startSwarmListener)

          sinon.assert.calledTwice(eventManager.startDockListener)
          sinon.assert.calledWith(eventManager.startDockListener, testNode3)
          sinon.assert.calledWith(eventManager.startDockListener, testNode2)
          sinon.assert.neverCalledWith(eventManager.startDockListener, testNode1)
          done()
        })
      })
    }) // end start

    describe('startSwarmListener', function () {
      beforeEach(function (done) {
        sinon.stub(Listener.prototype, 'start')
        done()
      })

      afterEach(function (done) {
        Listener.prototype.start.restore()
        done()
      })

      it('should start swarm listener', function (done) {
        eventManager.startSwarmListener()
        sinon.assert.calledOnce(Listener.prototype.start)
        done()
      })
    }) // end startSwarmListener

    describe('startDockListener', function () {
      beforeEach(function (done) {
        sinon.stub(Listener.prototype, 'start')
        done()
      })

      afterEach(function (done) {
        Listener.prototype.start.restore()
        done()
      })

      it('should start dock listener', function (done) {
        eventManager.startDockListener({ Host: 'a', Labels: { org: '1' } })
        sinon.assert.calledOnce(Listener.prototype.start)
        done()
      })

      it('should start add listener to map', function (done) {
        eventManager.startDockListener({ Host: 'a', Labels: { org: '1' } })
        expect(eventManager.dockListeners['a']).to.be.an.instanceOf(Listener)
        done()
      })
    }) // end startDockListener
  }) // end methods
}) // end event-manager.js unit test
