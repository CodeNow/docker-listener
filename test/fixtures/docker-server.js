'use strict';
var app = require('docker-mock');

app.listen(4243, function (err) {
  if (err) { throw err; }
  console.log('started docker mock');
  process.send('started');
});
