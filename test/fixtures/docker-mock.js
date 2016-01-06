'use strict'
var spawn = require('child_process').fork

module.exports.start = function (cb) {
  this.server = spawn('test/fixtures/docker-server.js')

  console.log('Spawned child pid: ', this.server.pid)
  this.server.on('message', function (msg) {
    if (msg === 'started') {
      cb()
    }
  })
  return this
}
module.exports.stop = function (cb) {
  if (this.server) {
    this.server.on('exit', function (code) {
      console.log('docker server process exited with code ', code)
      cb()
    })
    this.server.kill('SIGHUP')
    this.server = null
  }
  return this
}
