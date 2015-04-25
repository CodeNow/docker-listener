/**
 * @module test/app
 */
'use strict';

require('loadenv')('docker-listener:test');
var Code = require('code');
var Lab = require('lab');
var supertest = require('supertest');
var stream = require('stream');
var noop = require('101/noop');

var app = require('../lib/app');
var docker = require('./fixtures/docker-mock');
var Listener = require('../lib/listener');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;

describe('route tests', function () {
  describe('GET', function () {
    it('should return app info on /', function (done) {
      supertest(app)
        .get('/')
        .end(function (err, res) {
          if(err) {
            return done(err);
          }
          expect(res.body.message).to.equal('runnable docker-listener');
          done();
        });
    });

    it('should return status info on /status', function (done) {
      supertest(app)
        .get('/status')
        .end(function (err, res) {
          if(err) {
            return done(err);
          }
          var body = res.body;
          expect(body.docker_connected).to.equal(false);
          expect(body.count_events).to.equal(0);
          expect(body.env).to.equal('test');
          expect(body.last_event_time).to.equal(null);
          done();
        });
    });

    describe('status should be updated after connection to docker is made', function () {
      var ctx = {};
      beforeEach(function (done) {
        process.env.AUTO_RECONNECT = 'false';
        var ws = new stream.Stream();
        ws.writable = true;
        ws.write = noop;
        ws.end = noop;
        ctx.ws = ws;
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
      it('should return updated status info on /status', function (done) {
        ctx.listener = new Listener(ctx.ws);
        ctx.listener.start();
        // NOTE: listener should emit event when it started.
        setTimeout(function () {
          supertest(app)
            .get('/status')
            .end(function (err, res) {
              if(err) {
                return done(err);
              }
              var body = res.body;
              expect(body.docker_connected).to.equal(true);
              expect(body.count_events).to.equal(0);
              expect(body.env).to.equal('test');
              expect(body.last_event_time).to.equal(null);
              done();
            });
        }, 300);
      });
    });

    it('should fail on /fake', function (done) {
      supertest(app)
        .get('/fake')
        .expect(404)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          expect(res.body.message).to.equal('route not implemented');
          done();
        });
    });
  });
});
