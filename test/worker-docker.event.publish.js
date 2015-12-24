/**
 * @module test/publisher
 */
'use strict';

require('loadenv')({ debugName: 'docker-listener' });
var Code = require('code');
var Lab = require('lab');


var DockerEventPublish = require('../lib/workers/docker.event.publish.js');
var sinon = require('sinon');
var ip = require('ip');

var lab = exports.lab = Lab.script();

var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;

var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;

describe('docker event publish', function () {
  describe('_createRoutingKey', function () {
    beforeEach(function (done) {
      process.env.HOST_TAGS = 'testOrg,run.build';
      done();
    });

    afterEach(function (done) {
      delete process.env.HOST_TAGS;
      done();
    });

    it('should return correct key', function (done) {
      expect(DockerEventPublish._createRoutingKey())
        .to.equal('testOrg.' + ip.address().replace('.', '-'));
      done();
    });
  });

});
