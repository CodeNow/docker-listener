/**
 * @module test/app
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })
var Code = require('code')
var Lab = require('lab')
var supertest = require('supertest')

var app = require('../../lib/app')
var status = require('../../lib/status')

var lab = exports.lab = Lab.script()

var describe = lab.experiment
var expect = Code.expect
var it = lab.test

describe('route tests', function () {
  it('should return app info on /', function (done) {
    supertest(app)
      .get('/')
      .end(function (err, res) {
        if (err) {
          return done(err)
        }
        expect(res.body.message).to.equal('runnable docker-listener')
        done()
      })
  })

  it('should return status info on /status', function (done) {
    supertest(app)
      .get('/status')
      .end(function (err, res) {
        if (err) {
          return done(err)
        }
        var body = res.body
        expect(body.docker_connected).to.equal(false)
        expect(body.count_events).to.equal(0)
        expect(body.env).to.equal('test')
        expect(body.last_event_time).to.equal(null)
        done()
      })
  })

  it('should return 404 on /health-check initially', function (done) {
    supertest(app)
      .get('/health-check')
      .end(function (err, res) {
        if (err) {
          return done(err)
        }
        expect(res.statusCode).to.equal(404)
        done()
      })
  })

  it('should fail on /fake', function (done) {
    supertest(app)
      .get('/fake')
      .expect(404)
      .end(function (err, res) {
        if (err) {
          return done(err)
        }
        expect(res.body.message).to.equal('route not implemented')
        done()
      })
  })

  it('should return status', function (done) {
    status.docker_connected = true
    status.count_events = 3
    status.env = 'test'
    status.last_event_time = Date.now()
    supertest(app)
      .get('/status')
      .end(function (err, res) {
        if (err) { return done(err) }
        var body = res.body
        expect(body).to.deep.equal(status)
        done()
      })
  })

  it('should return 204 if connected', function (done) {
    status.docker_connected = true
    supertest(app)
      .get('/health-check')
      .end(function (err, res) {
        if (err) { return done(err) }
        expect(res.statusCode).to.equal(204)
        done()
      })
  })

  it('should return 404 if not connected', function (done) {
    status.docker_connected = false
    supertest(app)
      .get('/health-check')
      .end(function (err, res) {
        if (err) { return done(err) }
        expect(res.statusCode).to.equal(404)
        done()
      })
  })
})
