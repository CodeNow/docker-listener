'use strict'
require('loadenv')()

var Code = require('code')
var Lab = require('lab')
var sinon = require('sinon')

var eventManager = require('../../lib/event-manager')
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
    beforeEach(function (done) {
      eventManager.dockListeners = {}
      done()
    })

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
        eventManager.startDockListener('host', 'org')
        sinon.assert.calledOnce(Listener.prototype.start)
        done()
      })

      it('should start add listener to map', function (done) {
        eventManager.startDockListener('host', 'org')
        expect(eventManager.dockListeners['host']).to.be.an.instanceOf(Listener)
        expect(eventManager.dockListeners['host'].host).to.equal('host')
        expect(eventManager.dockListeners['host'].org).to.equal('org')
        done()
      })
    }) // end startDockListener

    describe('hasListener', function () {
      it('should return true', function (done) {
        eventManager.dockListeners['host'] = 'test'
        expect(eventManager.hasListener('host')).to.be.true()
        done()
      })

      it('should return false', function (done) {
        expect(eventManager.hasListener('host')).to.be.false()
        done()
      })
    }) // end hasListener

    describe('hasListener', function () {
      it('should remove listener', function (done) {
        eventManager.dockListeners['host'] = 'test'
        eventManager.removeDockListener('host')
        expect(eventManager.dockListeners['host']).to.be.undefined()
        done()
      })
    }) // end hasListener
  }) // end methods
}) // end event-manager.js unit test
