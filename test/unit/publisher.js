/**
 * @module test/publisher
 */
'use strict'

require('loadenv')({ debugName: 'docker-listener' })
var Code = require('code')
var Lab = require('lab')

var Readable = require('stream').Readable

var status = require('../../lib/status')
var Publisher = require('../../lib/publisher')
var rabbitmq = require('../../lib/rabbitmq')
var sinon = require('sinon')

var lab = exports.lab = Lab.script()

var describe = lab.experiment
var expect = Code.expect
var it = lab.test

describe('rabbit publisher', function () {
  it('should insert message into rabbitmq queue upon docker contain create event', function (done) {
    var publisher = new Publisher()
    sinon.stub(rabbitmq, 'publish', function () {
      expect(rabbitmq.publish.callCount).to.equal(1)
      rabbitmq.publish.restore()
      expect(status.env).to.equal('test')
      expect(status.count_events).to.equal(1)
      // ignore minutes/seconds and millis
      expect(new Date().getTime()).to.be.about(new Date(status.last_event_time).getTime(), 2000)
      done()
    })
    var rs = new Readable()
    rs.push(JSON.stringify({
      status: 'create',
      from: 'weaveworks/weave:1.2.0',
      inspectData: {
        Config: {
          Labels: {
            type: 'user-container'
          }
        }
      }
    }))
    rs.push(null)
    rs.pipe(publisher)
  })
  it('should insert message into rabbitmq for the image builder container start', function (done) {
    var publisher = new Publisher()
    sinon.stub(rabbitmq, 'publish', function () {
      expect(rabbitmq.publish.callCount).to.equal(1)
      rabbitmq.publish.restore()
      expect(status.env).to.equal('test')
      expect(status.count_events).to.equal(2)
      // ignore minutes/seconds and millis
      expect(new Date().getTime()).to.be.about(new Date(status.last_event_time).getTime(), 2000)
      done()
    })
    var rs = new Readable()
    rs.push(JSON.stringify({
      from: 'weaveworks/weave:1.2.0',
      status: 'create',
      inspectData: {
        Config: {
          Labels: {
            type: 'image-builder-container'
          }
        }
      }
    }))
    rs.push(null)
    rs.pipe(publisher)
  })
  it('should do nothing if event was from blacklisted container', function (done) {
    var publisher = new Publisher()
    publisher.on('finish', function () {
      expect(rabbitmq.publish.callCount).to.equal(0)
      rabbitmq.publish.restore()
      done()
    })
    sinon.spy(rabbitmq, 'publish')
    var rs = new Readable()
    rs.push(JSON.stringify({
      from: 'weaveworks/weaveexec:1.2.0',
      status: 'create',
      inspectData: {
        Config: {
          Labels: {
            type: 'image-builder-container'
          }
        }
      }
    }))
    rs.push(null)
    rs.pipe(publisher)
  })
})
