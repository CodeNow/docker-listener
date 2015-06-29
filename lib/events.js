/**
 * @module lib/events
 */
'use strict';
require('loadenv')('docker-listener:env');

var async = require('async');
var ip = require('ip');
var os = require('os');
var uuid = require('node-uuid');

var docker = require('./docker');
var error = require('./error');
var log = require('./logger').child({ module: 'docker-listener:events'}, true);

// added here because we only want to call these once for speed
var numCpus = os.cpus().length;
var tags = process.env.HOST_TAGS + '';
var hostIp = ip.address();
var totalmem = os.totalmem();

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
 * Create new full event giving just `status`.
 */
exports.createEvent = function (status) {
  return addBasicFields({status: status});
};

/**
 * add `ip`, `uuid`, `host` and `time` (if missing) fields
 * @param {Object} dockerEvent
 * @return Object
 */
function addBasicFields (dockerEvent) {
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
function addInspect (dockerEvent, cb) {
  var retryCount = process.env.INSPECT_RETRY_COUNT;
  var container = docker.getContainer(dockerEvent.id);
  async.retry(
    retryCount,
    container.inspect.bind(container),
    function (err, data) {
      if (err) {
        log.error({
          dockerEvent: dockerEvent
        }, 'container inspect error');
        return cb(err);
      }
      log.info({
        dockerEvent: dockerEvent,
        data: data
      }, 'container inspect complete');
      dockerEvent.inspectData = data;
      cb(null, dockerEvent);
    });
}

/**
 * should return true if the dockerEvent is a container dockerEvent
 */
function isContainerEvent (dockerEvent) {
  var containerEvent =
    ['create', 'die', 'export', 'kill', 'pause', 'restart', 'start', 'stop', 'unpause'];
  return ~containerEvent.indexOf(dockerEvent.status);
}
