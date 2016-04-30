'use strict'

require('loadenv')()

const Promise = require('bluebird')
const errorCat = require('error-cat')
const Lab = require('lab')
const sinon = require('sinon')
require('sinon-as-promised')(Promise)
const DockerClient = require('loki')._BaseClient

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
      sinon.stub(docker.client, 'listContainersAsync')
      sinon.stub(DockerClient.prototype, 'topContainer').resolves({})
      sinon.stub(errorCat, 'report')
      done()
    })

    afterEach((done) => {
      DockerClient.prototype.topContainer.restore()
      errorCat.report.restore()
      done()
    })

    it('should ignore error on list fail', (done) => {
      const testErr = new Error('calamitous')
      docker.client.listContainersAsync.rejects(testErr)
      docker.testEvent().asCallback(done)
    })

    it('should ignore error on empty containers', (done) => {
      docker.client.listContainersAsync.resolves([])
      docker.testEvent().asCallback(done)
    })

    it('should ignore error top fail', (done) => {
      const testErr = new Error('grievous')
      docker.client.listContainersAsync.resolves([{Id: 1}])
      DockerClient.prototype.topContainer.rejects(testErr)
      docker.testEvent().asCallback(done)
    })

    it('should call docker with correct opts', (done) => {
      const testId = 'heinous'
      docker.client.listContainersAsync.resolves([{Id: testId}])
      docker.testEvent().asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(docker.client.listContainersAsync)
        sinon.assert.calledWith(docker.client.listContainersAsync, {
          filters: {
            state: ['running']
          }
        })
        sinon.assert.calledOnce(Docker.prototype.topContainer)
        sinon.assert.calledWith(Docker.prototype.topContainer, testId)
        sinon.assert.notCalled(errorCat.report)
        done()
      })
    })
  }) // end testEvent

  describe('getEvents', () => {
    beforeEach((done) => {
      sinon.stub(docker.client, 'getEventsAsync')
      done()
    })

    it('should get docker event', (done) => {
      const testOpts = { since: 1000 }
      docker.client.getEventsAsync.resolves([])
      docker.getEvents(testOpts).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(docker.client.getEventsAsync)
        sinon.assert.calledWith(docker.client.getEventsAsync, testOpts)
        done()
      })
    })
  }) // end getEvents
}) // end testEvent
