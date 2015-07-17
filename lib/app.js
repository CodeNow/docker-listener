/**
 * create shared instance of express & set up basic status response HTTP routes
 * @module lib/app
 */
'use strict';

require('loadenv')('docker-listener:env');

var morgan = require('morgan');
var app = module.exports = require('express')();
var status = require('./status');


app.use(morgan('short', {
  skip: function () { return process.env.LOG !== 'true'; }
}));

// error handler
app.use(require('./error.js').errorResponder);

app.get('/', function (req, res) {
  res
    .status(200)
    .json({
      message: 'runnable docker-listener'
    });
});

app.get('/status', function (req, res) {
  res.status(200).json(status);
});

app.get('/health-check', function (req, res) {
  if (status.docker_connected === true) {
    return res.status(204).end();
  } else {
    return res.status(404).end();
  }
});

app.all('*', function (req, res) {
  res
    .status(404)
    .json({
      message: 'route not implemented'
    });
});
