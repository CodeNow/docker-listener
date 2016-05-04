'use strict'

require('loadenv')()

const Promise = require('bluebird')
const Code = require('code')
const Lab = require('lab')
const sinon = require('sinon')
require('sinon-as-promised')(Promise)
const SwarmClient = require('@runnable/loki').Swarm

const Swarm = require('../../lib/swarm')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const expect = Code.expect
const it = lab.test

describe('swarm unit test', () => {
  let docker
  const testHost = '10.0.0.1:4242'

  beforeEach((done) => {
    docker = new Swarm(testHost)
    done()
  })

  describe('getNodes', () => {
    beforeEach((done) => {
      sinon.stub(SwarmClient.prototype, 'swarmInfoAsync')
      done()
    })

    afterEach((done) => {
      SwarmClient.prototype.swarmInfoAsync.restore()
      done()
    })

    it('should get nodes event', (done) => {
      SwarmClient.prototype.swarmInfoAsync.resolves({
        parsedSystemStatus: {
          ParsedNodes: {
            one: { id: 1 },
            two: { id: 2 }
          }
        }
      })
      docker.getNodes().asCallback((err, nodes) => {
        if (err) { return done(err) }
        sinon.assert.calledOnce(SwarmClient.prototype.swarmInfoAsync)

        expect(nodes).to.deep.equal([{ id: 1 }, { id: 2 }])
        done()
      })
    })
  }) // end getNodes
})
