'use strict'
require('loadenv')()

const Lab = require('lab')
const Promise = require('bluebird')
const sinon = require('sinon')

const SwarmEventsSteamConnect = require('../../../lib/workers/swarm.events-stream.connect.js')
const eventManager = require('../../../lib/event-manager')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const it = lab.test

describe('swarm.events-stream.connect unit test', () => {
  beforeEach((done) => {
    sinon.stub(eventManager, 'startSwarmListener')
    done()
  })

  afterEach((done) => {
    eventManager.startSwarmListener.restore()
    done()
  })

  it('should startSwarmListener', (done) => {
    eventManager.startSwarmListener.returns(Promise.resolve())
    SwarmEventsSteamConnect().asCallback((err) => {
      if (err) { return done(err) }
      sinon.assert.calledOnce(eventManager.startSwarmListener)
      done()
    })
  })
}) // end swarm.events-stream.connect unit test
