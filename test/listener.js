/**
 * @module test/listener
 */
'use strict';

require('loadenv')('docker-listener:test');
var Code = require('code');
var Lab = require('lab');
var noop = require('101/noop');
var debug = require('debug')('test-listener');
var ip = require('ip');
var stream = require('stream');

var docker = require('./fixtures/docker-mock.js');
var listener = require('../lib/listener.js');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;

describe('listener', function () {
  it('should fail to start when publisher is not writable', function (done) {
    try {
      listener.start(new stream.Stream());
      done('Should fail');
    } catch (err) {
      expect(err.message).to.equal('publisher stream should be Writable');
      done();
    }
  });

  it('should fail to start when publisher is Readable', function (done) {
    try {
      listener.start(new stream.Readable());
      done('Should fail');
    } catch (err) {
      expect(err.message).to.equal('publisher stream should be Writable');
      done();
    }
  });

  describe('re-start docker', function () {
    beforeEach(function (done) {
      process.env.AUTO_RECONNECT = 'true';
      docker.start(done);
    });
    afterEach(function (done) {
      listener.stop();
      done();
    });

    it('should handle case when docker was working and than down for some time', function (done) {
      var ws = new stream.Stream();
      ws.writable = true;
      var isFirstUp = true;
      /*jshint maxcomplexity:9 */
      ws.write = function (data) {
        if (typeof data === 'object') {
          if (!data.status) {
            data = data.toString();
          }
        }
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (data.host) {
          var host = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
          expect(data.host).to.equal(host);
        }
        /*jshint -W030 */
        expect(data.status).to.be.String;
        expect(data.id).to.be.String;
        expect(data.host).to.be.String;
        expect(data.uuid).to.be.String;
        expect(data.from).to.be.String;
        expect(data.time).to.be.Number;

        if (data.status === 'docker_daemon_up' && isFirstUp) {
          isFirstUp = false;
          return docker.emitEvent('die');
        }
        if (data.status === 'die') {
          return docker.forceStop(noop);
        }
        if (data.status === 'docker_daemon_down') {
          return docker.start(noop);
        }
        if (data.status === 'docker_daemon_up' && !isFirstUp) {
          return docker.forceStop(done);
        }
      };
      ws.end = function () {
        debug('disconnect');
      };
      listener.start(ws);
    });
  });

  describe('close', function () {

    beforeEach(function (done) {
      docker.start(done);
    });

    afterEach(function (done) {
      docker.stop(done);
    });

    afterEach(function (done) {
      listener.stop();
      done();
    });

    it('should stop receiving events after close was called', function (done) {
      var ws = new stream.Stream();
      ws.writable = true;
      ws.write = function (data) {
        if (typeof data === 'object') {
          if (!data.status) {
            data = data.toString();
          }
        }
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (data.status === 'docker_daemon_up') {
          listener.stop();
          docker.emitEvent('die');
          return done();
        }
        done(new Error('Streaming never stopped'));
      };
      ws.end = function () {
        debug('disconnect');
      };
      listener.start(ws);
    });
  });
});