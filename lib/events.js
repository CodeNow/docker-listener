/**
 * @module lib/events
 */
'use strict';
require('loadenv')();

var ip = require('ip');
var uuid = require('node-uuid');

var docker = require('./docker');
var error = require('./error');

/**
 * adds extra data to events
 * @param {Object} dockerEvent
 * @param {Function} cb
 */
exports.enhance = function (dockerEvent, cb) {
  dockerEvent = addBasicFields(dockerEvent);
  if (!isContainerEvent(dockerEvent)) {
    return cb(null, dockerEvent);
  }
  addInspect(dockerEvent, function(err, ev) {
    // ignore this error, we want to send container deaths with or without data
    // but we still want to log it
    if (err) {
      error.log(err);
      ev = dockerEvent;
    }
    cb(null, ev);
  });
};

/**
 * add `ip`, `uuid`, `host` and `time` (if missing) fields
 * @param {Object} dockerEvent
 * @return Object
 */
function addBasicFields(dockerEvent) {
  dockerEvent.ip = ip.address();
  dockerEvent.uuid = uuid.v1();
  if (!dockerEvent.time) {
    dockerEvent.time = new Date().getTime();
  }
  dockerEvent.host = 'http://' + dockerEvent.ip + ':' + process.env.DOCKER_REMOTE_API_PORT;
  return dockerEvent;
}

/**
 * should add inspect data if dockerEvent is a container change dockerEvent
 * should only retry a few times
 */
function addInspect(dockerEvent, cb) {
  var retryCount = process.env.INSPECT_RETRY_COUNT;

  inspect(null, dockerEvent);

  function inspect (err, dockerEvent) {
    if (retryCount === 0) { return cb(err); }
    retryCount--;
    docker.getContainer(dockerEvent.id).inspect(function(err, data) {
      if (err) { return inspect(err, dockerEvent); }

      dockerEvent.inspectData = data;
      cb(null, dockerEvent);
    });
  }
}

/**
 * should return true if the dockerEvent is a container dockerEvent
 */
function isContainerEvent(dockerEvent) {
  var containerEvent =
    ['create', 'die', 'export', 'kill', 'pause', 'restart', 'start', 'stop', 'unpause'];
  return ~containerEvent.indexOf(dockerEvent.status);
}
