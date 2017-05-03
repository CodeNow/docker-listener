'use strict'
require('loadenv')()

const clone = require('101/clone')
const Code = require('code')
const DockerClient = require('@runnable/loki')._BaseClient
const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')
const Swarm = require('@runnable/loki').Swarm

const ContainerStatePoll = require('../../../lib/workers/container.state.poll.js').task
const dockerUtils = require('../../../lib/docker-utils')
const rabbitmq = require('../../../lib/rabbitmq')

const lab = exports.lab = Lab.script()
require('sinon-as-promised')(Promise)

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
    host: 'http://10.0.0.1:4242',
    githubOrgId: 1111
  }

  describe('worker', () => {
    beforeEach((done) => {
      sinon.stub(Swarm.prototype, 'swarmHostExistsAsync').resolves(true)
      sinon.stub(DockerClient.prototype, 'inspectContainerAsync')
      sinon.stub(dockerUtils, 'handleInspectError')
      sinon.stub(rabbitmq, 'publishEvent')
      done()
    })

    afterEach((done) => {
      Swarm.prototype.swarmHostExistsAsync.restore()
      DockerClient.prototype.inspectContainerAsync.restore()
      dockerUtils.handleInspectError.restore()
      rabbitmq.publishEvent.restore()
      done()
    })

    it('should not call inspect or publish', (done) => {
      Swarm.prototype.swarmHostExistsAsync.resolves(false)
      DockerClient.prototype.inspectContainerAsync.resolves(testInspectData)
      ContainerStatePoll(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.notCalled(DockerClient.prototype.inspectContainerAsync)
        sinon.assert.notCalled(rabbitmq.publishEvent)
        done()
      })
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
        sinon.assert.calledOnce(dockerUtils.handleInspectError)
        sinon.assert.calledWith(dockerUtils.handleInspectError, testJob.host, testJob.githubOrgId, testError, sinon.match.object)
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
