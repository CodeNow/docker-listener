'use strict';
var Code = require('code');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.experiment;
var it = lab.test;
var expect = Code.expect;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;


var cbCount = require('callback-count');
var stream = require('stream');
var listener = require('../lib/listener.js');
var docker = require('./fixtures/docker-mock.js');
var ip = require('ip');
var debug = require('debug')('test-listener');

describe('listener', function () {
  var ctx = {};


  it('should fail to start when publisher is not writable', function (done) {
    try {
      listener.start(new stream.Stream(), function () {});
      done('Should fail');
    } catch (err) {
      expect(err.message).to.equal('publisher stream should be Writable');
      done();
    }
  });

  it('should fail to start when publisher is Readable', function (done) {
    try {
      listener.start(new stream.Readable(), function () {});
      done('Should fail');
    } catch (err) {
      expect(err.message).to.equal('publisher stream should be Writable');
      done();
    }
  });

  describe('re-start docker', function () {
    beforeEach(function (done) {
      process.env.AUTO_RECONNECT = 'true';
      ctx.docker = docker.start(done);
    });

    afterEach(function (done) {
      process.env.AUTO_RECONNECT = 'false';
      ctx.docker.stop(done);
    });

    afterEach(function (done) {
      listener.stop(done);
    });

    // receive 4 good events.
    // stop docker and receive docker_daemon_down event
    // start docker and receive docker_daemon_up
    // receive good events for the rest
    it('should handle case when docker was working and than down for some time', function (done) {
      var count = cbCount(10, done);
      var ws = new stream.Stream();
      ws.writable = true;
      var messagesCounter = 0;
      ws.write = function (data) {
        /*jshint maxcomplexity:7 */
        if (messagesCounter === 0) {
          expect(data.status).to.equal('docker_daemon_up');
        }
        // after 4 messages just restart the docker
        if (messagesCounter === 4) {
          restartDocker(ctx);
        }
        if (messagesCounter === 5) {
          expect(data.status).to.equal('docker_daemon_down');
        }
        if (messagesCounter === 6) {
          expect(data.status).to.equal('docker_daemon_up');
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
        /*jshint +W030 */
        messagesCounter++;
        if (messagesCounter < 11) {
          count.next();
        }
      };
      ws.end = function () {
        debug('disconnect');
      };
      listener.start(ws, function () {});
    });
  });

  describe('close', function () {

    beforeEach(function (done) {
      ctx.docker = docker.start(done);
    });

    afterEach(function (done) {
      ctx.docker.stop(done);
    });

    afterEach(function (done) {
      listener.stop(done);
    });


    it('should stop receiving events after close was called', function (done) {
      var ws = new stream.Stream();
      ws.writable = true;
      var messagesCounter = 0;
      ws.write = function () {
        if (messagesCounter === 8) {
          listener.stop(function () {
            setTimeout(function () {
              // check that messageCounter === 9
              // we didn't received any new messages after stop was called
              if (messagesCounter === 9) {
                done();
              }
              else {
                done(new Error('Streaming never stopped'));
              }
            }, 500);
          });
        }
        messagesCounter++;
      };
      ws.end = function () {
        debug('disconnect');
      };
      listener.start(ws, function () {});
    });

  });


});

function restartDocker (ctx) {
  ctx.docker.stop(function(){
    setTimeout(function () {
      ctx.docker = docker.start(function () {});
    }, 1000);
  });
}