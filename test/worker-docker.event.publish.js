/**
 * @module test/publisher
 */
'use strict';

require('loadenv')({ debugName: 'docker-listener' });
var Code = require('code');
var Lab = require('lab');


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

});
