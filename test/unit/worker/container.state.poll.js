'use strict'
require('loadenv')()

const Code = require('code')
const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')
require('sinon-as-promised')(Promise)

const clone = require('101/clone')
const DockerClient = require('@runnable/loki')._BaseClient
const ContainerStatePoll = require('../../../lib/workers/container.state.poll.js').task
const rabbitmq = require('../../../lib/rabbitmq')
const dockerUtils = require('../../../lib/docker-utils')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const expect = Code.expect
const it = lab.test

describe('docker container poll', () => {
  const testInspectData = {
    Config: {
      Labels: {
        type: 'user-container'
      }
    }
  }
  const testJob = {
    id: 'some-container-id',
    host: 'http://10.0.0.1:4242'
  }
  describe('worker', () => {
    beforeEach((done) => {
      sinon.stub(DockerClient.prototype, 'inspectContainerAsync')
      sinon.stub(dockerUtils, '_handleInspectError')
      sinon.stub(rabbitmq, 'publishEvent')
      done()
    })

    afterEach((done) => {
      DockerClient.prototype.inspectContainerAsync.restore()
      dockerUtils._handleInspectError.restore()
      rabbitmq.publishEvent.restore()
      done()
    })

    it('should call inspect', (done) => {
      DockerClient.prototype.inspectContainerAsync.resolves(testInspectData)
      ContainerStatePoll(testJob).asCallback((err) => {
        if (err) { return done(err) }
        expect(testJob.inspectData).to.equal(testInspectData)
        sinon.assert.calledOnce(DockerClient.prototype.inspectContainerAsync)
        sinon.assert.calledWith(DockerClient.prototype.inspectContainerAsync, testJob.id)
        done()
      })
    })

    it('should handle inspect error', function (done) {
      const testError = new Error('baaam')
      DockerClient.prototype.inspectContainerAsync.rejects(testError)
      ContainerStatePoll(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(dockerUtils._handleInspectError)
        sinon.assert.calledWith(dockerUtils._handleInspectError, testJob.Host, testError, sinon.match.object)
        done()
      })
    })

    it('should call publish for event', function (done) {
      const newJob = clone(testJob)
      newJob.inspectData = testInspectData
      DockerClient.prototype.inspectContainerAsync.resolves(testInspectData)
      ContainerStatePoll(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(rabbitmq.publishEvent)
        sinon.assert.calledWithMatch(rabbitmq.publishEvent, 'container.state.polled', newJob)
        done()
      })
    })
  }) // end worker
})
