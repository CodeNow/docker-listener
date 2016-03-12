'use strict'

const Code = require('code')
const Lab = require('lab')
const sinon = require('sinon')

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
      expect(eventManager.dockListeners).to.deep.equal({})
      done()
    })
  }) // end singleton

  describe('methods', () => {
    beforeEach((done) => {
      eventManager.dockListeners = {}
      done()
    })

    describe('startSwarmListener', () => {
      beforeEach((done) => {
        sinon.stub(Listener.prototype, 'start')
        done()
      })

      afterEach((done) => {
        Listener.prototype.start.restore()
        done()
      })

      it('should start swarm listener', (done) => {
        eventManager.startSwarmListener()
        sinon.assert.calledOnce(Listener.prototype.start)
        done()
      })
    }) // end startSwarmListener

    describe('startDockListener', () => {
      beforeEach((done) => {
        sinon.stub(Listener.prototype, 'start')
        done()
      })

      afterEach((done) => {
        Listener.prototype.start.restore()
        done()
      })

      it('should start dock listener', (done) => {
        eventManager.startDockListener('host', 'org')
        sinon.assert.calledOnce(Listener.prototype.start)
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
  }) // end methods
}) // end event-manager.js unit test
