/**
 * @module test/publisher
 */
'use strict'
require('loadenv')({ debugName: 'docker-listener' })

var Code = require('code')
var Lab = require('lab')
var sinon = require('sinon')
var TaskFatalError = require('ponos').TaskFatalError

var Docker = require('../../../lib/docker')
var DockerEventPublish = require('../../../lib/workers/docker.event.publish.js')
var eventMock = require('../../fixtures/event-mock.js')
var swarmEventMock = require('../../fixtures/swarm-event-mock.js')
var rabbitmq = require('../../../lib/rabbitmq')

var lab = exports.lab = Lab.script()

var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var describe = lab.experiment
var expect = Code.expect
var it = lab.test

function createJob (opts) {
  opts = opts || {}
  return {
    Host: opts.host || '10.0.0.1:4242',
    org: opts.org || '1234123',
    event: JSON.stringify(eventMock(opts))
  }
}

function createSwarmJob (opts) {
  opts = opts || {}
  return {
    Host: opts.host || '10.0.0.1:4242',
    org: null,
    event: JSON.stringify(swarmEventMock(opts))
  }
}

describe('docker event publish', () => {
  describe('_isBlacklisted', () => {
    it('should return true non engine swarm events', (done) => {
      var test = DockerEventPublish._isBlacklisted({type: 'swarm', status: 'other'})
      expect(test).to.be.true()
      done()
    })

    it('should return false engine_connect event', (done) => {
      var test = DockerEventPublish._isBlacklisted({status: 'engine_connect'})
      expect(test).to.be.false()
      done()
    })

    it('should return false engine_disconnect event', (done) => {
      var test = DockerEventPublish._isBlacklisted({status: 'engine_disconnect'})
      expect(test).to.be.false()
      done()
    })

    it('should return true for blacklisted image', (done) => {
      var test = DockerEventPublish._isBlacklisted({
        status: 'start',
        from: process.env.CONTAINERS_BLACKLIST.split(',')[0]
      })
      expect(test).to.be.true()
      done()
    })
  }) // end _isBlacklisted

  describe('_formatEvent', () => {
    it('should format docker event', (done) => {
      var testIp = '10.0.0.0'
      var testPort = '4242'
      var testHost = testIp + ':' + testPort
      var testOrg = '12341234'
      var testTime = (Date.now() / 1000).toFixed(0)
      var event = createJob({
        host: testHost,
        org: testOrg,
        status: 'start',
        id: 'id',
        from: 'ubuntu',
        time: testTime,
        timeNano: testTime * 1000000
      })
      event.event = JSON.parse(event.event)
      var enhanced = DockerEventPublish._formatEvent(event)

      expect(enhanced.status).to.equal('start')
      expect(enhanced.id).to.equal('id')
      expect(enhanced.from).to.equal('ubuntu')
      expect(enhanced.time).to.equal(testTime)
      expect(enhanced.timeNano).to.equal(testTime * 1000000)

      expect(enhanced.type).to.equal('docker')
      expect(enhanced.uuid).to.exist()
      expect(enhanced.ip).to.equal(testIp)
      expect(enhanced.dockerPort).to.equal(testPort)
      expect(enhanced.tags).to.equal(testOrg)
      expect(enhanced.org).to.equal(testOrg)
      var dockerUrl = 'http://' + testIp + ':4242'
      expect(enhanced.host).to.equal(dockerUrl)
      expect(enhanced.dockerUrl).to.equal(dockerUrl)
      done()
    })

    it('should format docker event', (done) => {
      var testIp = '10.0.0.0'
      var testPort = '4242'
      var testHost = testIp + ':' + testPort
      var testOrg = '12341234'
      var testTime = (Date.now() / 1000).toFixed(0)
      var event = createSwarmJob({
        host: testHost,
        org: testOrg,
        status: 'start',
        id: 'id',
        ip: testIp,
        from: 'ubuntu',
        time: testTime,
        timeNano: testTime * 1000000
      })
      event.event = JSON.parse(event.event)
      var enhanced = DockerEventPublish._formatEvent(event)

      expect(enhanced.status).to.equal('start')
      expect(enhanced.id).to.equal('id')
      expect(enhanced.from).to.equal(event.event.from)
      expect(enhanced.time).to.equal(testTime)
      expect(enhanced.timeNano).to.equal(testTime * 1000000)

      expect(enhanced.type).to.equal('swarm')
      expect(enhanced.uuid).to.exist()
      expect(enhanced.ip).to.equal(testIp)
      expect(enhanced.dockerPort).to.equal(testPort)
      expect(enhanced.tags).to.equal(testOrg)
      expect(enhanced.org).to.equal(testOrg)
      var dockerUrl = 'http://' + testIp + ':4242'
      expect(enhanced.host).to.equal(dockerUrl)
      expect(enhanced.dockerUrl).to.equal(dockerUrl)
      done()
    })
  })

  describe('_isContainerEvent', () => {
    it('should return true for container events', (done) => {
      expect(DockerEventPublish._isContainerEvent({ status: 'create' })).to.be.true()
      expect(DockerEventPublish._isContainerEvent({ status: 'die' })).to.be.true()
      expect(DockerEventPublish._isContainerEvent({ status: 'start' })).to.be.true()
      done()
    })

    it('should return false for non-container events', (done) => {
      expect(DockerEventPublish._isContainerEvent({ status: 'launch' })).to.be.false()
      done()
    })
  })

  describe('_isUserContainer', () => {
    it('should return true if user container', (done) => {
      var data = {
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
      var data = {
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
      var data = {
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
      var data = {
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
    function createData (type) {
      return {
        Bridge: 'docker0',
        Gateway: '172.17.42.1',
        IPAddress: '172.17.0.4',
        IPPrefixLen: 16,
        PortMapping: null,
        Config: {
          Labels: {
            type: type || 'user-container'
          }
        },
        Ports: {
          '5000/tcp': [
            {
              'HostIp': '0.0.0.0',
              'HostPort': '5000'
            }
          ]
        }
      }
    }

    beforeEach((done) => {
      sinon.stub(rabbitmq, 'publish')
      sinon.stub(rabbitmq, 'createStreamConnectJob')
      sinon.stub(Docker.prototype, 'inspectContainer')
      sinon.stub(Docker.prototype, 'swarmHostExists')
      sinon.stub(DockerEventPublish, '_isBlacklisted')
      sinon.spy(DockerEventPublish, '_formatEvent')
      sinon.spy(DockerEventPublish, '_isContainerEvent')
      done()
    })

    afterEach((done) => {
      rabbitmq.publish.restore()
      rabbitmq.createStreamConnectJob.restore()
      Docker.prototype.inspectContainer.restore()
      Docker.prototype.swarmHostExists.restore()
      DockerEventPublish._formatEvent.restore()
      DockerEventPublish._isContainerEvent.restore()
      DockerEventPublish._isBlacklisted.restore()
      done()
    })

    it('should be TaskFatalError if invalid data', (done) => {
      DockerEventPublish({}).asCallback((err) => {
        expect(err).to.be.an.instanceOf(TaskFatalError)
        done()
      })
    })

    it('should not publish for blacklisted', (done) => {
      var payload = {
        status: 'start',
        from: process.env.CONTAINERS_BLACKLIST.split(',')[0]
      }
      var testJob = createJob(payload)
      DockerEventPublish._isBlacklisted.returns(true)

      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }

        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should not call inspectContainer for non container event', (done) => {
      var payload = {
        status: 'fake'
      }
      var testJob = createJob(payload)
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }

        sinon.assert.notCalled(Docker.prototype.inspectContainer)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should work for user container create events', (done) => {
      var payload = {
        status: 'create',
        id: 'id'
      }
      var testJob = createJob(payload)
      var data = createData('user-container')
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerEventPublish._formatEvent)
        sinon.assert.calledWithMatch(DockerEventPublish._formatEvent, testJob)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.calledWith(Docker.prototype.inspectContainer, payload.id)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'on-instance-container-create', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          Host: sinon.match.string,
          dockerPort: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.number,
          timeNano: sinon.match.number,
          type: 'docker',
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should work for image-builder container create events', (done) => {
      var payload = {
        status: 'create',
        id: 'id'
      }
      var testJob = createJob(payload)
      var data = createData('image-builder-container')
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerEventPublish._formatEvent)
        sinon.assert.calledWithMatch(DockerEventPublish._formatEvent, testJob)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.calledWith(Docker.prototype.inspectContainer, payload.id)
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'on-image-builder-container-create', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          Host: sinon.match.string,
          dockerPort: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.number,
          timeNano: sinon.match.number,
          type: 'docker',
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should not publish for non user or non build container create', (done) => {
      var payload = {
        status: 'create'
      }
      var testJob = createJob(payload)
      Docker.prototype.inspectContainer.returns(Promise.resolve())
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should work for user container die events', (done) => {
      var payload = {
        status: 'die',
        id: 'id'
      }
      var testJob = createJob(payload)
      var data = createData('user-container')
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerEventPublish._formatEvent)
        sinon.assert.calledWithMatch(DockerEventPublish._formatEvent, testJob)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.calledWith(Docker.prototype.inspectContainer, payload.id)
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.calledTwice(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'on-instance-container-die', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          Host: sinon.match.string,
          dockerPort: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.number,
          timeNano: sinon.match.number,
          type: 'docker',
          uuid: sinon.match.string
        })
        sinon.assert.calledWith(rabbitmq.publish, 'container.life-cycle.died', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          Host: sinon.match.string,
          dockerPort: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.number,
          timeNano: sinon.match.number,
          type: 'docker',
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should work for image-builder container die events', (done) => {
      var payload = {
        status: 'die',
        id: 'id'
      }
      var testJob = createJob(payload)
      var data = createData('image-builder-container')
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerEventPublish._formatEvent)
        sinon.assert.calledWithMatch(DockerEventPublish._formatEvent, testJob)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.calledWith(Docker.prototype.inspectContainer, payload.id)
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.calledTwice(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'on-image-builder-container-die', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          Host: sinon.match.string,
          dockerPort: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.number,
          timeNano: sinon.match.number,
          type: 'docker',
          uuid: sinon.match.string
        })
        sinon.assert.calledWith(rabbitmq.publish, 'container.life-cycle.died', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          Host: sinon.match.string,
          dockerPort: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.number,
          timeNano: sinon.match.number,
          type: 'docker',
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should publish only container.life-cycle.died', (done) => {
      var payload = {
        status: 'die'
      }
      var testJob = createJob(payload)
      var data = {id: 'test'}
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'container.life-cycle.died', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          Host: sinon.match.string,
          dockerPort: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.number,
          timeNano: sinon.match.number,
          type: 'docker',
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should work container start event', (done) => {
      var payload = {
        status: 'start',
        id: 'id'
      }
      var testJob = createJob(payload)
      var data = createData('user-container')
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerEventPublish._formatEvent)
        sinon.assert.calledWithMatch(DockerEventPublish._formatEvent, testJob)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.calledWith(Docker.prototype.inspectContainer, payload.id)
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'container.life-cycle.started', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          Host: sinon.match.string,
          dockerPort: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.number,
          timeNano: sinon.match.number,
          type: 'docker',
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should publish docker.events-stream.connected job', (done) => {
      var payload = {
        status: 'engine_connect',
        ip: '10.0.0.1',
        org: 'orgorg'
      }
      var testJob = createSwarmJob(payload)
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.notCalled(Docker.prototype.inspectContainer)
        sinon.assert.calledOnce(rabbitmq.createStreamConnectJob)
        sinon.assert.calledWith(rabbitmq.createStreamConnectJob, 'docker', '10.0.0.1:4242', 'orgorg')
        done()
      })
    })

    it('should do nothing for invalid event', (done) => {
      var payload = {
        status: 'invalid-event',
        id: 'id'
      }
      var testJob = createJob(payload)
      DockerEventPublish(testJob).asCallback((err) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerEventPublish._formatEvent)
        sinon.assert.calledWithMatch(DockerEventPublish._formatEvent, testJob)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.notCalled(Docker.prototype.inspectContainer)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should fail fatally if container was not found', (done) => {
      const payload = {}
      const job = createJob(payload)
      const error = new Error('Docker error')
      error.statusCode = 404
      Docker.prototype.inspectContainer.returns(Promise.reject(error))
      DockerEventPublish(job).asCallback((err) => {
        expect(err).to.be.instanceOf(TaskFatalError)
        expect(err.message).to.contain(error.message)

        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should throw original error if check host failed', (done) => {
      const testErr = new Error('bully')
      const testJob = createJob()
      Docker.prototype.inspectContainer.returns(Promise.reject(testErr))
      Docker.prototype.swarmHostExists.returns(Promise.reject('reject'))
      DockerEventPublish(testJob).asCallback((err) => {
        expect(err).to.equal(testErr)
        done()
      })
    })

    it('should throw original error if host exists', (done) => {
      const testErr = new Error('bully')
      const testJob = createJob()
      Docker.prototype.inspectContainer.returns(Promise.reject(testErr))
      Docker.prototype.swarmHostExists.returns(Promise.resolve(true))
      DockerEventPublish(testJob).asCallback((err) => {
        expect(err).to.equal(testErr)
        done()
      })
    })

    it('should throw TaskFatalError error if host !exists', (done) => {
      const testErr = new Error('bully')
      const testJob = createJob()
      Docker.prototype.inspectContainer.returns(Promise.reject(testErr))
      Docker.prototype.swarmHostExists.returns(Promise.resolve(false))
      DockerEventPublish(testJob).asCallback((err) => {
        expect(err).to.be.an.instanceOf(TaskFatalError)
        done()
      })
    })
  })
})
