'use strict';
var Code = require('code');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.experiment;
var it = lab.test;
var expect = Code.expect;

var events = require('../lib/events');
var ip = require('ip');

describe('events#enhanceEvent', function () {

  it('should add ip, uuid, host, time', function (done) {
    var original = {
      id: 'some-id'
    };
    var currDate = Date.now();
    var enhanced = events.enhanceEvent(original);
    expect(enhanced.time).to.be.at.least(currDate);
    expect(enhanced.uuid).to.exist();
    expect(enhanced.ip).to.equal(ip.address());
    var host = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
    expect(enhanced.host).to.equal(host);
    done();
  });

  it('should not change time if exist', function (done) {
    var original = {
      id: 'some-id',
      time: Date.now() - 1000
    };
    var enhanced = events.enhanceEvent(original);
    expect(enhanced.time).to.equal(original.time);
    expect(enhanced.uuid).to.exist();
    expect(enhanced.ip).to.equal(ip.address());
    var host = 'http://' + ip.address() + ':' + process.env.DOCKER_REMOTE_API_PORT;
    expect(enhanced.host).to.equal(host);
    done();
  });

});