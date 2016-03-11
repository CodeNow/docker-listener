'use strict'
require('loadenv')()

const Code = require('code')
const Lab = require('lab')

const sinceMap = require('../../lib/since-map.js')

const lab = exports.lab = Lab.script()

const beforeEach = lab.beforeEach
const describe = lab.describe
const expect = Code.expect
const it = lab.it

describe('since-map.js unit test', () => {
  beforeEach((done) => {
    sinceMap.map = {}
    done()
  })

  describe('set', () => {
    it('should set time on new key', (done) => {
      sinceMap.set('a', 10)
      expect(sinceMap.map.a).to.equal(10)
      done()
    })

    it('should update existing key', (done) => {
      sinceMap.map.a = 5
      sinceMap.set('a', 10)
      expect(sinceMap.map.a).to.equal(10)
      done()
    })

    it('should update existing key only if greater', (done) => {
      sinceMap.map.a = 15
      sinceMap.set('a', 10)
      expect(sinceMap.map.a).to.equal(15)
      done()
    })
  }) // end set

  describe('get', () => {
    it('should get mapping', (done) => {
      sinceMap.map.a = 10
      expect(sinceMap.get('a')).to.equal(10)
      done()
    })

    it('should get undefined mapping', (done) => {
      expect(sinceMap.get('a')).to.be.undefined()
      done()
    })
  }) // end get

  describe('delete', () => {
    it('should delete key', (done) => {
      sinceMap.map.a = 10
      sinceMap.delete('a')
      expect(sinceMap.a).to.be.undefined()
      done()
    })
  }) // end delete
}) // end since-map.js unit test
