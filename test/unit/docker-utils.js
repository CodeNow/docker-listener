'use strict'

require('loadenv')()

const Promise = require('bluebird')
const errorCat = require('error-cat')
const Code = require('code')
const Lab = require('lab')
const sinon = require('sinon')
require('sinon-as-promised')(Promise)
const BaseDockerClient = require('@runnable/loki')._BaseClient
const SwarmClient = require('@runnable/loki').Swarm
const WorkerStopError = require('error-cat/errors/worker-stop-error')

const dockerUtils = require('../../lib/docker-utils')
const rabbitmq = require('../../lib/rabbitmq')
const Swarm = require('../../lib/swarm')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const it = lab.test
const expect = Code.expect

describe('docker utils unit test', () => {
  let docker
  const testHost = '10.0.0.1:4242'

  beforeEach((done) => {
    docker = new Swarm(testHost)
    done()
  })

  describe('testEvent', () => {
    beforeEach((done) => {
      sinon.stub(SwarmClient.prototype, 'listContainersAsync')
      sinon.stub(BaseDockerClient.prototype, 'topContainerAsync').resolves({})
      sinon.stub(errorCat, 'report')
      done()
    })

    afterEach((done) => {
      SwarmClient.prototype.listContainersAsync.restore()
      BaseDockerClient.prototype.topContainerAsync.restore()
      errorCat.report.restore()
      done()
    })

    it('should ignore error on list fail', (done) => {
      const testErr = new Error('calamitous')
      SwarmClient.prototype.listContainersAsync.rejects(testErr)
      dockerUtils.testEvent(docker).asCallback(done)
    })

    it('should ignore error on empty containers', (done) => {
      SwarmClient.prototype.listContainersAsync.resolves([])
      dockerUtils.testEvent(docker).asCallback(done)
    })

    it('should ignore error top fail', (done) => {
      const testErr = new Error('grievous')
      SwarmClient.prototype.listContainersAsync.resolves([{Id: 1}])
      BaseDockerClient.prototype.topContainerAsync.rejects(testErr)
      dockerUtils.testEvent(docker).asCallback(done)
    })

    it('should call docker with correct opts', (done) => {
      const testId = 'heinous'
      SwarmClient.prototype.listContainersAsync.resolves([{Id: testId}])
      dockerUtils.testEvent(docker).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(SwarmClient.prototype.listContainersAsync)
        sinon.assert.calledWith(SwarmClient.prototype.listContainersAsync, {
          filters: {
            status: ['running']
          }
        })
        sinon.assert.calledOnce(BaseDockerClient.prototype.topContainerAsync)
        sinon.assert.calledWith(BaseDockerClient.prototype.topContainerAsync, testId)
        sinon.assert.notCalled(errorCat.report)
        done()
      })
    })
  }) // end testEvent

  describe('handleInspectError', function () {
    const logStub = {
      error: sinon.spy(),
      info: sinon.spy(),
      trace: sinon.spy()
    }
    beforeEach((done) => {
      sinon.stub(Swarm.prototype, 'swarmHostExistsAsync')
      sinon.stub(rabbitmq, 'publishEvent').returns()
      done()
    })

    afterEach((done) => {
      Swarm.prototype.swarmHostExistsAsync.restore()
      rabbitmq.publishEvent.restore()
      done()
    })

    it('should fail fatally if 404 error', (done) => {
      const error = new Error('Docker error')
      error.statusCode = 404
      expect(() => {
        dockerUtils.handleInspectError('test', null, error, logStub)
      }).to.throw(WorkerStopError, 'Docker error')
      done()
    })

    it('should throw original error if check host failed', (done) => {
      const testErr = new Error('bully')
      testErr.statusCode = 500
      Swarm.prototype.swarmHostExistsAsync.returns(Promise.reject('reject'))
      dockerUtils.handleInspectError('host', null, testErr, logStub).asCallback((err) => {
        expect(err).to.equal(testErr)
        done()
      })
    })

    it('should throw original error if host exists', (done) => {
      const testErr = new Error('ruffian')
      Swarm.prototype.swarmHostExistsAsync.returns(Promise.resolve(true))
      dockerUtils.handleInspectError('host', null, testErr, logStub).asCallback((err) => {
        expect(err).to.equal(testErr)
        sinon.assert.notCalled(rabbitmq.publishEvent)
        done()
      })
    })

    it('should throw WorkerStopError error if host !exists', (done) => {
      const testErr = new Error('hooligan')
      Swarm.prototype.swarmHostExistsAsync.returns(Promise.resolve(false))
      dockerUtils.handleInspectError('host', 123, testErr, logStub).asCallback((err) => {
        expect(err).to.be.an.instanceOf(WorkerStopError)
        sinon.assert.calledOnce(rabbitmq.publishEvent)
        sinon.assert.calledWith(rabbitmq.publishEvent, 'dock.lost', {
          host: 'http://host',
          githubOrgId: 123
        })
        done()
      })
    })
  })
})
