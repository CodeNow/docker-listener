'use strict'

require('loadenv')()

const Promise = require('bluebird')
const errorCat = require('error-cat')
const Lab = require('lab')
const sinon = require('sinon')
require('sinon-as-promised')(Promise)
const BaseDockerClient = require('@runnable/loki')._BaseClient
const SwarmClient = require('@runnable/loki').Swarm

const Swarm = require('../../lib/swarm')
const dockerUtils = require('../../lib/docker-utils')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const it = lab.test

describe('swarm unit test', () => {
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
            state: ['running']
          }
        })
        sinon.assert.calledOnce(BaseDockerClient.prototype.topContainerAsync)
        sinon.assert.calledWith(BaseDockerClient.prototype.topContainerAsync, testId)
        sinon.assert.notCalled(errorCat.report)
        done()
      })
    })
  }) // end testEvent
})
