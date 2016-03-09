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
    event: {
      data: new Buffer(JSON.stringify(eventMock(opts)))
    }
  }
}

function createSwarmJob (opts) {
  opts = opts || {}
  return {
    Host: opts.host || '10.0.0.1:4242',
    org: opts.org || '1234123',
    event: {
      data: new Buffer(JSON.stringify(swarmEventMock(opts)))
    }
  }
}

describe('docker event publish', function () {
  describe('_isBlacklisted', function () {
    it('should return true non engine swarm events', function (done) {
      var test = DockerEventPublish._isBlacklisted({type: 'swarm', status: 'other'})
      expect(test).to.be.true()
      done()
    })

    it('should return false engine_connect event', function (done) {
      var test = DockerEventPublish._isBlacklisted({status: 'engine_connect'})
      expect(test).to.be.false()
      done()
    })

    it('should return false engine_disconnect event', function (done) {
      var test = DockerEventPublish._isBlacklisted({status: 'engine_disconnect'})
      expect(test).to.be.false()
      done()
    })

    it('should return true for blacklisted image', function (done) {
      var test = DockerEventPublish._isBlacklisted({
        status: 'start',
        from: process.env.CONTAINERS_BLACKLIST.split(',')[0]
      })
      expect(test).to.be.true()
      done()
    })
  }) // end _isBlacklisted

  describe('_formatEvent', function () {
    it('should add extra fields and keep existing ones', function (done) {
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
      event.event = new Buffer(event.event.data)
      var enhanced = DockerEventPublish._formatEvent(event)

      expect(enhanced.status).to.equal('start')
      expect(enhanced.id).to.equal('id')
      expect(enhanced.from).to.equal('ubuntu')
      expect(enhanced.time).to.equal(testTime)
      expect(enhanced.timeNano).to.equal(testTime * 1000000)

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

  describe('_isContainerEvent', function () {
    it('should return true for container events', function (done) {
      expect(DockerEventPublish._isContainerEvent({ status: 'create' })).to.be.true()
      expect(DockerEventPublish._isContainerEvent({ status: 'die' })).to.be.true()
      expect(DockerEventPublish._isContainerEvent({ status: 'start' })).to.be.true()
      done()
    })

    it('should return false for non-container events', function (done) {
      expect(DockerEventPublish._isContainerEvent({ status: 'launch' })).to.be.false()
      done()
    })
  })

  describe('_isUserContainer', function () {
    it('should return true if user container', function (done) {
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

    it('should return false if not user container', function (done) {
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

  describe('_isBuildContainer', function () {
    it('should return true if user container', function (done) {
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

    it('should return false if not user container', function (done) {
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

  describe('worker', function () {
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

    beforeEach(function (done) {
      sinon.stub(rabbitmq, 'publish')
      sinon.stub(Docker.prototype, 'inspectContainer')
      sinon.stub(DockerEventPublish, '_isBlacklisted')
      sinon.spy(DockerEventPublish, '_formatEvent')
      sinon.spy(DockerEventPublish, '_isContainerEvent')
      done()
    })

    afterEach(function (done) {
      rabbitmq.publish.restore()
      Docker.prototype.inspectContainer.restore()
      DockerEventPublish._formatEvent.restore()
      DockerEventPublish._isContainerEvent.restore()
      DockerEventPublish._isBlacklisted.restore()
      done()
    })

    it('should not publish for blacklisted', function (done) {
      var payload = {
        status: 'start',
        from: process.env.CONTAINERS_BLACKLIST.split(',')[0]
      }
      var testJob = createJob(payload)
      DockerEventPublish._isBlacklisted.returns(true)

      DockerEventPublish(testJob).asCallback(function (err) {
        if (err) { return done(err) }

        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should not call inspectContainer for non container event', function (done) {
      var payload = {
        status: 'fake'
      }
      var testJob = createJob(payload)
      DockerEventPublish(testJob).asCallback(function (err) {
        if (err) { return done(err) }

        sinon.assert.notCalled(Docker.prototype.inspectContainer)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should fail if container inspect failed', function (done) {
      var payload = {
        status: 'start',
        id: 'bc533791f3f500b280a9626688bc79e342e3ea0d528efe3a86a51ecb28ea20'
      }
      var testJob = createJob(payload)
      var error = new Error('Docker error')
      Docker.prototype.inspectContainer.returns(Promise.reject(error))
      DockerEventPublish(testJob).asCallback(function (err) {
        expect(err.message).to.equal(error.message)

        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should fail fatally if container was not found', function (done) {
      var payload = {}
      var testJob = createJob(payload)
      var error = new Error('Docker error')
      error.statusCode = 404
      Docker.prototype.inspectContainer.returns(Promise.reject(error))
      DockerEventPublish(testJob).asCallback(function (err) {
        expect(err).to.be.instanceOf(TaskFatalError)
        expect(err.message).to.contain(error.message)

        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should work for user container create events', function (done) {
      var payload = {
        status: 'create',
        id: 'id'
      }
      var testJob = createJob(payload)
      var data = createData('user-container')
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback(function (err) {
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
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should work for image-builder container create events', function (done) {
      var payload = {
        status: 'create',
        id: 'id'
      }
      var testJob = createJob(payload)
      var data = createData('image-builder-container')
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback(function (err) {
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
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should not publish for non user or non build container create', function (done) {
      var payload = {
        status: 'create'
      }
      var testJob = createJob(payload)
      Docker.prototype.inspectContainer.returns(Promise.resolve())
      DockerEventPublish(testJob).asCallback(function (err) {
        if (err) { return done(err) }
        sinon.assert.calledOnce(Docker.prototype.inspectContainer)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should work for user container die events', function (done) {
      var payload = {
        status: 'die',
        id: 'id'
      }
      var testJob = createJob(payload)
      var data = createData('user-container')
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback(function (err) {
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
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should work for image-builder container die events', function (done) {
      var payload = {
        status: 'die',
        id: 'id'
      }
      var testJob = createJob(payload)
      var data = createData('image-builder-container')
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback(function (err) {
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
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should publish only container.life-cycle.died', function (done) {
      var payload = {
        status: 'die'
      }
      var testJob = createJob(payload)
      var data = {id: 'test'}
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback(function (err) {
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
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should work container start event', function (done) {
      var payload = {
        status: 'start',
        id: 'id'
      }
      var testJob = createJob(payload)
      var data = createData('user-container')
      Docker.prototype.inspectContainer.returns(Promise.resolve(data))
      DockerEventPublish(testJob).asCallback(function (err) {
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
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should publish docker.events-stream.connected', function (done) {
      var payload = {
        status: 'engine_connect'
      }
      var testJob = createSwarmJob(payload)
      DockerEventPublish(testJob).asCallback(function (err) {
        if (err) { return done(err) }
        sinon.assert.notCalled(Docker.prototype.inspectContainer)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'docker.events-stream.connected', {
          dockerPort: sinon.match.string,
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          Host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          node: sinon.match.object,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.string,
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should publish docker.events-stream.disconnected', function (done) {
      var payload = {
        status: 'engine_disconnect'
      }
      var testJob = createSwarmJob(payload)
      DockerEventPublish(testJob).asCallback(function (err) {
        if (err) { return done(err) }
        sinon.assert.notCalled(Docker.prototype.inspectContainer)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'docker.events-stream.disconnected', {
          dockerPort: sinon.match.string,
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          Host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          node: sinon.match.object,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.string,
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should do nothing for invalid event', function (done) {
      var payload = {
        status: 'invalid-event',
        id: 'id'
      }
      var testJob = createJob(payload)
      DockerEventPublish(testJob).asCallback(function (err) {
        if (err) { return done(err) }
        sinon.assert.calledOnce(DockerEventPublish._formatEvent)
        sinon.assert.calledWithMatch(DockerEventPublish._formatEvent, testJob)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.notCalled(Docker.prototype.inspectContainer)
        sinon.assert.notCalled(Docker.prototype.inspectContainer)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })
  })
})
