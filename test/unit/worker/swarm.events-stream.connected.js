'use strict'
require('loadenv')()

const Lab = require('lab')
const sinon = require('sinon')

const SwarmEventsSteamConnect = require('../../../lib/workers/swarm.events-stream.connected.js').task
const rabbitmq = require('../../../lib/rabbitmq')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const it = lab.test

describe('swarm.events-stream.connected unit test', () => {
  beforeEach((done) => {
    sinon.stub(rabbitmq, 'createStreamReconcileJob').resolves()
    done()
  })

  afterEach((done) => {
    rabbitmq.createStreamReconcileJob.restore()
    done()
  })

  it('should publish createReconcileListeners job', (done) => {
    SwarmEventsSteamConnect().asCallback(() => {
      sinon.assert.calledOnce(rabbitmq.createStreamReconcileJob)
      sinon.assert.calledWith(rabbitmq.createStreamReconcileJob, {})
      done()
    })
  })
}) // end swarm.events-stream.connected unit test
