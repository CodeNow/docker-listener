'use strict';
var app = require('docker-mock');
var debug = require('debug')('test-docker-server');

app.listen(4243, function (err) {
  if (err) { throw err; }
  debug('started docker mock');
  process.send('started');
});

