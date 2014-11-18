'use strict';
var Code = require('code');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.experiment;
var it = lab.test;
var expect = Code.expect;
var beforeEach = lab.beforeEach;



var cbCount = require('callback-count');
var stream = require('stream');
var listener = require('../lib/listener.js');
var docker = require('./fixtures/docker-mock.js');


describe('listener', function () {
  var ctx = {};

  describe('re-start docker', function () {
    beforeEach(function (done) {
      process.env.AUTO_RECONNECT = 'true';
      ctx.docker = docker.start(done);
    });


    it('should handle case when docker was working and than down for some time', function (done) {
      var count = cbCount(10, function () {
        process.env.AUTO_RECONNECT = 'false';
        ctx.docker.stop(function () {
          done();
        });
      });
      var ws = new stream.Stream();
      ws.writable = true;
      var messagesCounter = 0;
      ws.write = function (data) {
        var json = JSON.parse(data.toString());
        console.log('message', json);
        if (messagesCounter !== 4) {
          if (messagesCounter === 5) {
            expect(json.status).to.equal('docker_down');
          }
          /*jshint -W030 */
          expect(json.status).to.be.String;
          expect(json.id).to.be.String;
          expect(json.from).to.be.String;
          expect(json.time).to.be.Number;
          /*jshint +W030 */
        } else {
          ctx.docker.stop(function(){
            console.log('closed docker');
            setTimeout(function () {
              ctx.docker = docker.start(function () {
                console.log('docker is up again');
              });
            }, 1000);
          });
        }
        messagesCounter++;
        if (messagesCounter < 11) {
          count.next();
        }
      };
      ws.end = function () {
        console.log('disconnect');
      };
      listener.start(ws, process.stdout);
    });
  });



});