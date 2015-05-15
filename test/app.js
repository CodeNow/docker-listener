/**
 * @module test/app
 */
'use strict';

require('loadenv')('docker-listener:test');
var Code = require('code');
var Lab = require('lab');
var supertest = require('supertest');
var rewire = require('rewire');

var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;

describe('route tests', function () {
  describe('GET', function () {
    it('should return app info on /', function (done) {
      var app = require('../lib/app.js');
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

    it('should fail on /fake', function (done) {
      var app = require('../lib/app.js');
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

    it('should not instantiate hermes if no RABBITMQ_HOSTNAME environemntal', function (done) {
      var temp = process.env.RABBITMQ_HOSTNAME;
      delete process.env.RABBITMQ_HOSTNAME;
      var hermes = rewire('../lib/hermes-client');
      expect(hermes.publish).to.be.a.function();
      expect(Object.keys(hermes).length).to.equal(1);
      process.env.RABBITMQ_HOSTNAME = temp;
      done();
    });

  });
});
