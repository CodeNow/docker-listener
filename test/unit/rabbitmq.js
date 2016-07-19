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
  describe('publish', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishToQueue')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishToQueue.restore()
      done()
    })

    it('should publish job', (done) => {
      const testData = { some: 'data' }
      rabbitmq.publish('thename', testData)
      sinon.assert.calledOnce(rabbitmq.publishToQueue)
      sinon.assert.calledWith(rabbitmq.publishToQueue, 'thename', testData)
      done()
    })
  }) // end publish

  describe('createPublishJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishToQueue')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishToQueue.restore()
      done()
    })

    it('should publish job', (done) => {
      const testData = { some: 'data' }
      rabbitmq.createPublishJob(testData)
      sinon.assert.calledOnce(rabbitmq.publishToQueue)
      sinon.assert.calledWith(rabbitmq.publishToQueue, 'docker.event.publish', testData)
      done()
    })
  }) // end createPublishJob

  describe('createConnectedJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishToQueue')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishToQueue.restore()
      done()
    })

    it('should publish job', (done) => {
      rabbitmq.createConnectedJob('type', 'host', 'org')
      sinon.assert.calledOnce(rabbitmq.publishToQueue)
      sinon.assert.calledWith(rabbitmq.publishToQueue, 'type.events-stream.connected', {
        host: 'http://host',
        org: 'org',
        tags: 'org'
      })
      done()
    })
  }) // end createConnectedJob

  describe('createDisconnectedJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishToQueue')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishToQueue.restore()
      done()
    })

    it('should publish job', (done) => {
      rabbitmq.createDisconnectedJob('host', 'org')
      sinon.assert.calledOnce(rabbitmq.publishToQueue)
      sinon.assert.calledWith(rabbitmq.publishToQueue, 'docker.events-stream.disconnected', {
        host: 'http://host',
        org: 'org'
      })
      done()
    })
  }) // end createDisconnectedJob

  describe('createStreamConnectJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishToQueue')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishToQueue.restore()
      done()
    })

    it('should publish job', (done) => {
      rabbitmq.createStreamConnectJob('type', 'host', 'org')
      sinon.assert.calledOnce(rabbitmq.publishToQueue)
      sinon.assert.calledWith(rabbitmq.publishToQueue, 'type.events-stream.connect', {
        host: 'host',
        org: 'org'
      })
      done()
    })
  }) // end createStreamConnectJob
}) // end rabbitmq.js unit test
