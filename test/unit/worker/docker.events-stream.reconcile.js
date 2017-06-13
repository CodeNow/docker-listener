'use strict'
require('loadenv')()

const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')

const Swarm = require('../../../lib/swarm')
const SwarmEventsReconcile = require('../../../lib/workers/docker.events-stream.reconcile.js').task
const eventManager = require('../../../lib/event-manager')
const rabbitmq = require('../../../lib/rabbitmq')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const it = lab.test

describe('docker.events-stream.reconcile unit test', () => {
  beforeEach((done) => {
    sinon.stub(Swarm.prototype, 'getNodes')
    sinon.stub(eventManager, 'hasListener')
    sinon.stub(rabbitmq, 'createStreamConnectJob')
    done()
  })

  afterEach((done) => {
    Swarm.prototype.getNodes.restore()
    eventManager.hasListener.restore()
    rabbitmq.createStreamConnectJob.restore()
    done()
  })

  it('should createStreamConnectJob for new listeners', (done) => {
    const node1 = {Host: '10.0.0.1:4242', Labels: {org: '1234'}}
    const node2 = {Host: '10.0.0.2:4242', Labels: {org: '1234'}}
    const node3 = {Host: '10.0.0.3:4242', Labels: {org: 'asdf'}}

    Swarm.prototype.getNodes.returns(Promise.resolve([node1, node2, node3]))
    eventManager.hasListener.returns(false)
    eventManager.hasListener.withArgs(node3.Host).returns(true)

    SwarmEventsReconcile().asCallback((err) => {
      if (err) { return done(err) }
      sinon.assert.calledOnce(Swarm.prototype.getNodes)

      sinon.assert.calledThrice(eventManager.hasListener)
      sinon.assert.calledWith(eventManager.hasListener, node1.Host)
      sinon.assert.calledWith(eventManager.hasListener, node2.Host)
      sinon.assert.calledWith(eventManager.hasListener, node3.Host)

      sinon.assert.calledTwice(rabbitmq.createStreamConnectJob)
      sinon.assert.calledWith(rabbitmq.createStreamConnectJob, 'docker', node1.Host, node1.Labels.org)
      sinon.assert.calledWith(rabbitmq.createStreamConnectJob, 'docker', node2.Host, node2.Labels.org)
      sinon.assert.neverCalledWith(rabbitmq.createStreamConnectJob, 'docker', node3.Host, node3.Labels.org)
      done()
    })
  })
}) // end docker.events-stream.reconcile unit test
