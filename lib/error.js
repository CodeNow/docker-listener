/**
 * @module lib/error
 */
'use strict';

var Boom = require('boom');
var noop = require('101/noop');
var pick = require('101/pick');
var rollbar = require('rollbar');

if (process.env.ROLLBAR_KEY) {
  rollbar.init(process.env.ROLLBAR_KEY, {
    environment: process.env.NODE_ENV || 'development',
    branch: process.env._VERSION_GIT_BRANCH,
    codeVersion: process.env._VERSION_GIT_COMMIT,
    root: process.env.ROOT_DIR
  });
}

function log (err, opts) {
  if (process.env.LOG_ERRORS) {
    console.error(err.message);
    console.error(err.stack);
  }
  report(err, opts);
}

function report (err, opts) {
  var custom = err.data || {};
  if (!opts) {
    opts = {
      level: 'info'
    };
  }
  rollbar.handleErrorWithPayloadData(err, opts, noop);
}

exports.log = function (err, req) {
  err.data = err.data || {};
  if (req) {
    err.data.req = req;
  }
  log(err);
};

exports.logIfError = function (err) {
  if (err) {
    log(err);
  }
};

/* jshint unused:false */ // middleware arguments length matters
function errorResponder(err, req, res, next) {
  if (!err.isBoom) {
    var newMsg = err.message || 'internal';
    err = Boom.create(500, newMsg, err);
  }
  log(err, req);
  err.output.payload.error = err.data;
  res.status(err.output.statusCode).json(err.output.payload);
}

exports.errorResponder = errorResponder;
