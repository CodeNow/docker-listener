/**
 * @module test/app
 */
'use strict';

require('loadenv')('docker-listener:test');
var Code = require('code');
var Lab = require('lab');
var supertest = require('supertest');

var app = require('../lib/app');

var lab = exports.lab = Lab.script();

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
