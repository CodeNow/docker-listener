'use strict';
require('loadenv.js')();
var express = require('express');
var app = module.exports = express();
var listener = require('./listener');
var morgan = require('morgan');
var publisher = require('./publisher')();

app.use(morgan('short', {
  skip: function () { return process.env.LOG !== 'true'; }
}));

app.get('/', function (req, res) {
  res
    .status(200)
    .json({
      message: 'runnable docker-listener'
    });
});

app.all('*', function (req, res) {
  res
    .status(404)
    .json({
      message: 'route not implemented'
    });
});

// start docker events listener
listener.start(publisher, process.stdout);