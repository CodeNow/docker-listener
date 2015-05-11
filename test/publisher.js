/**
 * @module test/publisher
 */
'use strict';

require('loadenv')('docker-listener:test');
var Code = require('code');
var Lab = require('lab');
var cbCount = require('callback-count');


var status = require('../lib/status');
var Publisher = require('../lib/publisher');
var redis = require('./fixtures/redis')();

var hermesClient = require('../lib/hermes-client');
var sinon = require('sinon');


var lab = exports.lab = Lab.script();

var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;

var redis,
    publisher;
describe('redis publisher', function () {

  beforeEach(function (done) {
    publisher = require('../lib/publisher')();
    redis = require('./fixtures/redis')();
    redis.psubscribe('runnable:docker:*');
    done();
  });

  afterEach(function (done) {
    if(hermesClient.publish.restore) {
      hermesClient.publish.restore();
    }
    redis.punsubscribe('runnable:docker:*');
    redis.unsubscribe('pmessage');

    done();
  });

  it('should publish data to the redis', function (done) {
    var publisher = new Publisher();
    var count = cbCount(2, function () {
      expect(status.env).to.equal('test');
      expect(status.count_events).to.equal(2);
      // ignore minutes/seconds and millis
      expect(new Date().getTime()).to.be.about(
        new Date(status.last_event_time).getTime(), 2000);
      done();
    });
    redis.psubscribe('runnable:docker:*');
    redis.on('pmessage', function (pattern, channel, message) {
      var json = JSON.parse(message.toString());
      expect(json.status).to.be.a.string();
      expect(json.ip).to.be.a.string();
      expect(json.host).to.be.a.string();
      expect(json.uuid).to.be.a.string();
      count.next();
    });
    var Readable = require('stream').Readable;
    var rs = new Readable();
    rs.push(JSON.stringify({status: 'die'}));
    rs.push(JSON.stringify({status: 'start'}));
    rs.push(null);
    rs.pipe(publisher);
  });

  it('should insert message into rabbitmq queue upon docker contain create event', function (done) {
    sinon.stub(hermesClient, 'publish', function () {
      expect(hermesClient.publish.callCount).to.equal(1);
      done();
    });
    var Readable = require('stream').Readable;
    var rs = new Readable();
    rs.push(JSON.stringify({status: 'create'}));
    rs.push(null);
    rs.pipe(publisher);
  });
});
