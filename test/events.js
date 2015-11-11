/**
 * @module lib/events
 */
'use strict';

require('loadenv')({ debugName: 'docker-listener' });
var Code = require('code');
var Lab = require('lab');
var dockerMock = require('docker-mock');
var ip = require('ip');
var os = require('os');

var docker = require('../lib/docker');
var events = require('../lib/events');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;

describe('events#enhance', function () {
  it('should add ip, uuid, host, time', function (done) {
    var original = {
      id: 'some-id'
    };
    var currDate = Date.now();
    events.enhance(original, function(err, enhanced) {
      expect(enhanced.time).to.be.at.least(currDate);
      expect(enhanced.uuid).to.exist();
      expect(enhanced.ip).to.equal(ip.address());
      var host = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
      expect(enhanced.host).to.equal(host);
      done();
    });
  });

  it('should not change time if exist', function (done) {
    var original = {
      id: 'some-id',
      time: Date.now() - 1000
    };
    events.enhance(original, function(err, enhanced) {
      if (err) { return done(err); }
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
  });

  describe('container events', function() {
    var ctx = {};
    beforeEach(function (done) {
      process.env.AUTO_RECONNECT = 'true';
      ctx.dockerMock = dockerMock.listen(process.env.DOCKER_REMOTE_API_PORT, done);
    });

    beforeEach(function(done) {
      docker.createContainer({Image: 'ubuntu', Cmd: ['/bin/bash']}, function (err, container) {
        if (err) { return done(err); }
        container.start(function (err) {
          if (err) { return done(err); }
          ctx.container = container;
          done();
        });
      });
    });
    afterEach(function (done) {
      process.env.AUTO_RECONNECT = 'false';
      ctx.dockerMock.close(done);
    });
    afterEach(function(done) {
      ctx = {};
      done();
    });
    ['create', 'die', 'export', 'kill', 'pause', 'restart', 'start', 'stop', 'unpause']
      .forEach(function(event) {
        it('should add inspect data if container event:'+event, function (done) {
          var original = {
            id: ctx.container.id,
            status: event
          };
          events.enhance(original, function(err, enhanced) {
            if (err) { return done(err); }
            expect(enhanced.uuid).to.exist();
            expect(enhanced.ip).to.equal(ip.address());
            var host = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
            expect(enhanced.host).to.equal(host);
            expect(enhanced.inspectData.Id).to.equal(ctx.container.id);
            expect(enhanced.numCpus).to.equal(os.cpus().length);
            expect(enhanced.mem).to.equal(os.totalmem());
            expect(enhanced.tags).to.equal(process.env.HOST_TAGS);

            done();
          });
        });
    });
    ['random', 'anton', 'anand', 'untag', 'delete']
      .forEach(function(event) {
        it('should NOT add inspect data if other event:'+event, function (done) {
          var original = {
            id: ctx.container.id,
            status: event
          };
          events.enhance(original, function(err, enhanced) {
            if (err) { return done(err); }
            expect(enhanced.uuid).to.exist();
            expect(enhanced.ip).to.equal(ip.address());
            var host = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
            expect(enhanced.host).to.equal(host);
            expect(enhanced.inspectData).to.not.exist();
            expect(enhanced.numCpus).to.equal(os.cpus().length);
            expect(enhanced.mem).to.equal(os.totalmem());
            expect(enhanced.tags).to.equal(process.env.HOST_TAGS);

            done();
          });
        });
    });
  });
});
