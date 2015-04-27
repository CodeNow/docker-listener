/**
 * @module test/publisher
 */
'use strict';

require('loadenv')('docker-listener:test');
var Code = require('code');
var Lab = require('lab');
var cbCount = require('callback-count');

var status = require('../lib/status');
var publisher = require('../lib/publisher')();
var redis = require('./fixtures/redis')();

var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;
var afterEach = lab.afterEach;

describe('redis publisher', function () {

  afterEach(function (done) {
    redis.punsubscribe('runnable:docker:*');
    done();
  });

  it('should publish data to the redis', function (done) {
    var count = cbCount(2, function () {
      expect(status.env).to.equal('test');
      expect(status.count_events).to.equal(2);
      // ignore minutes/seconds and millis
      expect(status.last_event_time.substring(0,15))
        .to.equal(new Date().toISOString().substring(0,15));
      done();
    });
    var Readable = require('stream').Readable;
    redis.psubscribe('runnable:docker:*');
    redis.on('pmessage', function (pattern, channel, message) {
      var json = JSON.parse(message.toString());
      expect(json.status).to.be.a.string();
      expect(json.ip).to.be.a.string();
      expect(json.host).to.be.a.string();
      expect(json.uuid).to.be.a.string();
      count.next();
    });
    var rs = new Readable();
    rs.push(JSON.stringify({status: 'die'}));
    rs.push(JSON.stringify({status: 'start'}));
    rs.push(null);
    rs.pipe(publisher);
  });
});
