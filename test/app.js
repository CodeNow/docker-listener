'use strict';
var Code = require('code');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.experiment;
var it = lab.test;
var expect = Code.expect;

var supertest = require('supertest');

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

  });
});