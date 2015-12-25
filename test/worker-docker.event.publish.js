/**
 * @module test/publisher
 */
'use strict';

require('loadenv')({ debugName: 'docker-listener' });
var Code = require('code');
var Lab = require('lab');

var sinon = require('sinon')
var rabbitmq = require('../lib/rabbitmq');
var docker = require('../lib/docker');
var DockerEventPublish = require('../lib/workers/docker.event.publish.js');
var sinon = require('sinon');
var ip = require('ip');
var os = require('os');

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
      var host = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
      expect(enhanced.host).to.equal(host);
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
      expect(enhanced.numCpus).to.equal(os.cpus().length);
      expect(enhanced.mem).to.equal(os.totalmem());
      expect(enhanced.tags).to.equal(process.env.HOST_TAGS);

      var host = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
      expect(enhanced.host).to.equal(host);
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
    beforeEach(function (done) {
      sinon.stub(rabbitmq, 'publish')
      sinon.stub(docker, 'getContainer')
      sinon.spy(DockerEventPublish, '_addBasicFields')
      sinon.spy(DockerEventPublish, '_isContainerEvent')
      done()
    })
    afterEach(function (done) {
      rabbitmq.publish.restore()
      docker.getContainer.restore()
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
          mem: sinon.match.number,
          numCpus: sinon.match.number,
          tags: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        sinon.assert.notCalled(docker.getContainer)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'docker.events-stream.connected', {
          status: 'docker.events-stream.connected',
          host: sinon.match.string,
          ip: sinon.match.string,
          mem: sinon.match.number,
          numCpus: sinon.match.number,
          tags: sinon.match.string,
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
          mem: sinon.match.number,
          numCpus: sinon.match.number,
          tags: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        sinon.assert.notCalled(docker.getContainer)
        sinon.assert.calledOnce(rabbitmq.publish)
        sinon.assert.calledWith(rabbitmq.publish, 'docker.events-stream.disconnected', {
          status: 'docker.events-stream.disconnected',
          host: sinon.match.string,
          ip: sinon.match.string,
          mem: sinon.match.number,
          numCpus: sinon.match.number,
          tags: sinon.match.string,
          time: sinon.match.number,
          uuid: sinon.match.string
        })
        done()
      })
    })
  })

});
