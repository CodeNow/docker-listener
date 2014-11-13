'use strict';

var express = require('express');
var app = module.exports = express();


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