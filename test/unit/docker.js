'use strict'

require('loadenv')()

const Promise = require('bluebird')
const errorCat = require('error-cat')
const Lab = require('lab')
const sinon = require('sinon')
require('sinon-as-promised')(Promise)
const BaseDockerClient = require('loki')._BaseClient
const DockerClient = require('loki').Docker

const Docker = require('../../lib/docker')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const it = lab.test

describe('docker unit test', () => {
  let docker
  const testHost = '10.0.0.1:4242'

  beforeEach((done) => {
    docker = new Docker(testHost)
    done()
  })

  describe('testEvent', () => {
    beforeEach((done) => {
      sinon.stub(DockerClient.prototype, 'listContainersAsync')
      sinon.stub(BaseDockerClient.prototype, 'topContainerAsync').resolves({})
      sinon.stub(errorCat, 'report')
      done()
    })

    afterEach((done) => {
      DockerClient.prototype.listContainersAsync.restore()
      BaseDockerClient.prototype.topContainerAsync.restore()
      errorCat.report.restore()
      done()
    })

    it('should ignore error on list fail', (done) => {
      const testErr = new Error('calamitous')
      DockerClient.prototype.listContainersAsync.rejects(testErr)
      docker.testEvent().asCallback(done)
    })

    it('should ignore error on empty containers', (done) => {
      DockerClient.prototype.listContainersAsync.resolves([])
      docker.testEvent().asCallback(done)
    })

    it('should ignore error top fail', (done) => {
      const testErr = new Error('grievous')
      DockerClient.prototype.listContainersAsync.resolves([{Id: 1}])
      BaseDockerClient.prototype.topContainerAsync.rejects(testErr)
      docker.testEvent().asCallback(done)
    })

    it('should call docker with correct opts', (done) => {
      const testId = 'heinous'
      DockerClient.prototype.listContainersAsync.resolves([{Id: testId}])
      docker.testEvent().asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerClient.prototype.listContainersAsync)
        sinon.assert.calledWith(DockerClient.prototype.listContainersAsync, {
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
}) // end testEvent
