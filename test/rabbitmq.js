// 'use strict';
//
// var Lab = require('lab');
// var lab = exports.lab = Lab.script();
// var describe = lab.describe;
// var it = lab.it;
// var Code = require('code');
// var expect = Code.expect;
//
// var Hermes = require('runnable-hermes');
// var sinon = require('sinon');
//
//
// var rabbitmq = require('../lib/rabbitmq.js');
//
// describe('rabbitmq.js unit test', function () {
//   describe('close', function () {
//     it('should do nothing if it was not connected', function (done) {
//       sinon.stub(Hermes.prototype, 'close').yields(null);
//       rabbitmq.close(function (err) {
//         expect(err).to.be.undefined();
//         expect(Hermes.prototype.close.called).to.be.false();
//         Hermes.prototype.close.restore();
//         done();
//       });
//     });
//     it('should call hermes close', function (done) {
//       sinon.stub(Hermes.prototype, 'connect').yields(null);
//       sinon.stub(Hermes.prototype, 'close').yields(null);
//       rabbitmq.connect(function (err) {
//         expect(err).to.be.null();
//         expect(Hermes.prototype.connect.calledOnce).to.be.true();
//         Hermes.prototype.connect.restore();
//         rabbitmq.close(function (err) {
//           expect(err).to.be.null();
//           expect(Hermes.prototype.close.calledOnce).to.be.true();
//           Hermes.prototype.close.restore();
//           done();
//         });
//       });
//     });
//     it('should fail if hermes connect failed', function (done) {
//       sinon.stub(Hermes.prototype, 'connect').yields(null);
//       sinon.stub(Hermes.prototype, 'close').yields(new Error('Hermes error'));
//       rabbitmq.connect(function (err) {
//         expect(err).to.be.null();
//         expect(Hermes.prototype.connect.calledOnce).to.be.true();
//         Hermes.prototype.connect.restore();
//         rabbitmq.close(function (err) {
//           expect(err).to.exist();
//           expect(err.message).to.equal('Hermes error');
//           expect(Hermes.prototype.close.calledOnce).to.be.true();
//           Hermes.prototype.close.restore();
//           done();
//         });
//       });
//     });
//   });
//   describe('connect', function () {
//     it('should call hermes connect', function (done) {
//       sinon.stub(Hermes.prototype, 'connect').yields(null);
//       rabbitmq.connect(function (err) {
//         expect(err).to.be.null();
//         expect(Hermes.prototype.connect.calledOnce).to.be.true();
//         Hermes.prototype.connect.restore();
//         done();
//       });
//     });
//     it('should fail if hermes connect failed', function (done) {
//       sinon.stub(Hermes.prototype, 'connect').yields(new Error('Hermes error'));
//       rabbitmq.connect(function (err) {
//         expect(err).to.exist();
//         expect(err.message).to.equal('Hermes error');
//         expect(Hermes.prototype.connect.calledOnce).to.be.true();
//         Hermes.prototype.connect.restore();
//         done();
//       });
//     });
//   });
//   describe('on error', function () {
//     it('should call _handleFatalError', function (done) {
//       sinon.stub(Hermes.prototype, 'connect').yields(null);
//       rabbitmq.connect(function (err) {
//         if (err) {
//           return done(err);
//         }
//         expect(function () {
//          rabbitmq.rabbit.emit('error');
//         }).to.throw();
//         done();
//       });
//     });
//   });
// }); // end rabbitmq.js unit test
