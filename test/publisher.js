'use strict';
var Code = require('code');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.experiment;
var it = lab.test;
var expect = Code.expect;


var cbCount = require('callback-count');
var publisher = require('../lib/publisher')();
var redis = require('./fixtures/redis')();

describe('redis publisher', function () {

  it('should publish data to the redis', function (done) {
    var count = cbCount(2, done);
    var Readable = require('stream').Readable;
    redis.psubscribe('runnable:docker:*');
    redis.on('pmessage', function (pattern, channel, message) {
      var json = message.toString();
      /*jshint -W030 */
      expect(json.status).to.be.String;
      /*jshint +W030 */
      count.next();
    });
    var rs = new Readable();
    rs.push(JSON.stringify({status: 'die'}));
    rs.push(JSON.stringify({status: 'start'}));
    rs.push(null);
    rs.pipe(publisher);
  });

});