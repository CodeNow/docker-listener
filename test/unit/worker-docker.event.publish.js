/**
 * @module test/publisher
 */
'use strict'
require('loadenv')({ debugName: 'docker-listener' })

var Code = require('code')
var Lab = require('lab')
var sinon = require('sinon')
var TaskFatalError = require('ponos').TaskFatalError

var docker = require('../../lib/docker')
var DockerEventPublish = require('../../lib/workers/docker.event.publish.js')
var eventMock = require('../fixtures/event-mock.js')
var rabbitmq = require('../../lib/rabbitmq')

var lab = exports.lab = Lab.script()

var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var describe = lab.experiment
var expect = Code.expect
var it = lab.test

describe('docker event publish', function () {
  describe('_addBasicFields', function () {
    it('should add ip, uuid, host, time', function (done) {
      var testIp = '10.0.0.0'
      var testOrg = '12341234'
      var testTime = (Date.now() / 1000).toFixed(0)
      var event = eventMock({
        ip: testIp,
        org: testOrg,
        time: testTime
      })
      var enhanced = DockerEventPublish._addBasicFields(event)

      expect(enhanced.uuid).to.exist()
      expect(enhanced.ip).to.equal(testIp)
      expect(enhanced.tags).to.equal(testOrg)
      expect(enhanced.org).to.equal(testOrg)
      expect(enhanced.time).to.equal(testTime)
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
      expect(DockerEventPublish._isContainerEvent({ status: 'kill' })).to.be.true()
      expect(DockerEventPublish._isContainerEvent({ status: 'restart' })).to.be.true()
      expect(DockerEventPublish._isContainerEvent({ status: 'start' })).to.be.true()
      expect(DockerEventPublish._isContainerEvent({ status: 'start' })).to.be.true()
      expect(DockerEventPublish._isContainerEvent({ status: 'stop' })).to.be.true()
      expect(DockerEventPublish._isContainerEvent({ status: 'unpause' })).to.be.true()
      done()
    })

    it('should return false for non-container events', function (done) {
      expect(DockerEventPublish._isContainerEvent({ status: 'launch' })).to.be.false()
      done()
    })
  })

  describe('_isEngineEvent', function () {
    it('should return true for engine_disconnect', function (done) {
      expect(DockerEventPublish._isEngineEvent({ status: 'engine_disconnect' })).to.be.true()
      done()
    })

    it('should return true for engine_connect', function (done) {
      expect(DockerEventPublish._isEngineEvent({ status: 'engine_disconnect' })).to.be.true()
      done()
    })

    it('should return false for non-container events', function (done) {
      expect(DockerEventPublish._isEngineEvent({ status: 'engine' })).to.be.false()
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
    var container = {
      inspect: function (cb) {
        cb()
      }
    }
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
      sinon.stub(docker, 'getContainer').returns(container)
      sinon.stub(container, 'inspect')
      sinon.spy(DockerEventPublish, '_addBasicFields')
      sinon.spy(DockerEventPublish, '_isContainerEvent')
      done()
    })
    afterEach(function (done) {
      rabbitmq.publish.restore()
      docker.getContainer.restore()
      container.inspect.restore()
      DockerEventPublish._addBasicFields.restore()
      DockerEventPublish._isContainerEvent.restore()
      done()
    })

    it('should not call getContainer for non container event', function (done) {
      var payload = eventMock({
        status: 'fake'
      })
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()

        sinon.assert.notCalled(docker.getContainer)
        done()
      })
    })

    it('should fail if container inspect failed', function (done) {
      var payload = eventMock({
        status: 'start',
        id: 'bc533791f3f500b280a9626688bc79e342e3ea0d528efe3a86a51ecb28ea20'
      })
      var error = new Error('Docker error')
      container.inspect.yields(error)
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err.message).to.equal(error.message)

        sinon.assert.calledOnce(container.inspect)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should fail fatally if container was not found', function (done) {
      var payload = eventMock()
      var error = new Error('Docker error')
      error.statusCode = 404
      container.inspect.yields(error)
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.be.instanceOf(TaskFatalError)
        expect(err.message).to.contain(error.message)

        sinon.assert.calledOnce(container.inspect)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should work for user container create events', function (done) {
      var payload = eventMock({
        status: 'create'
      })
      var data = createData('user-container')
      container.inspect.yieldsAsync(null, data)
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.calledOnce(DockerEventPublish._addBasicFields)
        sinon.assert.calledWith(DockerEventPublish._addBasicFields, payload)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledOnce(docker.getContainer)
        sinon.assert.calledWith(docker.getContainer, payload.id)
        sinon.assert.calledOnce(container.inspect)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'on-instance-container-create', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          node: payload.node,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.string,
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should work for image-builder container create events', function (done) {
      var payload = eventMock({
        status: 'create'
      })
      var data = createData('image-builder-container')
      container.inspect.yieldsAsync(null, data)
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.calledOnce(DockerEventPublish._addBasicFields)
        sinon.assert.calledWith(DockerEventPublish._addBasicFields, payload)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledOnce(docker.getContainer)
        sinon.assert.calledWith(docker.getContainer, payload.id)
        sinon.assert.calledOnce(container.inspect)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'on-image-builder-container-create', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          node: payload.node,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.string,
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should not publish for non user or non build container create', function (done) {
      var payload = eventMock({
        status: 'create'
      })
      container.inspect.yieldsAsync()
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.calledOnce(container.inspect)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })

    it('should work for user container die events', function (done) {
      var payload = eventMock({
        status: 'die'
      })
      var data = createData('user-container')
      container.inspect.yieldsAsync(null, data)
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.calledOnce(DockerEventPublish._addBasicFields)
        sinon.assert.calledWith(DockerEventPublish._addBasicFields, payload)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledOnce(docker.getContainer)
        sinon.assert.calledWith(docker.getContainer, payload.id)
        sinon.assert.calledOnce(container.inspect)
        sinon.assert.calledTwice(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'on-instance-container-die', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          node: payload.node,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.string,
          uuid: sinon.match.string
        })
        sinon.assert.calledWith(rabbitmq.publish, 'container.life-cycle.died', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          node: payload.node,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.string,
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should work for image-builder container die events', function (done) {
      var payload = eventMock({
        status: 'die'
      })
      var data = createData('image-builder-container')
      container.inspect.yieldsAsync(null, data)
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.calledOnce(DockerEventPublish._addBasicFields)
        sinon.assert.calledWith(DockerEventPublish._addBasicFields, payload)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledOnce(docker.getContainer)
        sinon.assert.calledWith(docker.getContainer, payload.id)
        sinon.assert.calledOnce(container.inspect)
        sinon.assert.calledTwice(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'on-image-builder-container-die', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          node: payload.node,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.string,
          uuid: sinon.match.string
        })
        sinon.assert.calledWith(rabbitmq.publish, 'container.life-cycle.died', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          node: payload.node,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.string,
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should publish only container.life-cycle.died', function (done) {
      var payload = eventMock({
        status: 'die'
      })
      var data = {id: 'test'}
      container.inspect.yieldsAsync(null, data)
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.calledOnce(container.inspect)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'container.life-cycle.died', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          node: payload.node,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.string,
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should work container start event', function (done) {
      var payload = eventMock({
        status: 'start'
      })
      var data = createData('user-container')
      container.inspect.yieldsAsync(null, data)
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.calledOnce(DockerEventPublish._addBasicFields)
        sinon.assert.calledWith(DockerEventPublish._addBasicFields, payload)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledOnce(docker.getContainer)
        sinon.assert.calledWith(docker.getContainer, payload.id)
        sinon.assert.calledOnce(container.inspect)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'container.life-cycle.started', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          id: sinon.match.string,
          inspectData: data,
          ip: sinon.match.string,
          node: payload.node,
          org: sinon.match.string,
          status: payload.status,
          tags: sinon.match.string,
          time: sinon.match.string,
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should publish docker.events-stream.connected', function (done) {
      var payload = eventMock({
        status: 'engine_connect'
      })
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.notCalled(container.inspect)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'docker.events-stream.connected', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          node: payload.node,
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
      var payload = eventMock({
        status: 'engine_disconnect'
      })
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.notCalled(container.inspect)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'docker.events-stream.disconnected', {
          dockerUrl: sinon.match.string,
          from: sinon.match.string,
          host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          node: payload.node,
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
      var payload = eventMock({
        status: 'invalid-event'
      })
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.calledOnce(DockerEventPublish._addBasicFields)
        sinon.assert.calledWith(DockerEventPublish._addBasicFields, payload)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.notCalled(docker.getContainer)
        sinon.assert.notCalled(container.inspect)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })
  })
})
