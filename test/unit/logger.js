'use strict'
require('loadenv')()
const cls = require('continuation-local-storage')
const Code = require('code')
const Lab = require('lab')
const sinon = require('sinon')

const Logger = require('../../lib/logger')

const lab = exports.lab = Lab.script()

const afterEach = lab.afterEach
const beforeEach = lab.beforeEach
const describe = lab.experiment
const expect = Code.expect
const it = lab.test

describe('logger unit test', () => {
  describe('_addTid', () => {
    let getStub

    beforeEach((done) => {
      sinon.stub(cls, 'getNamespace').returns({
        get: getStub = sinon.stub()
      })
      done()
    })

    afterEach(function (done) {
      cls.getNamespace.restore()
      done()
    })

    it('should append tid', (done) => {
      const testTid = '123-123-123'
      getStub.returns(testTid)
      const out = Logger._addTid()
      expect(out).to.equal({
        tid: testTid
      })
      done()
    })
  }) // end _addTid
})
