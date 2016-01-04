/**
 * @module test/publisher
 */
'use strict';

require('loadenv')({ debugName: 'docker-listener' });
var Code = require('code');
var Lab = require('lab');

var TaskFatalError = require('ponos').TaskFatalError

var sinon = require('sinon')
var rabbitmq = require('../lib/rabbitmq');
var docker = require('../lib/docker');
var DockerEventPublish = require('../lib/workers/docker.event.publish.js');
var sinon = require('sinon');
var ip = require('ip');

var lab = exports.lab = Lab.script();

var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;

var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;

describe('docker event publish', function () {
  describe('_createRoutingKey', function () {
    var originalHostTags = process.env.HOST_TAGS
    beforeEach(function (done) {
      process.env.HOST_TAGS = 'testOrg,run.build';
      done();
    });

    afterEach(function (done) {
      process.env.HOST_TAGS = originalHostTags
      done();
    });

    it('should return correct key', function (done) {
      expect(DockerEventPublish._createRoutingKey())
        .to.equal('testOrg.' + ip.address().replace('.', '-'));
      done();
    });
  });
  describe('_addBasicFields', function () {
    it('should add ip, uuid, host, time', function (done) {
      var original = {
        id: 'some-id'
      };
      var currDate = Date.now();
      var enhanced = DockerEventPublish._addBasicFields(original)
      expect(enhanced.time).to.be.at.least(currDate);
      expect(enhanced.uuid).to.exist();
      expect(enhanced.ip).to.equal(ip.address());
      var dockerUrl = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
      expect(enhanced.host).to.equal(dockerUrl);
      expect(enhanced.dockerUrl).to.equal(dockerUrl);
      done();
    });

    it('should not change time if exist', function (done) {
      var original = {
        id: 'some-id',
        time: Date.now() - 1000
      };
      var enhanced = DockerEventPublish._addBasicFields(original)
      expect(enhanced.time).to.equal(original.time);
      expect(enhanced.uuid).to.exist();
      expect(enhanced.ip).to.equal(ip.address());
      expect(enhanced.tags).to.equal(process.env.HOST_TAGS);
      expect(enhanced.org).to.equal(process.env.HOST_TAGS.split(',')[0]);

      var dockerUrl = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
      expect(enhanced.host).to.equal(dockerUrl);
      expect(enhanced.dockerUrl).to.equal(dockerUrl);
      done();
    });
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
    var data = createData('user-container')
    beforeEach(function (done) {
      sinon.stub(rabbitmq, 'publish')
      sinon.stub(docker, 'getContainer').returns(container)
      sinon.stub(container, 'inspect').yieldsAsync(null, data)
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

    it('should not call getContainer for docker.events-stream.connected', function (done) {
      var payload = {
        status: 'docker.events-stream.connected'
      }
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.calledOnce(DockerEventPublish._addBasicFields)
        sinon.assert.calledWith(DockerEventPublish._addBasicFields, payload)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledWith(DockerEventPublish._isContainerEvent, {
          status: 'docker.events-stream.connected',
          host: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        sinon.assert.notCalled(docker.getContainer)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'docker.events-stream.connected', {
          status: 'docker.events-stream.connected',
          host: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        done()
      })
    })

    it('should not call getContainer for docker.events-stream.disconnected', function (done) {
      var payload = {
        status: 'docker.events-stream.disconnected'
      }
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.not.exist()
        sinon.assert.calledOnce(DockerEventPublish._addBasicFields)
        sinon.assert.calledWith(DockerEventPublish._addBasicFields, payload)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledWith(DockerEventPublish._isContainerEvent, {
          status: 'docker.events-stream.disconnected',
          host: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        sinon.assert.notCalled(docker.getContainer)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'docker.events-stream.disconnected', {
          status: 'docker.events-stream.disconnected',
          host: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        done()
      })
    })
    it('should fail if container inspect failed', function (done) {
      var payload = {
        status: 'create',
        id: 'bc533791f3f500b280a9626688bc79e342e3ea0d528efe3a86a51ecb28ea20'
      }
      var error = new Error('Docker error')
      container.inspect.yields(error)
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err.message).to.equal(error.message)
        sinon.assert.calledOnce(DockerEventPublish._addBasicFields)
        sinon.assert.calledWith(DockerEventPublish._addBasicFields, payload)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledWith(DockerEventPublish._isContainerEvent, {
          id: payload.id,
          status: 'create',
          host: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        sinon.assert.calledOnce(docker.getContainer)
        sinon.assert.calledWith(docker.getContainer, payload.id)
        sinon.assert.calledOnce(container.inspect)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })
    it('should fail fatally if container was not failed', function (done) {
      var payload = {
        status: 'create',
        id: 'bc533791f3f500b280a9626688bc79e342e3ea0d528efe3a86a51ecb28ea20'
      }
      var error = new Error('Docker error')
      error.statusCode = 404
      container.inspect.yields(error)
      DockerEventPublish(payload).asCallback(function (err) {
        expect(err).to.be.instanceOf(TaskFatalError)
        expect(err.message).to.contain(error.message)
        sinon.assert.calledOnce(DockerEventPublish._addBasicFields)
        sinon.assert.calledWith(DockerEventPublish._addBasicFields, payload)
        sinon.assert.calledOnce(DockerEventPublish._isContainerEvent)
        sinon.assert.calledWith(DockerEventPublish._isContainerEvent, {
          id: payload.id,
          status: 'create',
          host: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        sinon.assert.calledOnce(docker.getContainer)
        sinon.assert.calledWith(docker.getContainer, payload.id)
        sinon.assert.calledOnce(container.inspect)
        sinon.assert.notCalled(rabbitmq.publish)
        done()
      })
    })
    it('should work for user container create events', function (done) {
      var payload = {
        status: 'create',
        id: 'bc533791f3f500b280a9626688bc79e342e3ea0d528efe3a86a51ecb28ea20'
      }
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
          status: 'create',
          inspectData: data,
          host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        done()
      })
    })
    it('should work for image-builder container create events', function (done) {
      var payload = {
        status: 'create',
        id: 'bc533791f3f500b280a9626688bc79e342e3ea0d528efe3a86a51ecb28ea20'
      }
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
          status: 'create',
          inspectData: data,
          host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        done()
      })
    })
    it('should work for user container die events', function (done) {
      var payload = {
        status: 'die',
        id: 'bc533791f3f500b280a9626688bc79e342e3ea0d528efe3a86a51ecb28ea20'
      }
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
          status: 'die',
          inspectData: data,
          host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        sinon.assert.calledWith(rabbitmq.publish, 'container.life-cycle.died', {
          status: 'die',
          inspectData: data,
          host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        }, sinon.match.string)
        done()
      })
    })
    it('should work for image-builder container die events', function (done) {
      var payload = {
        status: 'die',
        id: 'bc533791f3f500b280a9626688bc79e342e3ea0d528efe3a86a51ecb28ea20'
      }
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
          status: 'die',
          inspectData: data,
          host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        sinon.assert.calledWith(rabbitmq.publish, 'container.life-cycle.died', {
          status: 'die',
          inspectData: data,
          host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        }, sinon.match.string)
        done()
      })
    })
    it('should work container start event', function (done) {
      var payload = {
        status: 'start',
        id: 'bc533791f3f500b280a9626688bc79e342e3ea0d528efe3a86a51ecb28ea20'
      }
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
          status: 'start',
          inspectData: data,
          host: sinon.match.string,
          id: sinon.match.string,
          ip: sinon.match.string,
          tags: sinon.match.string,
          org: sinon.match.string,
          dockerUrl: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        }, sinon.match.string)
        done()
      })
    })
    it('should do nothing for invalid event', function (done) {
      var payload = {
        status: 'invalid-event',
        id: 'bc533791f3f500b280a9626688bc79e342e3ea0d528efe3a86a51ecb28ea20'
      }
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
});
