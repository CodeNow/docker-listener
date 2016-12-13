'use strict'
require('loadenv')()

const Code = require('code')
const Lab = require('lab')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const eventManager = require('../../lib/event-manager')
const Listener = require('../../lib/listener')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.describe
const expect = Code.expect
const it = lab.it

describe('event-manager.js unit test', () => {
  describe('singleton', () => {
    it('should be a singleton', (done) => {
      expect(eventManager).to.be.an.instanceOf(eventManager.constructor)
      expect(eventManager.dockListeners).to.equal({})
      expect(eventManager.swarmConnected).to.be.null()
      done()
    })
  }) // end singleton

  describe('methods', () => {
    beforeEach((done) => {
      eventManager.dockListeners = {}
      eventManager.swarmConnected = null
      done()
    })

    describe('startSwarmListener', () => {
      beforeEach((done) => {
        sinon.stub(Listener.prototype, 'start')
        sinon.stub(eventManager, '_throwIfConnected')
        done()
      })

      afterEach((done) => {
        Listener.prototype.start.restore()
        eventManager._throwIfConnected.restore()
        done()
      })

      it('should start swarm listener', (done) => {
        eventManager.swarmListener = 'test'
        eventManager.startSwarmListener()
        sinon.assert.calledOnce(Listener.prototype.start)
        sinon.assert.calledOnce(eventManager._throwIfConnected)
        sinon.assert.calledWith(eventManager._throwIfConnected, 'test')
        done()
      })
    }) // end startSwarmListener

    describe('startDockListener', () => {
      beforeEach((done) => {
        sinon.stub(Listener.prototype, 'start')
        sinon.stub(eventManager, '_throwIfConnected')
        done()
      })

      afterEach((done) => {
        Listener.prototype.start.restore()
        eventManager._throwIfConnected.restore()
        done()
      })

      it('should start dock listener', (done) => {
        eventManager.dockListeners.host = 'test'
        eventManager.startDockListener('host', 'org')
        sinon.assert.calledOnce(Listener.prototype.start)
        sinon.assert.calledOnce(eventManager._throwIfConnected)
        sinon.assert.calledWith(eventManager._throwIfConnected, 'test')
        done()
      })

      it('should start add listener to map', (done) => {
        eventManager.startDockListener('host', 'org')
        expect(eventManager.dockListeners['host']).to.be.an.instanceOf(Listener)
        expect(eventManager.dockListeners['host'].host).to.equal('host')
        expect(eventManager.dockListeners['host'].org).to.equal('org')
        done()
      })
    }) // end startDockListener

    describe('_throwIfConnected', function () {
      it('should throw', function (done) {
        expect(() => {
          eventManager._throwIfConnected({
            isDisconnected: sinon.stub().returns(false)
          })
        }).to.throw(WorkerStopError)
        done()
      })

      it('should not throw', function (done) {
        expect(() => {
          eventManager._throwIfConnected({
            isDisconnected: sinon.stub().returns(true)
          })
        }).to.not.throw()
        done()
      })

      it('should not throw', function (done) {
        expect(() => {
          eventManager._throwIfConnected()
        }).to.not.throw()
        done()
      })
    }) // end _throwIfConnected

    describe('hasListener', () => {
      it('should return true', (done) => {
        eventManager.dockListeners['host'] = 'test'
        expect(eventManager.hasListener('host')).to.be.true()
        done()
      })

      it('should return false', (done) => {
        expect(eventManager.hasListener('host')).to.be.false()
        done()
      })
    }) // end hasListener

    describe('hasListener', () => {
      it('should remove listener', (done) => {
        eventManager.dockListeners['host'] = 'test'
        eventManager.removeDockListener('host')
        expect(eventManager.dockListeners['host']).to.be.undefined()
        done()
      })
    }) // end hasListener

    describe('getListeners', () => {
      it('should return listens', (done) => {
        const out = eventManager.getListeners()
        expect(out).to.equal(eventManager.dockListeners)
        done()
      })
    }) // end getListeners
  }) // end methods
}) // end event-manager.js unit test
