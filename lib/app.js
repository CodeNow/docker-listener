/**
 * @module lib/app
 */
'use strict';

var morgan = require('morgan');

var app = module.exports = require('express')();

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

