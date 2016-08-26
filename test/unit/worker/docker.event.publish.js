'use strict'
require('loadenv')()

const Code = require('code')
const defaults = require('101/defaults')
const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')

const DockerClient = require('@runnable/loki')._BaseClient
const DockerEventPublish = require('../../../lib/workers/docker.event.publish.js').task
const rabbitmq = require('../../../lib/rabbitmq')
const sinceMap = require('../../../lib/since-map')
const dockerUtils = require('../../../lib/docker-utils')

const lab = exports.lab = Lab.script()

const eventMock = (opts) => {
  return defaults(opts, {
    dockerPort: '4242',
    dockerUrl: 'http://10.0.0.1:4242',
    from: 'ubuntu',
    host: 'http://10.0.0.1:4242',
    Host: '10.0.0.1:4242',
    id: 'id',
    ip: '10.0.0.1',
    org: '123456789',
    status: 'start',
    tags: '123456789',
    time: 123456789,
    uuid: '1234-1234-1234',
    needsInspect: false
  })
}

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const expect = Code.expect
const it = lab.test

describe('docker event publish', () => {
  describe('_isUserContainer', () => {
    it('should return true if user container', (done) => {
      const data = {
        inspectData: {
          Config: {
            Labels: {
              type: 'user-container'
            }
          }
        }
      }
      expect(DockerEventPublish._isUserContainer(data)).to.be.true()
      done()
    })

    it('should return false if not user container', (done) => {
      const data = {
        inspectData: {
          Config: {
            Labels: {
              type: 'image-builder-container'
            }
          }
        }
      }
      expect(DockerEventPublish._isUserContainer(data)).to.be.false()
      done()
    })
  })

  describe('_isBuildContainer', () => {
    it('should return true if user container', (done) => {
      const data = {
        inspectData: {
          Config: {
            Labels: {
              type: 'image-builder-container'
            }
          }
        }
      }
      expect(DockerEventPublish._isBuildContainer(data)).to.be.true()
      done()
    })

    it('should return false if not user container', (done) => {
      const data = {
        inspectData: {
          Config: {
            Labels: {
              type: 'user-container'
            }
          }
        }
      }
      expect(DockerEventPublish._isBuildContainer(data)).to.be.false()
      done()
    })
  })

  describe('worker', () => {
    beforeEach((done) => {
      sinon.stub(DockerClient.prototype, 'inspectContainerAsync')
      sinon.stub(dockerUtils, '_handleInspectError')
      sinon.stub(DockerEventPublish, '_handlePublish')
      sinon.stub(sinceMap, 'set')
      done()
    })

    afterEach((done) => {
      DockerClient.prototype.inspectContainerAsync.restore()
      dockerUtils._handleInspectError.restore()
      DockerEventPublish._handlePublish.restore()
      sinceMap.set.restore()
      done()
    })

    it('should set sinceMap', (done) => {
      const testJob = eventMock()
      DockerClient.prototype.inspectContainerAsync.returns(Promise.resolve())
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }

        sinon.assert.calledOnce(sinceMap.set)
        sinon.assert.calledWith(sinceMap.set, testJob.Host, testJob.time)
        done()
      })
    })

    it('should not call inspect when needsInspect false', (done) => {
      const testJob = eventMock({
        needsInspect: false
      })
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }

        sinon.assert.notCalled(DockerClient.prototype.inspectContainerAsync)
        done()
      })
    })

    it('should call inspect when needsInspect true', (done) => {
      const testJob = eventMock({
        needsInspect: true
      })
      const testInspect = { cool: 'gear' }
      DockerClient.prototype.inspectContainerAsync.returns(Promise.resolve(testInspect))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        expect(testJob.inspectData).to.equal(testInspect)
        sinon.assert.calledOnce(DockerClient.prototype.inspectContainerAsync)
        sinon.assert.calledWith(DockerClient.prototype.inspectContainerAsync, testJob.id)
        done()
      })
    })

    it('should handle inspect error', function (done) {
      const testJob = eventMock({
        needsInspect: true
      })
      const testError = new Error('baaam')
      DockerClient.prototype.inspectContainerAsync.returns(Promise.reject(testError))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }

        sinon.assert.calledOnce(dockerUtils._handleInspectError)
        sinon.assert.calledWith(dockerUtils._handleInspectError, testJob.host, testError, sinon.match.object)
        done()
      })
    })

    it('should call publish for event', function (done) {
      const testJob = eventMock()
      DockerClient.prototype.inspectContainerAsync.returns(Promise.resolve())
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }

        sinon.assert.calledOnce(DockerEventPublish._handlePublish)
        sinon.assert.calledWith(DockerEventPublish._handlePublish, testJob, sinon.match.object)
        done()
      })
    })
  }) // end worker

  describe('_handlePublish', function () {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishEvent')
      sinon.stub(rabbitmq, 'publishTask')
      sinon.stub(rabbitmq, 'createStreamConnectJob')
      sinon.stub(DockerEventPublish, '_isUserContainer')
      sinon.stub(DockerEventPublish, '_isBuildContainer')
      sinon.stub(sinceMap, 'set')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishEvent.restore()
      rabbitmq.publishTask.restore()
      rabbitmq.createStreamConnectJob.restore()
      DockerEventPublish._isUserContainer.restore()
      DockerEventPublish._isBuildContainer.restore()
      sinceMap.set.restore()
      done()
    })

    it('should publish on-instance-container-create', (done) => {
      const payload = {
        status: 'create',
        data: 'big'
      }
      DockerEventPublish._isUserContainer.returns(true)

      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(rabbitmq.publishTask)
      sinon.assert.calledWith(rabbitmq.publishTask, 'on-instance-container-create', payload)
      done()
    })

    it('should publish on-image-builder-container-create', (done) => {
      const payload = {
        status: 'create',
        data: 'big'
      }
      DockerEventPublish._isUserContainer.returns(false)
      DockerEventPublish._isBuildContainer.returns(true)

      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(rabbitmq.publishTask)
      sinon.assert.calledWith(rabbitmq.publishTask, 'on-image-builder-container-create', payload)
      done()
    })

    it('should publish nothing', (done) => {
      const payload = {
        status: 'create'
      }
      DockerEventPublish._isUserContainer.returns(false)
      DockerEventPublish._isBuildContainer.returns(false)

      DockerEventPublish._handlePublish(payload)

      sinon.assert.notCalled(rabbitmq.publishEvent)
      sinon.assert.notCalled(rabbitmq.publishTask)
      sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
      done()
    })

    it('should publish container.life-cycle.started', (done) => {
      const payload = {
        status: 'start',
        data: 'big'
      }
      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'container.life-cycle.started', payload)
      done()
    })

    it('should publish on-instance-container-die and container.life-cycle.died', (done) => {
      const payload = {
        status: 'die',
        data: 'big'
      }
      DockerEventPublish._isUserContainer.returns(true)

      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(rabbitmq.publishTask)
      sinon.assert.calledWith(rabbitmq.publishTask, 'on-instance-container-die', payload)
      sinon.assert.calledOnce(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'container.life-cycle.died', payload)
      done()
    })

    it('should publish on-image-builder-container-die and container.life-cycle.died', (done) => {
      const payload = {
        status: 'die',
        data: 'big'
      }
      DockerEventPublish._isUserContainer.returns(false)
      DockerEventPublish._isBuildContainer.returns(true)

      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(rabbitmq.publishTask)
      sinon.assert.calledWith(rabbitmq.publishTask, 'on-image-builder-container-die', payload)
      sinon.assert.calledOnce(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'container.life-cycle.died', payload)
      done()
    })

    it('should publish container.life-cycle.died', (done) => {
      const payload = {
        status: 'die',
        data: 'big'
      }
      DockerEventPublish._isUserContainer.returns(false)
      DockerEventPublish._isBuildContainer.returns(false)

      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'container.life-cycle.died', payload)
      done()
    })

    it('should call createStreamConnectJob', (done) => {
      const payload = {
        status: 'engine_connect',
        Host: '10.0.0.1:4242',
        org: '123456'
      }

      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(rabbitmq.createStreamConnectJob)
      sinon.assert.calledWith(rabbitmq.createStreamConnectJob, 'docker', payload.Host, payload.org)
      done()
    })

    it('should log error for unknown', (done) => {
      const payload = {
        status: 'fake'
      }
      const logStub = {
        error: sinon.stub()
      }
      DockerEventPublish._handlePublish(payload, logStub)

      sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
      sinon.assert.notCalled(rabbitmq.publishTask)
      sinon.assert.notCalled(rabbitmq.publishEvent)
      sinon.assert.calledOnce(logStub.error)
      done()
    })
  })
})
