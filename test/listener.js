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


describe('listener', function () {
  var ctx = {};


  it('should fail to connect if docker is down', function (done) {
    var count = cbCount(2, done);
    var reporter = new stream.Stream();
    reporter.writable = true;
    reporter.write = function (data) {
      expect(data.toString()).to.equal('cannot connect to the docker');
      count.next();
    };
    listener.start(process.stdin, reporter);
  });

  it('should fail to start when publisher is not writable', function (done) {
    try {
      listener.start(new stream.Stream());
      done('Should fail');
    } catch (err) {
      expect(err.message).to.equal('Publisher should be Writable');
      done();
    }
  });

  it('should fail to start when reporter is not writable', function (done) {
    try {
      listener.start(process.stdout, new stream.Stream());
      done('Should fail');
    } catch (err) {
      expect(err.message).to.equal('Reporter should be Writable');
      done();
    }
  });

  describe('with writabe', function () {
    beforeEach(function (done) {
      ctx.docker = docker.start(done);
    });

    it('should work when publisher is Writable', function (done) {
      var count = cbCount(10, function () {
        done();
        ctx.docker.stop();
      });
      var ws = new stream.Stream();
      ws.writable = true;
      ws.write = function (data) {
        var json = JSON.parse(data.toString());
        expect(json.status).to.be.String;
        expect(json.id).to.be.String;
        expect(json.from).to.be.String;
        expect(json.time).to.be.Number;
        count.next();
      };
      listener.start(ws);
    });
  });

  // describe('stop and start docker', function () {
  //   beforeEach(function (done) {
  //     ctx.docker = docker.start(done);
  //   });

  //   it('should handle case when docker was down for sometime', function (done) {
  //     var count = cbCount(20, function () {
  //       // done();
  //       // ctx.docker.stop();
  //     });
  //     var ws = new stream.Stream();
  //     ws.writable = true;
  //     ws.write = function (data) {
  //       var json = JSON.parse(data.toString());
  //       console.log('nnn', json.status)
  //       expect(json.status).to.be.String;
  //       expect(json.id).to.be.String;
  //       expect(json.from).to.be.String;
  //       expect(json.time).to.be.Number;
  //       count.next();
  //     };
  //     listener.start(ws, process.stdout);
  //     setTimeout(function() {
  //       console.log('closed docker from test');
  //       ctx.docker.stop();
  //     }, 400);
  //   });
  // });



});