'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var Code = require('code');
var expect = Code.expect;

var ip = require('ip');

var Publisher = require('../../lib/publisher.js');

describe('publisher.js unit test', function () {
  describe('createRoutingKey', function () {
    beforeEach(function (done) {
      process.env.HOST_TAGS = 'testOrg,run.build';
      done();
    });

    afterEach(function (done) {
      delete process.env.HOST_TAGS;
      done();
    });

    it('should return correct key', function (done) {
      expect(Publisher.createRoutingKey())
        .to.equal('testOrg.' + ip.address().replace('.', '-'));
      done();
    });
  }); // end createRoutingKey
}); // end publisher.js unit test