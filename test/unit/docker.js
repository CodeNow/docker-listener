'use strict'

require('loadenv')()

const Code = require('code')
const Dockerode = require('dockerode')
const ErrorCat = require('error-cat')
const Lab = require('lab')
const noop = require('101/noop')
const Promise = require('bluebird')
const sinon = require('sinon')

const Docker = require('../../lib/docker')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const expect = Code.expect
const it = lab.test

describe('docker unit test', () => {
  describe('constructor', () => {
    it('should setup docker', (done) => {
      let docker
      expect(() => {
        docker = new Docker('10.0.0.1:4242')
      }).to.not.throw()
      expect(docker.docker).to.be.an.instanceOf(Dockerode)
      done()
    })
  }) // end constructor
  describe('methods', () => {
    let docker
    const testHost = '10.0.0.1:4242'

    beforeEach((done) => {
      docker = new Docker(testHost)
      done()
    })

    describe('testEvent', () => {
      const topMock = {
        top: noop
      }
      beforeEach((done) => {
        sinon.stub(docker.docker, 'listContainersAsync')
        sinon.stub(topMock, 'top')
        sinon.stub(docker.docker, 'getContainer').returns(topMock)
        sinon.stub(ErrorCat.prototype, 'createAndReport')
        done()
      })

      afterEach((done) => {
        topMock.top.restore()
        ErrorCat.prototype.createAndReport.restore()
        done()
      })

      it('should report error on list fail', (done) => {
        const testErr = new Error('calamitous')
        docker.docker.listContainersAsync.returns(Promise.reject(testErr))
        docker.testEvent().asCallback((err) => {
          if (err) { return done(err) }

          sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
          sinon.assert.calledWith(ErrorCat.prototype.createAndReport,
            500,
            testErr.message,
            testErr
          )
          done()
        })
      })

      it('should report error on empty containers', (done) => {
        const testErr = new Error('no running containers found')
        docker.docker.listContainersAsync.returns(Promise.resolve([]))
        docker.testEvent().asCallback((err) => {
          if (err) { return done(err) }

          sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
          sinon.assert.calledWith(ErrorCat.prototype.createAndReport,
            500,
            testErr.message,
            testErr
          )
          done()
        })
      })

      it('should report error top fail', (done) => {
        const testErr = new Error('grievous')
        docker.docker.listContainersAsync.returns(Promise.resolve([{Id: 1}]))
        topMock.top.yieldsAsync(testErr)
        docker.testEvent().asCallback((err) => {
          if (err) { return done(err) }

          sinon.assert.calledOnce(ErrorCat.prototype.createAndReport)
          sinon.assert.calledWith(ErrorCat.prototype.createAndReport,
            500,
            testErr.message,
            sinon.match({ cause: testErr })
          )
          done()
        })
      })

      it('should call docker with correct opts', (done) => {
        const testId = 'heinous'
        docker.docker.listContainersAsync.returns(Promise.resolve([{Id: testId}]))
        topMock.top.yieldsAsync()
        docker.testEvent().asCallback((err) => {
          if (err) { return done(err) }
          sinon.assert.calledOnce(docker.docker.listContainersAsync)
          sinon.assert.calledWith(docker.docker.listContainersAsync, {
            filters: {
              state: ['running']
            }
          })
          sinon.assert.calledOnce(docker.docker.getContainer)
          sinon.assert.calledWith(docker.docker.getContainer, testId)
          sinon.assert.calledOnce(topMock.top)
          sinon.assert.notCalled(ErrorCat.prototype.createAndReport)
          done()
        })
      })
    }) // end testEvent

    describe('getEvents', () => {
      beforeEach((done) => {
        sinon.stub(docker.docker, 'getEventsAsync')
        done()
      })

      it('should get docker event', (done) => {
        const testOpts = { since: 1000 }
        docker.docker.getEventsAsync.returns(Promise.resolve())
        docker.getEvents(testOpts).asCallback((err) => {
          if (err) { return done(err) }
          sinon.assert.calledOnce(docker.docker.getEventsAsync)
          sinon.assert.calledWith(docker.docker.getEventsAsync, testOpts)
          done()
        })
      })
    }) // end getEvents

    describe('swarmHostExists', () => {
      beforeEach((done) => {
        sinon.stub(docker.docker, 'swarmHostExistsAsync')
        done()
      })

      it('should return true', (done) => {
        const testHost = '10.0.0.0:3232'
        docker.docker.swarmHostExistsAsync.returns(Promise.resolve(true))
        docker.swarmHostExists(testHost).asCallback((err, exist) => {
          if (err) { return done(err) }
          expect(exist).to.be.true()
          sinon.assert.calledOnce(docker.docker.swarmHostExistsAsync)
          sinon.assert.calledWith(docker.docker.swarmHostExistsAsync, testHost)
          done()
        })
      })

      it('should return error', (done) => {
        const testErr = new Error('eerie')
        docker.docker.swarmHostExistsAsync.returns(Promise.reject(testErr))
        docker.swarmHostExists(testHost).asCallback((err) => {
          expect(testErr).to.be.equal(err)
          sinon.assert.calledOnce(docker.docker.swarmHostExistsAsync)
          sinon.assert.calledWith(docker.docker.swarmHostExistsAsync, testHost)
          done()
        })
      })
    }) // end swarmHostExists

    describe('inspectContainer', () => {
      const inspectMock = {
        inspect: sinon.stub()
      }
      beforeEach((done) => {
        sinon.stub(docker.docker, 'getContainer').returns(inspectMock)
        done()
      })

      it('should inspect container', (done) => {
        const testId = 'fallacious'
        inspectMock.inspect.yieldsAsync()
        docker.inspectContainer(testId).asCallback((err) => {
          if (err) { return done(err) }
          sinon.assert.calledOnce(inspectMock.inspect)
          sinon.assert.calledOnce(docker.docker.getContainer)
          sinon.assert.calledWith(docker.docker.getContainer, testId)
          done()
        })
      })
    }) // end inspectContainer

    describe('getNodes', () => {
      beforeEach((done) => {
        sinon.stub(docker.docker, 'swarmInfoAsync')
        done()
      })

      it('should get nodes event', (done) => {
        docker.docker.swarmInfoAsync.returns(Promise.resolve({
          parsedSystemStatus: {
            ParsedNodes: {
              one: { id: 1 },
              two: { id: 2 }
            }
          }
        }))
        docker.getNodes().asCallback((err, nodes) => {
          if (err) { return done(err) }
          sinon.assert.calledOnce(docker.docker.swarmInfoAsync)

          expect(nodes).to.deep.equal([{ id: 1 }, { id: 2 }])
          done()
        })
      })
    }) // end getNodes
  }) // end methods
}) // end testEvent
