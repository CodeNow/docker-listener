'use strict';
var express = require('express');
var app = module.exports = express();
var morgan = require('morgan');


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

app.all('*', function (req, res) {
  res
    .status(404)
    .json({
      message: 'route not implemented'
    });
});

