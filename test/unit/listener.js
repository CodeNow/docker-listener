'use strict'
require('loadenv')()

const Code = require('code')
const errorCat = require('error-cat')
const EventEmitter = require('events')
const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')

require('sinon-as-promised')(Promise)
const Docker = require('../../lib/docker')
const eventMock = require('../fixtures/event-mock.js')
const Listener = require('../../lib/listener')
const rabbitmq = require('../../lib/rabbitmq')
const sinceMap = require('../../lib/since-map')
const dockerUtils = require('../../lib/docker-utils')
const swarmEventMock = require('../fixtures/swarm-event-mock.js')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const expect = Code.expect
const it = lab.test

describe('listener unit test', () => {
  describe('constructor', () => {
    it('should setup docker listener', (done) => {
      let listener
      expect(() => {
        listener = new Listener('10.0.0.1:4242', '123')
      }).to.not.throw()
      expect(listener).to.be.an.instanceOf(Listener)
      expect(listener.host).to.equal('10.0.0.1:4242')
      expect(listener.org).to.equal('123')
      expect(listener.type).to.equal('docker')
      expect(listener.events).to.equal(['create', 'start', 'die', 'top'])
      expect(listener.docker).to.be.an.instanceOf(Docker)
      done()
    })

    it('should setup swarm listener', (done) => {
      let listener
      expect(() => {
        listener = new Listener('10.0.0.1:4242', null)
      }).to.not.throw()
      expect(listener).to.be.an.instanceOf(Listener)
      expect(listener.host).to.equal('10.0.0.1:4242')
      expect(listener.org).to.be.null()
      expect(listener.type).to.equal('swarm')
      expect(listener.events).to.equal(['engine_connect', 'top'])
      expect(listener.docker).to.be.an.instanceOf(Docker)
      done()
    })
  }) // end constructor

  describe('methods', () => {
    let listener
    const testIp = '10.0.0.1'
    const testHost = testIp + ':4242'
    const testOrg = '1234'

    beforeEach((done) => {
      listener = new Listener(testHost, testOrg)
      done()
    })

    describe('eventOnList', function () {
      it('should return false if event is not defined', function (done) {
        const isOn = listener.eventOnList(null, '1,2,3')
        expect(isOn).to.equal(false)
        done()
      })

      it('should return false if event.from is not defined', function (done) {
        const isOn = listener.eventOnList({}, '1,2,3')
        expect(isOn).to.equal(false)
        done()
      })

      it('should return false if event.from is not a string', function (done) {
        const isOn = listener.eventOnList({ from: 1 }, '1,2,3')
        expect(isOn).to.equal(false)
        done()
      })

      it('should return true if event.from is on the list', function (done) {
        const isOn = listener.eventOnList({ from: '1' }, '1,2,3')
        expect(isOn).to.equal(true)
        done()
      })
    })
    describe('start', () => {
      beforeEach((done) => {
        sinon.stub(rabbitmq, 'createConnectedJob')
        sinon.stub(listener.docker, 'getEventsAsync')
        sinon.stub(listener, 'handleClose')
        sinon.stub(listener, 'handleError')
        sinon.stub(listener, 'publishEvent')
        sinon.stub(listener, 'testStream')
        sinon.stub(sinceMap, 'get')
        done()
      })

      afterEach((done) => {
        sinceMap.get.restore()
        rabbitmq.createConnectedJob.restore()
        done()
      })

      it('should throw set state disconnected on event error', (done) => {
        const testErr = new Error('uncanny')
        sinceMap.get.returns()
        listener.docker.getEventsAsync.returns(Promise.reject(testErr))

        listener.start().asCallback((err) => {
          expect(err.message).to.equal('Failed to get events')
          expect(err.data.err).to.equal(testErr)
          expect(listener.state).to.equal('disconnected')
          done()
        })
      })

      it('should pass correct opts', (done) => {
        sinceMap.get.returns(1234)
        listener.docker.getEventsAsync.returns(Promise.reject('error'))

        listener.start().asCallback(() => {
          sinon.assert.calledOnce(listener.docker.getEventsAsync)
          sinon.assert.calledWith(listener.docker.getEventsAsync, {
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
        listener.docker.getEventsAsync.returns(Promise.reject('error'))

        listener.start().asCallback(() => {
          sinon.assert.calledOnce(listener.docker.getEventsAsync)
          sinon.assert.calledWith(listener.docker.getEventsAsync, {
            filters: {
              event: listener.events
            },
            since: 0
          })
          done()
        })
      })

      it('should setup pipes', (done) => {
        const stubStream = {
          on: sinon.stub().returnsThis(),
          once: sinon.stub().returnsThis()
        }
        sinceMap.get.returns()
        listener.docker.getEventsAsync.returns(Promise.resolve(stubStream))
        listener.testStream.resolves()

        listener.start().asCallback((err) => {
          if (err) { return done(err) }
          sinon.assert.callCount(stubStream.on, 5)
          sinon.assert.calledWith(stubStream.on, 'error', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'close', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'end', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'disconnect', sinon.match.func)
          sinon.assert.calledWith(stubStream.on, 'data', sinon.match.func)

          sinon.assert.notCalled(listener.handleClose)
          sinon.assert.calledOnce(listener.testStream)
          done()
        })
      })

      it('should handle error event', (done) => {
        const emitter = new EventEmitter()
        sinceMap.get.returns()
        listener.docker.getEventsAsync.returns(Promise.resolve(emitter))
        listener.testStream.resolves()

        listener.start().asCallback((err) => {
          if (err) { return done(err) }
          emitter.emit('error')
          sinon.assert.calledOnce(listener.handleError)
          done()
        })
      })

      it('should handle close event', (done) => {
        const EventEmitter = require('events')
        const emitter = new EventEmitter()
        sinceMap.get.returns()
        listener.docker.getEventsAsync.returns(Promise.resolve(emitter))
        listener.testStream.resolves()

        listener.start().asCallback((err) => {
          if (err) { return done(err) }
          emitter.emit('close')
          sinon.assert.calledOnce(listener.handleClose)
          sinon.assert.calledWith(listener.handleClose, sinon.match.instanceOf(Error))
          done()
        })
      })

      it('should handle end event', (done) => {
        const EventEmitter = require('events')
        const emitter = new EventEmitter()
        sinceMap.get.returns()
        listener.docker.getEventsAsync.returns(Promise.resolve(emitter))
        listener.testStream.resolves()

        listener.start().asCallback((err) => {
          if (err) { return done(err) }
          emitter.emit('end')
          sinon.assert.calledOnce(listener.handleClose)
          sinon.assert.calledWith(listener.handleClose, sinon.match.instanceOf(Error))
          done()
        })
      })

      it('should handle disconnect event', (done) => {
        const EventEmitter = require('events')
        const emitter = new EventEmitter()
        sinceMap.get.returns()
        listener.docker.getEventsAsync.returns(Promise.resolve(emitter))
        listener.testStream.resolves()

        listener.start().asCallback((err) => {
          if (err) { return done(err) }
          emitter.emit('disconnect')
          sinon.assert.calledOnce(listener.handleClose)
          sinon.assert.calledWith(listener.handleClose, sinon.match.instanceOf(Error))
          done()
        })
      })

      it('should handle data event', (done) => {
        const EventEmitter = require('events')
        const emitter = new EventEmitter()
        sinceMap.get.returns()
        listener.docker.getEventsAsync.returns(Promise.resolve(emitter))
        listener.testStream.resolves()

        listener.start().asCallback((err) => {
          if (err) { return done(err) }
          emitter.emit('data', 'testData')
          emitter.emit('data', 'testData')
          sinon.assert.calledTwice(listener.publishEvent)
          sinon.assert.calledWith(listener.publishEvent, 'testData')
          done()
        })
      })

      it('should call createConnectedJob on success', (done) => {
        const stubStream = {
          on: sinon.stub().returnsThis(),
          once: sinon.stub().returnsThis()
        }
        listener.type = 'type'
        listener.org = 'org'
        listener.host = 'host'
        sinceMap.get.returns()
        listener.docker.getEventsAsync.resolves(stubStream)
        listener.testStream.resolves()

        listener.start().asCallback((err) => {
          if (err) { return done(err) }

          sinon.assert.notCalled(listener.handleClose)
          sinon.assert.calledOnce(listener.testStream)
          sinon.assert.calledOnce(rabbitmq.createConnectedJob)
          sinon.assert.calledWith(rabbitmq.createConnectedJob, listener.type, listener.host, listener.org)
          done()
        })
      })
    }) // end start

    describe('testStream', function () {
      let clock
      beforeEach((done) => {
        process.env.EVENT_TIMEOUT_MS = 15
        listener.eventStream = new EventEmitter()
        sinon.spy(listener.eventStream, 'once')
        sinon.stub(rabbitmq, 'createConnectedJob')
        sinon.stub(dockerUtils, 'testEvent')
        clock = sinon.useFakeTimers()
        done()
      })

      afterEach((done) => {
        delete process.env.EVENT_TIMEOUT_MS
        rabbitmq.createConnectedJob.restore()
        clock.restore()
        dockerUtils.testEvent.restore()
        done()
      })

      it('should resolve after connected', (done) => {
        listener.testStream().asCallback((err) => {
          if (err) { return done(err) }
          expect(listener.state).to.equal('connected')
          sinon.assert.calledOnce(listener.eventStream.once)
          sinon.assert.calledWith(listener.eventStream.once, 'data', sinon.match.func)
          sinon.assert.calledOnce(dockerUtils.testEvent)
          sinon.assert.calledWith(dockerUtils.testEvent, listener.docker)
          done()
        })
        clock.tick(10)
        listener.eventStream.emit('data')
      })

      it('should reject on timeout and set state', (done) => {
        listener.testStream().asCallback((err) => {
          expect(err.message).to.equal('timeout getting events')
          expect(listener.state).to.equal('disconnected')
          done()
        })
        clock.tick(20)
      })
    }) // end testStream

    describe('handleError', () => {
      beforeEach((done) => {
        sinon.stub(errorCat, 'report')
        done()
      })

      afterEach((done) => {
        errorCat.report.restore()
        done()
      })

      it('should call reporting tools', (done) => {
        const err = 'booms'
        listener.handleError(err)

        sinon.assert.calledOnce(errorCat.report)
        sinon.assert.calledWith(errorCat.report,
          new Error('Docker streaming error'),
          { err: err })
        done()
      })
    }) // end handleError

    describe('handleClose', () => {
      const testErr = new Error('dissatisfactory')

      beforeEach((done) => {
        sinon.stub(listener, '_destroyEventStream')
        sinon.stub(rabbitmq, 'createStreamConnectJob')
        done()
      })

      afterEach((done) => {
        listener._destroyEventStream.restore()
        rabbitmq.createStreamConnectJob.restore()
        done()
      })

      it('should create job', (done) => {
        listener.state = 'connected'
        listener.handleClose(testErr)
        sinon.assert.calledOnce(rabbitmq.createStreamConnectJob)
        sinon.assert.calledWith(rabbitmq.createStreamConnectJob, 'docker', testHost, testOrg)
        done()
      })

      it('should not create job', (done) => {
        listener.state = 'disconnected'
        listener.handleClose(testErr)
        sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
        done()
      })

      it('should call _destroyEventStream', (done) => {
        listener.handleClose()
        sinon.assert.calledOnce(listener._destroyEventStream)
        done()
      })
    }) // end handleClose

    describe('_destroyEventStream', () => {
      let eventStreamStub
      const testErr = new Error('dissatisfactory')

      beforeEach((done) => {
        listener.eventStream = {
          destroy: eventStreamStub = sinon.stub()
        }
        sinon.stub(errorCat, 'report').returns()
        done()
      })

      afterEach((done) => {
        errorCat.report.restore()
        done()
      })

      it('should report', (done) => {
        listener._destroyEventStream(testErr)
        sinon.assert.calledOnce(errorCat.report)
        sinon.assert.calledWith(errorCat.report, testErr)
        done()
      })

      it('should set disconnected state', (done) => {
        listener.state = 'connected'
        listener._destroyEventStream(testErr)
        expect(listener.state).to.equal('disconnected')
        done()
      })

      it('should not destroy if no destroy', (done) => {
        delete listener.eventStream.destroy
        expect(() => {
          listener._destroyEventStream(testErr)
        }).to.not.throw()
        sinon.assert.notCalled(eventStreamStub)
        expect(listener.eventStream).to.be.undefined()
        done()
      })

      it('should not destroy if no eventStream', (done) => {
        delete listener.eventStream
        expect(() => {
          listener._destroyEventStream(testErr)
        }).to.not.throw()
        sinon.assert.notCalled(eventStreamStub)
        expect(listener.eventStream).to.be.undefined()
        done()
      })
    }) // end _destroyEventStream

    describe('publishEvent', () => {
      beforeEach((done) => {
        sinon.stub(rabbitmq, 'createPublishJob')
        sinon.stub(listener, 'isBlacklisted')
        sinon.stub(listener, 'formatEvent')
        done()
      })

      afterEach((done) => {
        rabbitmq.createPublishJob.restore()
        done()
      })

      it('should publish formatted event', (done) => {
        const testJob = { type: 'abhorrent' }
        const testEventData = new Buffer(JSON.stringify(testJob))
        const testFormat = { formatted: 'true' }
        listener.isBlacklisted.returns(false)
        listener.formatEvent.returns(testFormat)
        listener.publishEvent(testEventData)

        sinon.assert.calledOnce(rabbitmq.createPublishJob)
        sinon.assert.calledWith(rabbitmq.createPublishJob, testFormat)

        sinon.assert.calledOnce(listener.formatEvent)
        sinon.assert.calledWith(listener.formatEvent, testJob)

        done()
      })

      it('should not publish if parse failed', (done) => {
        listener.publishEvent('defective')
        sinon.assert.notCalled(rabbitmq.createPublishJob)
        sinon.assert.notCalled(listener.isBlacklisted)
        done()
      })

      it('should not publish if event null', (done) => {
        listener.publishEvent()
        sinon.assert.notCalled(rabbitmq.createPublishJob)
        done()
      })

      it('should not publish if event is blacklisted', (done) => {
        const testJob = { type: 'abhorrent' }
        const testEventData = new Buffer(JSON.stringify(testJob))
        listener.isBlacklisted.returns(true)
        listener.publishEvent(testEventData)
        sinon.assert.notCalled(rabbitmq.createPublishJob)

        sinon.assert.calledOnce(listener.isBlacklisted)
        sinon.assert.calledWith(listener.isBlacklisted, testJob)
        done()
      })
    }) // end publishEvent

    describe('formatEvent', () => {
      it('should format docker event', (done) => {
        const testPort = '4242'
        const testTime = (Date.now() / 1000).toFixed(0)
        const event = eventMock({
          status: 'start',
          id: 'id',
          from: 'ubuntu',
          time: testTime,
          timeNano: testTime * 1000000
        })
        const enhanced = listener.formatEvent(event)

        expect(enhanced.status).to.equal('start')
        expect(enhanced.id).to.equal('id')
        expect(enhanced.from).to.equal('ubuntu')
        expect(enhanced.time).to.equal(testTime)
        expect(enhanced.timeNano).to.equal(testTime * 1000000)

        expect(enhanced.uuid).to.exist()
        expect(enhanced.ip).to.equal(testIp)
        expect(enhanced.dockerPort).to.equal(testPort)
        expect(enhanced.tags).to.equal(testOrg)
        expect(enhanced.org).to.equal(testOrg)
        const dockerUrl = 'http://' + testIp + ':4242'
        expect(enhanced.host).to.equal(dockerUrl)
        expect(enhanced.dockerUrl).to.equal(dockerUrl)
        done()
      })

      it('should format swarm event', (done) => {
        listener.type = 'swarm'
        const testPort = '4242'
        const testHost = testIp + ':' + testPort
        const testOrg = '12341234'
        const testTime = (Date.now() / 1000).toFixed(0)
        const event = swarmEventMock({
          host: testHost,
          org: testOrg,
          status: 'start',
          ip: testIp,
          from: 'ubuntu',
          time: testTime,
          timeNano: testTime * 1000000
        })
        const enhanced = listener.formatEvent(event)

        expect(enhanced.status).to.equal('start')
        expect(enhanced.id).to.equal(enhanced.uuid)
        expect(enhanced.from).to.equal(event.from)
        expect(enhanced.time).to.equal(testTime)
        expect(enhanced.timeNano).to.equal(testTime * 1000000)

        expect(enhanced.uuid).to.exist()
        expect(enhanced.ip).to.equal(testIp)
        expect(enhanced.dockerPort).to.equal(testPort)
        expect(enhanced.tags).to.equal(testOrg)
        expect(enhanced.org).to.equal(testOrg)
        const dockerUrl = 'http://' + testIp + ':4242'
        expect(enhanced.host).to.equal(dockerUrl)
        expect(enhanced.dockerUrl).to.equal(dockerUrl)
        done()
      })

      it('should set needsInspect to true', function (done) {
        process.env.IMAGE_INSPECT_LIST = 'black,blue'
        const event = swarmEventMock({
          from: 'black'
        })
        const enhanced = listener.formatEvent(event)

        expect(enhanced.needsInspect).to.be.true()
        done()
      })

      it('should set needsInspect to false', function (done) {
        process.env.IMAGE_INSPECT_LIST = 'black,blue'
        const event = swarmEventMock({
          from: 'orange'
        })
        const enhanced = listener.formatEvent(event)

        expect(enhanced.needsInspect).to.be.false()
        done()
      })
    })

    describe('isBlacklisted', () => {
      beforeEach(function (done) {
        listener.events = ['one', 'two']
        process.env.IMAGE_BLACKLIST = 'white,black'
        done()
      })

      afterEach(function (done) {
        delete process.env.IMAGE_BLACKLIST
        done()
      })

      it('should return true not event in list', (done) => {
        const test = listener.isBlacklisted({status: 'five'})
        expect(test).to.be.true()
        done()
      })

      it('should return true for blacklisted image', (done) => {
        const test = listener.isBlacklisted({
          status: 'one',
          from: 'white'
        })
        expect(test).to.be.true()
        done()
      })

      it('should return false', (done) => {
        const test = listener.isBlacklisted({
          status: 'one',
          from: 'blue'
        })
        expect(test).to.be.false()
        done()
      })
    }) // end isBlacklisted

    describe('isDisconnected', function () {
      it('should return true', function (done) {
        listener.state = 'disconnected'
        const out = listener.isDisconnected()
        expect(out).to.be.true()
        done()
      })

      it('should return false', function (done) {
        listener.state = 'connected'
        const out = listener.isDisconnected()
        expect(out).to.be.false()
        done()
      })
    }) // end isDisconnected
  }) // end methods
})
