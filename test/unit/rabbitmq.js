'use strict'

const Lab = require('lab')
const sinon = require('sinon')
const rabbitmq = require('../../lib/rabbitmq.js')
const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.describe
const it = lab.it

describe('rabbitmq.js unit test', () => {
  describe('createPublishJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishTask')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishTask.restore()
      done()
    })

    it('should publish job', (done) => {
      const testData = { some: 'data' }
      rabbitmq.createPublishJob(testData)
      sinon.assert.calledOnce(rabbitmq.publishTask)
      sinon.assert.calledWith(rabbitmq.publishTask, 'docker.event.publish', testData)
      done()
    })
  }) // end createPublishJob

  describe('createConnectedJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishEvent')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishEvent.restore()
      done()
    })

    it('should publish job', (done) => {
      rabbitmq.createConnectedJob('swarm', 'host', 'org')
      sinon.assert.calledOnce(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'swarm.events-stream.connected', {
        host: 'http://host',
        org: 'org'
      })
      done()
    })
  }) // end createConnectedJob

  describe('createDisconnectedJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishEvent')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishEvent.restore()
      done()
    })

    it('should publish job', (done) => {
      rabbitmq.createDisconnectedJob('host', 'org')
      sinon.assert.calledOnce(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'docker.events-stream.disconnected', {
        host: 'http://host',
        org: 'org'
      })
      done()
    })
  }) // end createDisconnectedJob

  describe('createStreamConnectJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishTask')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishTask.restore()
      done()
    })

    it('should publish job', (done) => {
      rabbitmq.createStreamConnectJob('type', 'host', 'org')
      sinon.assert.calledOnce(rabbitmq.publishTask)
      sinon.assert.calledWith(rabbitmq.publishTask, 'type.events-stream.connect', {
        host: 'host',
        org: 'org'
      })
      done()
    })
  }) // end createStreamConnectJob
}) // end rabbitmq.js unit test
