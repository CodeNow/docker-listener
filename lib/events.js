'use strict';
require('loadenv.js')();
var ip = require('ip');
var uuid = require('node-uuid');
var os = require('os');

var error = require('./error');
var docker = require('./docker');
/**
 * adds extra data to events
 * @param  {object}   dockerEvent must be JSON
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

// added here because we only want to call these once for speed
var numCpus = os.cpus().length;
var tags = (process.env.HOST_TAGS || '').split(',');
var hostIp = ip.address();
var totalmem = os.totalmem();
/**
 * adds extra keys to every message
 * @param  {object} dockerEvent event to append data too
 * @return {object} dockerEvent event with new keys
 */
function addBasicFields(dockerEvent) {
  dockerEvent.uuid = uuid.v1();
  dockerEvent.ip = hostIp;
  dockerEvent.numCpus = numCpus;
  dockerEvent.mem = totalmem;
  dockerEvent.tags = tags;
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
