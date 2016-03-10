'use strict'
require('loadenv')()

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
  describe('close', () => {
    it('should do nothing if it was not connected', (done) => {
      sinon.stub(Hermes.prototype, 'close').yields(null)
      rabbitmq.close((err) => {
        expect(err).to.not.exist()
        expect(Hermes.prototype.close.called).to.be.false()
        Hermes.prototype.close.restore()
        done()
      })
    })

    it('should call hermes close', (done) => {
      sinon.stub(Hermes.prototype, 'connect').yields(null)
      sinon.stub(Hermes.prototype, 'close').yields(null)
      rabbitmq.connect((err) => {
        expect(err).to.not.exist()
        expect(Hermes.prototype.connect.callCount).to.equal(3)
        Hermes.prototype.connect.restore()
        rabbitmq.close((err) => {
          expect(err).to.be.null()
          expect(Hermes.prototype.close.callCount).to.equal(3)
          Hermes.prototype.close.restore()
          done()
        })
      })
    })

    it('should fail if hermes close failed', (done) => {
      sinon.stub(Hermes.prototype, 'connect').yields(null)
      sinon.stub(Hermes.prototype, 'close').yields(new Error('Hermes error'))
      rabbitmq.connect((err) => {
        expect(err).to.be.null()
        expect(Hermes.prototype.connect.callCount).to.equal(3)
        Hermes.prototype.connect.restore()
        rabbitmq.close((err) => {
          expect(err).to.exist()
          expect(err.message).to.equal('Hermes error')
          expect(Hermes.prototype.close.calledOnce).to.be.true()
          Hermes.prototype.close.restore()
          done()
        })
      })
    })
  })

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

  describe('publish', function () {
    beforeEach(function (done) {
      rabbitmq.publisher = {
        publish: sinon.stub()
      }
      done()
    })

    it('should publish job', function (done) {
      var testData = { some: 'data' }
      rabbitmq.publish('thename', testData)
      sinon.assert.calledOnce(rabbitmq.publisher.publish)
      sinon.assert.calledWith(rabbitmq.publisher.publish, 'thename', testData)
      done()
    })
  }) // end publish

  describe('createPublishJob', function () {
    beforeEach(function (done) {
      sinon.stub(rabbitmq, 'publish')
      done()
    })

    afterEach(function (done) {
      rabbitmq.publish.restore()
      done()
    })

    it('should publish job', function (done) {
      var testData = { some: 'data' }
      rabbitmq.createPublishJob(testData)
      sinon.assert.calledOnce(rabbitmq.publish)
      sinon.assert.calledWith(rabbitmq.publish, 'docker.event.publish', testData)
      done()
    })
  }) // end createPublishJob

  describe('createConnectedJob', function () {
    beforeEach(function (done) {
      sinon.stub(rabbitmq, 'publish')
      done()
    })

    afterEach(function (done) {
      rabbitmq.publish.restore()
      done()
    })

    it('should publish job', function (done) {
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

  describe('createStreamConnectJob', function () {
    beforeEach(function (done) {
      sinon.stub(rabbitmq, 'publish')
      done()
    })

    afterEach(function (done) {
      rabbitmq.publish.restore()
      done()
    })

    it('should publish job', function (done) {
      rabbitmq.createStreamConnectJob('type', 'host', 'org')
      sinon.assert.calledOnce(rabbitmq.publish)
      sinon.assert.calledWith(rabbitmq.publish, 'type.events-stream.connect', {
        host: 'host',
        org: 'org'
      })
      done()
    })
  }) // end createStreamConnectJob

  describe('_handleFatalError', function () {
    beforeEach(function (done) {
      sinon.stub(ErrorCat.prototype, 'createAndReport')
      done()
    })

    afterEach(function (done) {
      ErrorCat.prototype.createAndReport.restore()
      done()
    })

    it('should throw error', function (done) {
      expect(() => {
        rabbitmq._handleFatalError('err')
      }).to.throw()
      sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
      sinon.assert.calledWith(ErrorCat.prototype.createAndReport, 502, 'RabbitMQ error', 'err')
      done()
    })
  }) // end _handleFatalError
}) // end rabbitmq.js unit test
