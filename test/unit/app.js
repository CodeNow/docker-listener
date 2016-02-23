/**
 * @module test/app
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })
var Code = require('code')
var cbCount = require('callback-count')
var Lab = require('lab')
var supertest = require('supertest')
var stream = require('stream')
var noop = require('101/noop')

var app = require('../../lib/app')
var docker = require('../fixtures/docker-mock')
var Listener = require('../../lib/listener')

var lab = exports.lab = Lab.script()

var afterEach = lab.afterEach
var beforeEach = lab.beforeEach
var describe = lab.experiment
var expect = Code.expect
var it = lab.test

describe('route tests', function () {
  describe('GET', function () {
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

    describe('status should be updated after connection to docker is made', function () {
      var ctx = {}
      beforeEach(function (done) {
        var ws = new stream.Writable()
        ws._write = noop
        ctx.ws = ws
        ctx.docker = docker.start(done)
      })

      afterEach(function (done) {
        ctx.listener.removeAllListeners()
        ctx.listener.stop()
        delete ctx.listener
        ctx.docker.stop(done)
      })

      it('should return updated status info on /status after listener started', function (done) {
        ctx.listener = new Listener(ctx.ws)
        ctx.listener.start()
        var callbackCount = cbCount(2, done)
        ctx.listener.on('started', function () {
          supertest(app)
            .get('/status')
            .end(function (err, res) {
              if (err) {
                return done(err)
              }
              var body = res.body
              expect(body.docker_connected).to.equal(true)
              expect(body.count_events).to.equal(0)
              expect(body.env).to.equal('test')
              expect(body.last_event_time).to.equal(null)
              callbackCount.next()
            })
          supertest(app)
            .get('/health-check')
            .end(function (err, res) {
              if (err) {
                return done(err)
              }
              expect(res.statusCode).to.equal(204)
              callbackCount.next()
            })
        })
      })

      it('should return updated status info on /status after listener started&stopped',
        function (done) {
          var callbackCount = cbCount(4, done)
          ctx.listener = new Listener(ctx.ws)
          ctx.listener.once('stopped', function () {
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
                callbackCount.next()
              })
            supertest(app)
              .get('/health-check')
              .end(function (err, res) {
                if (err) {
                  return done(err)
                }
                expect(res.statusCode).to.equal(404)
                callbackCount.next()
              })
          })
          ctx.listener.on('started', function () {
            supertest(app)
              .get('/status')
              .end(function (err, res) {
                if (err) {
                  return done(err)
                }
                var body = res.body
                expect(body.docker_connected).to.equal(true)
                expect(body.count_events).to.equal(0)
                expect(body.env).to.equal('test')
                expect(body.last_event_time).to.equal(null)
                ctx.listener.stop()
                callbackCount.next()
              })
            supertest(app)
              .get('/health-check')
              .end(function (err, res) {
                if (err) {
                  return done(err)
                }
                expect(res.statusCode).to.equal(204)
                callbackCount.next()
              })
          })
          ctx.listener.start()
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
  })
})
