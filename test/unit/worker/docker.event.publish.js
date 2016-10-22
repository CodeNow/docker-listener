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
  describe('worker', () => {
    beforeEach((done) => {
      sinon.stub(DockerClient.prototype, 'inspectContainerAsync')
      sinon.stub(dockerUtils, 'handleInspectError')
      sinon.stub(DockerEventPublish, '_handlePublish')
      sinon.stub(sinceMap, 'set')
      done()
    })

    afterEach((done) => {
      DockerClient.prototype.inspectContainerAsync.restore()
      dockerUtils.handleInspectError.restore()
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
      const testInspect = { Id: 'gear' }
      DockerClient.prototype.inspectContainerAsync.returns(Promise.resolve(testInspect))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        expect(testJob.inspectData).to.equal(testInspect)
        sinon.assert.calledOnce(DockerClient.prototype.inspectContainerAsync)
        sinon.assert.calledWith(DockerClient.prototype.inspectContainerAsync, testJob.id)
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
      DockerClient.prototype.inspectContainerAsync.returns(Promise.resolve(testInspect))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        expect(testJob.inspectData).to.equal(testInspect)
        sinon.assert.calledOnce(DockerEventPublish._handlePublish)
        const finalJob = DockerEventPublish._handlePublish.getCall(0).args[0]
        expect(finalJob.tid).to.equal(testTid)
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
      DockerClient.prototype.inspectContainerAsync.returns(Promise.resolve(testInspect))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        expect(testJob.inspectData).to.equal(testInspect)
        sinon.assert.calledOnce(DockerEventPublish._handlePublish)
        const finalJob = DockerEventPublish._handlePublish.getCall(0).args[0]
        expect(finalJob.tid).to.not.exist()
        done()
      })
    })

    it('should strip inspect data', (done) => {
      const testJob = eventMock({
        needsInspect: true
      })
      const testInspect = require('../../fixtures/inspect-data.js')
      DockerClient.prototype.inspectContainerAsync.returns(Promise.resolve(testInspect))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        expect(testJob.inspectData).to.equal({
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
              'REDIS_VERSION=3.2.1'
            ],
            Image: 'localhost/2335750/57bcc389f970c7140062ab24:57bcc389a124de130050a02c',
            Labels: {
              'com-docker-swarm-constraints': '[\'org==2335750\',\'node==~ip-10-4-132-87.2335750\']',
              type: 'user-container'
            }
          },
          NetworkSettings: {
            Ports: {
              '6379/tcp': [{ 'HostIp': '0.0.0.0', 'HostPort': '64821' }]
            },
            IPAddress: '172.17.0.3'
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
      DockerClient.prototype.inspectContainerAsync.returns(Promise.resolve(testInspect))
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
      DockerClient.prototype.inspectContainerAsync.returns(Promise.reject(testError))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }

        sinon.assert.calledOnce(dockerUtils.handleInspectError)
        sinon.assert.calledWith(dockerUtils.handleInspectError, testJob.host, testJob.org, testError, sinon.match.object)
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

  describe('_publishEvent', function () {
    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publishEvent')
      done()
    })

    afterEach((done) => {
      rabbitmq.publishEvent.restore()
      done()
    })

    it('should call publishEvent once if type is not speicified', (done) => {
      const payload = {
        status: 'create',
        inspectData: {
          Config: {
            Labels: {}
          }
        }
      }
      DockerEventPublish._publishEvent('container.life-cycle.created', payload)
      sinon.assert.calledOnce(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'container.life-cycle.created', payload)
      done()
    })

    it('should call publishEvent twice if type is user-container', (done) => {
      const payload = {
        status: 'create',
        inspectData: {
          Config: {
            Labels: {
              type: 'user-container'
            }
          }
        }
      }
      DockerEventPublish._publishEvent('container.life-cycle.created', payload)
      sinon.assert.calledTwice(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'container.life-cycle.created', payload)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'user-container.container.life-cycle.created', payload)
      done()
    })

    it('should call publishEvent twice if type is image-builder', (done) => {
      const payload = {
        status: 'create',
        inspectData: {
          Config: {
            Labels: {
              type: 'image-builder'
            }
          }
        }
      }
      DockerEventPublish._publishEvent('container.life-cycle.created', payload)
      sinon.assert.calledTwice(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'container.life-cycle.created', payload)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'image-builder.container.life-cycle.created', payload)
      done()
    })

    it('should call publishEvent once if type is layerCopy', (done) => {
      const payload = {
        status: 'create',
        inspectData: {
          Config: {
            Labels: {
              type: 'layerCopy'
            }
          }
        }
      }

      DockerEventPublish._publishEvent('container.life-cycle.created', payload)

      sinon.assert.calledOnce(rabbitmq.publishEvent)
      sinon.assert.calledWith(rabbitmq.publishEvent, 'container.life-cycle.created', payload)
      done()
    })
  })

  describe('_handlePublish', function () {
    beforeEach((done) => {
      sinon.stub(DockerEventPublish, '_publishEvent')
      sinon.stub(rabbitmq, 'createStreamConnectJob')
      sinon.stub(sinceMap, 'set')
      done()
    })

    afterEach((done) => {
      DockerEventPublish._publishEvent.restore()
      rabbitmq.createStreamConnectJob.restore()
      sinceMap.set.restore()
      done()
    })

    it('should call DockerEventPublish._publishEvent for created event', (done) => {
      const payload = {
        status: 'create',
        inspectData: {
          Config: {
            Labels: {
              type: 'user-container'
            }
          }
        }
      }

      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(DockerEventPublish._publishEvent)
      sinon.assert.calledWith(DockerEventPublish._publishEvent, 'container.life-cycle.created', payload)
      sinon.assert.notCalled(rabbitmq.createStreamConnectJob)
      done()
    })

    it('should call DockerEventPublish._publishEvent for started event', (done) => {
      const payload = {
        status: 'start',
        data: 'big',
        inspectData: {
          Config: {
            Labels: {}
          }
        }
      }
      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(DockerEventPublish._publishEvent)
      sinon.assert.calledWith(DockerEventPublish._publishEvent, 'container.life-cycle.started', payload)
      done()
    })

    it('should call DockerEventPublish._publishEvent for died event', (done) => {
      const payload = {
        status: 'die',
        data: 'big',
        inspectData: {
          Config: {
            Labels: {}
          }
        }
      }
      DockerEventPublish._handlePublish(payload)

      sinon.assert.calledOnce(DockerEventPublish._publishEvent)
      sinon.assert.calledWith(DockerEventPublish._publishEvent, 'container.life-cycle.died', payload)
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
      sinon.assert.notCalled(DockerEventPublish._publishEvent)
      sinon.assert.calledOnce(logStub.error)
      done()
    })
  })
})
