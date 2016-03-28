'use strict'

const Code = require('code')
const ErrorCat = require('error-cat')
const Lab = require('lab')
const sinon = require('sinon')

const Hermes = require('runnable-hermes')
const rabbitmq = require('../../lib/rabbitmq.js')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.describe
const expect = Code.expect
const it = lab.it

describe('rabbitmq.js unit test', () => {
  describe('connect', () => {
    it('should call hermes connect', (done) => {
      sinon.stub(Hermes.prototype, 'connect').yields(null)
      rabbitmq.connect((err) => {
        expect(err).to.not.exist()
        expect(Hermes.prototype.connect.callCount).to.equal(3)
        Hermes.prototype.connect.restore()
        done()
      })
    })

    it('should fail if hermes connect failed', (done) => {
      sinon.stub(Hermes.prototype, 'connect').yields(new Error('Hermes error'))
      rabbitmq.connect((err) => {
        expect(err).to.exist()
        expect(err.message).to.equal('Hermes error')
        Hermes.prototype.connect.restore()
        done()
      })
    })
  })

  describe('on error', () => {
    it('should call _handleFatalError', (done) => {
      sinon.stub(Hermes.prototype, 'connect').yields(null)
      rabbitmq.connect((err) => {
        if (err) {
          return done(err)
        }
        expect(() => {
          rabbitmq.rabbit.emit('error')
        }).to.throw()
        done()
      })
    })
  })

  describe('publish', () => {
    beforeEach((done) => {
      rabbitmq.publisher = {
        publish: sinon.stub()
      }
      done()
    })

    it('should publish job', (done) => {
      const testData = { some: 'data' }
      rabbitmq.publish('thename', testData)
      sinon.assert.calledOnce(rabbitmq.publisher.publish)
      sinon.assert.calledWith(rabbitmq.publisher.publish, 'thename', testData)
      done()
    })
  }) // end publish

  describe('createPublishJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publish')
      done()
    })

    afterEach((done) => {
      rabbitmq.publish.restore()
      done()
    })

    it('should publish job', (done) => {
      const testData = { some: 'data' }
      rabbitmq.createPublishJob(testData)
      sinon.assert.calledOnce(rabbitmq.publish)
      sinon.assert.calledWith(rabbitmq.publish, 'docker.event.publish', testData)
      done()
    })
  }) // end createPublishJob

  describe('createConnectedJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publish')
      done()
    })

    afterEach((done) => {
      rabbitmq.publish.restore()
      done()
    })

    it('should publish job', (done) => {
      rabbitmq.createConnectedJob('type', 'host', 'org')
      sinon.assert.calledOnce(rabbitmq.publish)
      sinon.assert.calledWith(rabbitmq.publish, 'type.events-stream.connected', {
        host: 'http://host',
        org: 'org',
        tags: 'org'
      })
      done()
    })
  }) // end createConnectedJob

  describe('createDisconnectedJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publish')
      done()
    })

    afterEach((done) => {
      rabbitmq.publish.restore()
      done()
    })

    it('should publish job', (done) => {
      rabbitmq.createDisconnectedJob('host', 'org')
      sinon.assert.calledOnce(rabbitmq.publish)
      sinon.assert.calledWith(rabbitmq.publish, 'docker.events-stream.disconnected', {
        host: 'http://host',
        org: 'org'
      })
      done()
    })
  }) // end createDisconnectedJob

  describe('createStreamConnectJob', () => {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publish')
      done()
    })

    afterEach((done) => {
      rabbitmq.publish.restore()
      done()
    })

    it('should publish job', (done) => {
      rabbitmq.createStreamConnectJob('type', 'host', 'org')
      sinon.assert.calledOnce(rabbitmq.publish)
      sinon.assert.calledWith(rabbitmq.publish, 'type.events-stream.connect', {
        host: 'host',
        org: 'org'
      })
      done()
    })
  }) // end createStreamConnectJob

  describe('_handleFatalError', () => {
    beforeEach((done) => {
      sinon.stub(ErrorCat.prototype, 'createAndReport')
      done()
    })

    afterEach((done) => {
      ErrorCat.prototype.createAndReport.restore()
      done()
    })

    it('should throw error', (done) => {
      expect(() => {
        rabbitmq._handleFatalError('err')
      }).to.throw()
      sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
      sinon.assert.calledWith(ErrorCat.prototype.createAndReport, 502, 'RabbitMQ error', 'err')
      done()
    })
  }) // end _handleFatalError
}) // end rabbitmq.js unit test
