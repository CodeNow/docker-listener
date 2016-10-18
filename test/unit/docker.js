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
  describe('constructor', () => {
    it('should add prootocol to the host', (done) => {
      const docker = new Docker('10.0.0.1:4242')
      expect(docker.client.modem.host).to.equal('https://10.0.0.1:4242')
      done()
    })

    it('should skip timeout if undefined', (done) => {
      const docker = new Docker('10.0.0.1:4242')
      expect(docker.client.modem.timeout).to.be.undefined()
      done()
    })

    it('should set timeout if provided', (done) => {
      const timeout = 3500
      const docker = new Docker('10.0.0.1:4242', null, timeout)
      expect(docker.client.modem.timeout).to.equal(timeout)
      done()
    })
  })
})
