/**
 * @module test/publisher
 */
'use strict';

require('loadenv')({ debugName: 'docker-listener' });
var Code = require('code');
var Lab = require('lab');

var Readable = require('stream').Readable;

var Publisher = require('../lib/publisher');

var hermesClient = require('../lib/hermes-client');
var sinon = require('sinon');


var lab = exports.lab = Lab.script();

var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;

describe('rabbit publisher', function () {

  it('should insert message into rabbitmq queue upon docker contain create event', function (done) {
    var publisher = new Publisher();
    sinon.stub(hermesClient, 'publish', function () {
      expect(hermesClient.publish.callCount).to.equal(1);
      hermesClient.publish.restore();
      done();
    });
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
  it('should insert message into rabbitmq for the image builder container start', function (done) {
    var publisher = new Publisher();
    sinon.stub(hermesClient, 'publish', function () {
      expect(hermesClient.publish.callCount).to.equal(1);
      hermesClient.publish.restore();
      done();
    });
    var rs = new Readable();
    rs.push(JSON.stringify({
      status: 'create',
      inspectData: {
        Config: {
          Labels: {
            type: 'image-builder-container'
          }
        }
      }
    }));
    rs.push(null);
    rs.pipe(publisher);
  });
});
