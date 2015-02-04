'use strict';
require('loadenv.js')();
var ip = require('ip');
var uuid = require('node-uuid');
var error = require('./error');
var docker = require('./docker');
/**
 * adds extra data to events
 * @param  {object}   event must be JSON
 */
exports.enhance = function (event, cb) {
  event = addBasicFields(event);
  if (!isContainerEvent(event)) {
    return cb(null, event);
  }

  addInspect(event, function(err, ev) {
    // ignore this error, we want to send container deaths with or without data
    // but we still want to log it
    if (err) {
      error.log(err);
      ev = event;
    }
    cb(null, ev);
  });
};

// add `ip`, `uuid`, `host` and `time` (if missing) fields
function addBasicFields(event) {
  event.ip = ip.address();
  event.uuid = uuid.v1();
  if (!event.time) {
    event.time = new Date().getTime();
  }
  event.host = 'http://' + event.ip + ':' + process.env.DOCKER_REMOTE_API_PORT;
  return event;
}

/**
 * should add inspect data if event is a container change event
 * should only retry a few times
 */
function addInspect(event, cb) {
  var retryCount = process.env.INSPECT_RETRY_COUNT;

  inspect(null, event);

  function inspect (err, event) {
    if (retryCount === 0) { return cb(err); }
    retryCount--;
    docker.getContainer(event.id).inspect(function(err, data) {
      if (err) { return inspect(err, event); }

      event.inspectData = data;
      cb(null, event);
    });
  }
}

/**
 * should return true if the event is a container event
 */
function isContainerEvent(event) {
  var containerEvent =
    ['create', 'die', 'export', 'kill', 'pause', 'restart', 'start', 'stop', 'unpause'];
  return ~containerEvent.indexOf(event.status);
}