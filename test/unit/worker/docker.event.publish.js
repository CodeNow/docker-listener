'use strict'
require('loadenv')()
const Code = require('code')
const defaults = require('101/defaults')
const keypather = require('keypather')()
const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')

require('sinon-as-promised')(Promise)

const DockerClient = require('@runnable/loki')._BaseClient
const RootDockerClient = require('@runnable/loki').Docker
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
  describe('worker', () => {
    let inspectMock = sinon.stub()
    beforeEach((done) => {
      sinon.stub(DockerClient.prototype, 'inspectContainerAsync')
      sinon.stub(RootDockerClient.prototype, 'getImage').returns({
        inspect: inspectMock
      })
      sinon.stub(dockerUtils, 'handleInspectError')
      sinon.stub(DockerEventPublish, '_handlePublish')
      sinon.stub(sinceMap, 'set')
      done()
    })

    afterEach((done) => {
      DockerClient.prototype.inspectContainerAsync.restore()
      RootDockerClient.prototype.getImage.restore()
      dockerUtils.handleInspectError.restore()
      DockerEventPublish._handlePublish.restore()
      sinceMap.set.restore()
      done()
    })

    it('should set sinceMap', (done) => {
      const testJob = eventMock()
      DockerClient.prototype.inspectContainerAsync.resolves()
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
      const testInspect = { Id: 'gear' }
      DockerClient.prototype.inspectContainerAsync.resolves(testInspect)
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerClient.prototype.inspectContainerAsync)
        sinon.assert.calledWith(DockerClient.prototype.inspectContainerAsync, testJob.id)
        sinon.assert.calledOnce(DockerEventPublish._handlePublish)
        sinon.assert.calledWith(DockerEventPublish._handlePublish, sinon.match.has('inspectData'))
        done()
      })
    })

    it('should call image inspect when needsInspect true', (done) => {
      const testJob = eventMock({
        needsInspect: true,
        status: 'die'
      })
      const testInspect = { Id: 'gear' }

      keypather.set(testJob, 'Actor.Attributes.type', 'image-builder-container')
      keypather.set(testJob, 'Actor.Attributes.exitCode', '0')
      DockerClient.prototype.inspectContainerAsync.resolves()
      inspectMock.yieldsAsync(testInspect)

      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(inspectMock)
        sinon.assert.calledOnce(RootDockerClient.prototype.getImage)
        sinon.assert.calledWith(RootDockerClient.prototype.getImage, testJob.Actor.Attributes.dockerTag)
        sinon.assert.calledOnce(DockerEventPublish._handlePublish)
        sinon.assert.calledWith(DockerEventPublish._handlePublish, sinon.match.has('inspectImageData'))
        done()
      })
    })

    it('should not call image inspect when non-zero exit', (done) => {
      const testJob = eventMock({
        needsInspect: true,
        status: 'die'
      })
      const testInspect = { Id: 'gear' }

      keypather.set(testJob, 'Actor.Attributes.type', 'image-builder-container')
      keypather.set(testJob, 'Actor.Attributes.exitCode', '128')
      DockerClient.prototype.inspectContainerAsync.resolves()
      inspectMock.yieldsAsync(testInspect)

      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(inspectMock)
        sinon.assert.notCalled(RootDockerClient.prototype.getImage)
        done()
      })
    })

    it('should not call image inspect when not a die', (done) => {
      const testJob = eventMock({
        needsInspect: true,
        status: 'start'
      })
      const testInspect = { Id: 'gear' }

      keypather.set(testJob, 'Actor.Attributes.type', 'image-builder-container')
      keypather.set(testJob, 'State.ExitCode', 207)
      DockerClient.prototype.inspectContainerAsync.resolves()
      inspectMock.yieldsAsync(testInspect)

      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(inspectMock)
        sinon.assert.notCalled(RootDockerClient.prototype.getImage)
        done()
      })
    })

    it('should use tid from Labels if exists', (done) => {
      const testJob = eventMock({
        needsInspect: true
      })
      const testTid = 'mediocre-tid'
      const testInspect = {
        Id: 'gear',
        Config: {
          Labels: {
            tid: testTid
          }
        }
      }
      DockerClient.prototype.inspectContainerAsync.resolves(testInspect)
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerEventPublish._handlePublish)
        sinon.assert.calledWith(DockerEventPublish._handlePublish, sinon.match.has('tid', testTid))
        done()
      })
    })

    it('should not use tid from Labels if does not exist', (done) => {
      const testJob = eventMock({
        needsInspect: true
      })
      const testInspect = {
        Id: 'gear',
        Config: {
          Labels: {}
        }
      }
      DockerClient.prototype.inspectContainerAsync.resolves(testInspect)
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerEventPublish._handlePublish)
        sinon.assert.calledWith(DockerEventPublish._handlePublish, sinon.match((value) => {
          return !value.tid
        }, 'tid exists'))
        done()
      })
    })

    it('should strip inspect data', (done) => {
      const testJob = eventMock({
        needsInspect: true
      })
      const testInspect = require('../../fixtures/inspect-data.js')
      testInspect.Config.Env.push('runnable_test=hello')
      DockerClient.prototype.inspectContainerAsync.resolves(testInspect)
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerEventPublish._handlePublish)
        sinon.assert.calledWith(DockerEventPublish._handlePublish, {
          Host: '10.0.0.1:4242',
          dockerPort: '4242',
          dockerUrl: 'http://10.0.0.1:4242',
          from: 'ubuntu',
          host: 'http://10.0.0.1:4242',
          id: 'id',
          ip: '10.0.0.1',
          needsInspect: true,
          org: '123456789',
          status: 'start',
          tags: '123456789',
          time: 123456789,
          uuid: '1234-1234-1234',
          inspectData: {
            Id: 'fa94842f2ee10c18271a0a8037681b54eaf234906e1733191b09dd3cf3513802',
            Created: '2016-08-23T21:43:41.921631763Z',
            State: {
              Status: 'running',
              Running: true,
              Paused: false,
              Restarting: false,
              OOMKilled: false,
              Dead: false,
              ExitCode: 0,
              Error: '',
              StartedAt: '2016-08-24T19:55:45.755508303Z',
              FinishedAt: '2016-08-24T19:55:42.537960861Z'
            },
            Image: 'sha256:6f359d21b6893c6a2bba29a33b73ae5892c47962ee47374438a28c2615e3cc04',
            Name: '/fervent_sammet9',
            HostConfig: { Memory: 2048000000, MemoryReservation: 128000000 },
            Config: {
              Hostname: 'fa94842f2ee1',
              Env: [
                'RUNNABLE_CONTAINER_ID=18wjg4',
                'REDIS_VERSION=3.2.1',
                'runnable_test=hello'
              ],
              Image: 'localhost/2335750/57bcc389f970c7140062ab24:57bcc389a124de130050a02c',
              Labels: {
                'test': 'hello',
                'com-docker-swarm-constraints': '[\'org==2335750\',\'node==~ip-10-4-132-87.2335750\']',
                type: 'user-container'
              }
            },
            NetworkSettings: {
              Ports: {
                '6379/tcp': [{ 'HostIp': '0.0.0.0', 'HostPort': '64821' }]
              },
              IPAddress: '172.17.0.3'
            },
            Mounts: []
          }
        })
        sinon.assert.calledOnce(DockerClient.prototype.inspectContainerAsync)
        sinon.assert.calledWith(DockerClient.prototype.inspectContainerAsync, testJob.id)
        done()
      })
    })

    it('should error if incorrect inspect', (done) => {
      const testJob = eventMock({
        needsInspect: true
      })
      const testInspect = { State: 123 }
      DockerClient.prototype.inspectContainerAsync.resolves(testInspect)
      DockerEventPublish(testJob).asCallback((err) => {
        expect(err.message).to.contain('child "State" fails because ["State" must be an object]')
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
      DockerClient.prototype.inspectContainerAsync.rejects(testError)
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }

        sinon.assert.calledOnce(dockerUtils.handleInspectError)
        sinon.assert.calledWith(dockerUtils.handleInspectError, testJob.host, testJob.org, testError, sinon.match.object)
        done()
      })
    })

    it('should call publish for event', function (done) {
      const testJob = eventMock()
      DockerClient.prototype.inspectContainerAsync.resolves()
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
      sinon.stub(rabbitmq, 'createStreamConnectJob')
      sinon.stub(sinceMap, 'set')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishEvent.restore()
      rabbitmq.createStreamConnectJob.restore()
      sinceMap.set.restore()
      done()
    })

    it('should publish container.life-cycle.created', (done) => {
      const payload = {
        status: 'create'
      }

      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'container.life-cycle.created', payload)
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

    it('should publish container.life-cycle.died', (done) => {
      const payload = {
        status: 'die',
        data: 'big'
      }

      DockerEventPublish._handlePublish(payload)
      sinon.assert.calledOnce(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'container.life-cycle.died', payload)
      done()
    })

    it('should publish container.life-cycle.died', (done) => {
      const payload = {
        status: 'die',
        data: 'big'
      }
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

    it('should do nothing for top', (done) => {
      const payload = {
        status: 'top'
      }
      const logStub = {
        error: sinon.stub()
      }
      DockerEventPublish._handlePublish(payload, logStub)

      sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
      sinon.assert.notCalled(rabbitmq.publishEvent)
      sinon.assert.notCalled(logStub.error)
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
      sinon.assert.notCalled(rabbitmq.publishEvent)
      sinon.assert.calledOnce(logStub.error)
      done()
    })
  })
})
