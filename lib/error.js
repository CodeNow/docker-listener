'use strict';
var envIs = require('101/env-is');
var rollbar = require('rollbar');
var pick = require('101/pick');
var noop = require('101/noop');
if (process.env.ROLLBAR_KEY) {
  rollbar.init(process.env.ROLLBAR_KEY, {
    environment: process.env.NODE_ENV || 'development',
    branch: process.env._VERSION_GIT_BRANCH,
    codeVersion: process.env._VERSION_GIT_COMMIT,
    root: process.env.ROOT_DIR
  });
}


function log (err) {
  console.error(err.message);
  console.error(err.stack);
  if (!envIs('test')) {
    report(err);
  }
}

function report (err) {
  var custom = err.data || {};
  rollbar.handleErrorWithPayloadData(err, noop);
}


exports.log = function (err, req) {
  if (!envIs('test')) {
    err.data = err.data || {};
    if (req) {
      err.data.req = req;
    }
    log(err);
  }
};

/* jshint unused:false */ // middleware arguments length matters
function errorResponder(err, req, res, next) {
  if (process.env.LOG_ERRORS) {
    log(err, req);
  }
  err.output.payload.error = err.data;
  res.status(err.output.statusCode).json(err.output.payload);
}

exports.errorResponder = errorResponder;