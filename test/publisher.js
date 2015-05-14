/**
 * @module test/publisher
 */
'use strict';

require('loadenv')('docker-listener:test');
var Code = require('code');
var Lab = require('lab');
var cbCount = require('callback-count');
var hermesClient = require('../lib/hermes-client');
var sinon = require('sinon');

var lab = exports.lab = Lab.script();

var afterEach = lab.afterEach;
var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;
var beforeEach = lab.beforeEach;

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
    var count = cbCount(2, done);
    var Readable = require('stream').Readable;
    redis.on('pmessage', function (pattern, channel, message) {
      var json = message.toString();
      /*jshint -W030 */
      expect(json.status).to.be.String;
      expect(json.ip).to.be.String;
      expect(json.host).to.be.String;
      expect(json.uuid).to.be.String;
      /*jshint +W030 */
      count.next();
    });
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
    rs.push(JSON.stringify({
      status: 'create',
      inspectData: {
        Config: {
          Labels: {
            type: 'user-container'
          }
        }
      }
    }));
    rs.push(null);
    rs.pipe(publisher);
  });
});
