'use strict';
var Code = require('code');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.experiment;
var it = lab.test;
var expect = Code.expect;
var beforeEach = lab.beforeEach;


var cbCount = require('callback-count');
var stream = require('stream');
var listener = require('../lib/listener.js');
var docker = require('./fixtures/docker-mock.js');
var ip = require('ip');

describe('listener', function () {
  var ctx = {};


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

  it('should fail to start when reporter is not writable', function (done) {
    try {
      listener.start(new stream.Writable(), new stream.Stream());
      done('Should fail');
    } catch (err) {
      expect(err.message).to.equal('reporter stream should be Writable');
      done();
    }
  });

  describe('re-start docker', function () {
    beforeEach(function (done) {
      process.env.AUTO_RECONNECT = 'true';
      ctx.docker = docker.start(done);
    });

    function restartDocker (ctx) {
      ctx.docker.stop(function(){
        console.log('closed docker');
        setTimeout(function () {
          ctx.docker = docker.start(function () {
            console.log('docker is up again');
          });
        }, 1000);
      });
    }
    // receive 4 good events.
    // stop docker and receive docker_daemon_down event
    // start docker and receive docker_daemon_up
    // receive good events for the rest
    it('should handle case when docker was working and than down for some time', function (done) {
      var count = cbCount(10, function () {
        process.env.AUTO_RECONNECT = 'false';
        ctx.docker.stop(function () {
          done();
        });
      });
      var ws = new stream.Stream();
      ws.writable = true;
      var messagesCounter = 0;
      ws.write = function (data) {
        /*jshint maxcomplexity:7 */
        var json = JSON.parse(data.toString());
        if (messagesCounter === 0) {
          expect(json.status).to.equal('docker_daemon_up');
        }
        // after 4 messages just restart the docker
        if (messagesCounter === 4) {
          restartDocker(ctx);
        }
        if (messagesCounter === 5) {
          expect(json.status).to.equal('docker_daemon_down');
        }
        if (messagesCounter === 6) {
          expect(json.status).to.equal('docker_daemon_up');
        }
        if (json.host) {
          var host = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
          expect(json.host).to.equal(host);
        }
        /*jshint -W030 */
        expect(json.status).to.be.String;
        expect(json.id).to.be.String;
        expect(json.host).to.be.String;
        expect(json.uuid).to.be.String;
        expect(json.from).to.be.String;
        expect(json.time).to.be.Number;
        /*jshint +W030 */
        messagesCounter++;
        if (messagesCounter < 11) {
          count.next();
        }
      };
      ws.end = function () {
        console.log('disconnect');
      };
      listener.start(ws, process.stdout);
    });
  });
});