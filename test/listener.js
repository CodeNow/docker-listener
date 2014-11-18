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


describe('listener', function () {
  var ctx = {};


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

  // describe('with writabe', function () {
  //   beforeEach(function (done) {
  //     process.env.AUTO_RECONNECT = 'true';
  //     ctx.docker = docker.start(done);
  //   });

  //   it('should work when publisher is Writable', function (done) {
  //     var count = cbCount(10, function () {
  //       process.env.AUTO_RECONNECT = 'false';
  //       ctx.docker.stop(done);
  //     });
  //     var ws = new stream.Stream();
  //     ws.writable = true;
  //     ws.write = function (data) {
  //       var json = JSON.parse(data.toString());
  //       /*jshint -W030 */
  //       expect(json.status).to.be.String;
  //       expect(json.id).to.be.String;
  //       expect(json.from).to.be.String;
  //       expect(json.time).to.be.Number;
  //       /*jshint -W030 */
  //       count.next();
  //     };
  //     ws.end = function () {
  //       console.log('disconnect');
  //     };
  //     listener.start(ws);
  //   });
  // });

  // describe('start docker', function () {
  //   beforeEach(function (done) {
  //     process.env.AUTO_RECONNECT = 'true';
  //     ctx.docker = docker.start(done);
  //   });


  //   it('should handle case when docker was down for sometime', function (done) {
  //     var count = cbCount(20, function () {
  //       process.env.AUTO_RECONNECT = 'false';
  //       ctx.docker.stop(done);
  //     });
  //     var reconnectCount = cbCount(3, function () {
  //       ctx.docker = docker.start(function () {});
  //     });
  //     var reporter = new stream.Stream();
  //     reporter.writable = true;
  //     reporter.write = function (data) {
  //       expect(data.toString()).to.equal('cannot connect to the docker');
  //       reconnectCount.next();
  //     };
  //     var ws = new stream.Stream();
  //     ws.writable = true;
  //     ws.write = function (data) {
  //       var json = JSON.parse(data.toString());
  //       /*jshint -W030 */
  //       expect(json.status).to.be.String;
  //       expect(json.id).to.be.String;
  //       expect(json.from).to.be.String;
  //       expect(json.time).to.be.Number;
  //       /*jshint +W030 */
  //       count.next();
  //     };
  //     ws.end = function () {
  //       console.log('disconnect');
  //     };
  //     listener.start(ws, reporter);
  //   });
  // });
});