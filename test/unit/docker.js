'use strict'

require('loadenv')()
const Code = require('code')
const Lab = require('lab')

const Docker = require('../../lib/docker')

const lab = exports.lab = Lab.script()

const describe = lab.experiment
const it = lab.test
const expect = Code.expect

describe('docker unit test', () => {
  describe('toDockerHost', () => {
    it('should convert url to host', (done) => {
      expect(Docker.toDockerHost('http://10.0.0.1:4242')).to.equal('10.0.0.1:4242')
      done()
    })

    it('should return same valid host', (done) => {
      expect(Docker.toDockerHost('10.0.0.1:4242')).to.equal('10.0.0.1:4242')
      done()
    })
  })

  describe('toDockerUrl', () => {
    it('should convert host to url', (done) => {
      expect(Docker.toDockerUrl('10.0.0.1:4242')).to.equal('http://10.0.0.1:4242')
      done()
    })

    it('should return same valid url', (done) => {
      expect(Docker.toDockerUrl('http://10.0.0.1:4242')).to.equal('http://10.0.0.1:4242')
      done()
    })
  })
})
