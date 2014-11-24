'use strict';
var rollbar = require('rollbar');
var Boom = require('boom');
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

function boom (code, msg, data) {
  return Boom.create(code, msg, data);
}

function log (err) {
  if (process.env.LOG_ERRORS) {
    console.error(err.message);
    console.error(err.stack);
    report(err);
  }
}

function report (err) {
  var custom = err.data || {};
  rollbar.handleErrorWithPayloadData(err, noop);
}


exports.log = function (err, req) {
  err.data = err.data || {};
  if (req) {
    err.data.req = req;
  }
  log(err);
};

/* jshint unused:false */ // middleware arguments length matters
function errorResponder(err, req, res, next) {
  if (!err.isBoom) {
    var newMsg = err.message || 'internal';
    err = boom(500, newMsg, err);
  }
  log(err, req);
  err.output.payload.error = err.data;
  res.status(err.output.statusCode).json(err.output.payload);
}

exports.errorResponder = errorResponder;