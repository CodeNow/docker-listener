/**
 * @module test/listener
 */
'use strict';

require('loadenv')({ debugName: 'docker-listener' });
var Code = require('code');
var Lab = require('lab');
var cbCount = require('callback-count');
var ip = require('ip');
var stream = require('stream');
var noop = require('101/noop');
var errorCat = require('error-cat');

var sinon = require('sinon');
var docker = require('./fixtures/docker-mock');
var Listener = require('../lib/listener');
var status = require('../lib/status');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;

describe('listener', {timeout: 10000}, function () {
  beforeEach(function (done) {
    sinon.stub(errorCat.prototype, 'createAndReport');
    done();
  });
  afterEach(function (done) {
    errorCat.prototype.createAndReport.restore();
    done();
  });
  var ctx = {};
  it('should fail to start when publisher is not writable', function (done) {
    try {
      ctx.listener = new Listener(new stream.Stream());
      done('Should fail');
    } catch (err) {
      expect(err.message).to.equal('publisher stream should be Writable');
      done();
    }
  });

  it('should fail to start when publisher is Readable', function (done) {
    try {
      ctx.listener = new Listener(new stream.Readable());
      done('Should fail');
    } catch (err) {
      expect(err.message).to.equal('publisher stream should be Writable');
      done();
    }
  });

  describe('re-start docker', function () {
    var ctx = {};
    beforeEach(function (done) {
      process.env.AUTO_RECONNECT = 'true';
      ctx.docker = docker.start(done);
    });

    afterEach(function (done) {
      process.env.AUTO_RECONNECT = 'false';
      ctx.docker.stop(done);
    });

    afterEach(function (done) {
      ctx.listener.stop();
      done();
    });

    // receive 4 good events.
    // stop docker and receive docker.events-stream.disconnected event
    // start docker and receive docker.events-stream.connected
    // receive good events for the rest
    it('should handle case when docker was working and than down for some time', function (done) {
      var count = cbCount(10, done);
      var ws = new stream.Stream();
      ws.writable = true;
      var messagesCounter = 0;
      /*jshint maxcomplexity:12 */
      ws.write = function (data) {
        if (typeof data === 'string') {
          data = JSON.parse(data);
        } else {
          data = JSON.parse(data.toString());
        }
        if (messagesCounter === 0) {
          expect(data.status).to.equal('docker.events-stream.connected');
        }
        // after 4 messages just restart the docker
        if (messagesCounter === 4) {
          restartDocker(ctx);
        }
        if (messagesCounter === 5) {
          expect(data.status).to.equal('docker.events-stream.disconnected');
        }
        if (messagesCounter === 6) {
          expect(data.status).to.equal('docker.events-stream.connected');
        }
        if (data.host) {
          var host = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
          expect(data.host).to.equal(host);
          expect(data.host).to.be.a.string();
        }
        expect(data.status).to.be.a.string();
        if (data.id) {
          expect(data.id).to.be.a.string();
        }
        if (data.from) {
          expect(data.from).to.be.a.string();
        }
        if (data.uuid) {
         expect(data.uuid).to.be.a.string();
        }
        expect(data.time).to.be.a.number();
        messagesCounter++;
        if (messagesCounter < 11) {
          count.next();
        }
      };
      ws.end = noop;
      ctx.listener = new Listener(ws);
      ctx.listener.start();
    });
  });

  describe('close', function () {
    var ctx = {};
    beforeEach(function (done) {
      ctx.docker = docker.start(done);
    });

    afterEach(function (done) {
      ctx.docker.stop(done);
    });

    afterEach(function (done) {
      ctx.listener.stop();
      done();
    });

    it('should stop receiving events after close was called', function (done) {
      var ws = new stream.Stream();
      ws.writable = true;
      var messagesCounter = 0;
      ws.write = function () {
        if (messagesCounter === 8) {
          ctx.listener.stop();
          setTimeout(function () {
            // check that messageCounter === 9
            // we didn't received any new messages after stop was called
            if (messagesCounter === 9) {
              expect(status.docker_connected).to.equal(false);
              done();
            }
            else {
              done(new Error('Streaming never stopped'));
            }
          }, 500);
        }
        messagesCounter++;
      };
      ws.end = noop;
      ctx.listener = new Listener(ws);
      ctx.listener.start();
    });

  });

});

function restartDocker (ctx) {
  ctx.docker.stop(function(){
    setTimeout(function () {
      ctx.docker = docker.start(noop);
    }, 1000);
  });
}
