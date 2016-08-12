'use strict'
require('loadenv')()

const Lab = require('lab')
const sinon = require('sinon')

const HealthCheckFailed = require('../../../lib/workers/instance.container.health-check.failed.js').task
const rabbit = require('../../../lib/rabbitmq')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const it = lab.test

describe('instance.container.health-check.failed unit test', () => {
  beforeEach((done) => {
    sinon.stub(rabbit, 'publishTask')
    done()
  })

  afterEach((done) => {
    rabbit.publishTask.restore()
    done()
  })

  it('should publish job', (done) => {
    const job = {
      id: 'some-id',
      host: 'some-host'
    }
    HealthCheckFailed(job).asCallback((err) => {
      if (err) { return done(err) }
      sinon.assert.calledOnce(rabbit.publishTask)
      sinon.assert.calledWith(rabbit.publishTask,
        'container.state.poll',
        job
      )
      done()
    })
  })
}) // end instance.container.health-check.failed unit test
