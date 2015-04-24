/**
 * Listen to Docker events and publish/proxy to Redis
 * @module lib/listener
 */
'use strict';
require('loadenv')();

var debug = require('debug')('docker-listener:listener');
var noop = require('101/noop');

var datadog = require('./datadog');
var docker = require('./docker');
var error = require('./error');
var status = require('./status');

var datadogStream = datadog.stream();
var dockerEventStream;
var manualClose = false;

/**
 * @param {Stream} publisher should be writable stream.
 *   If it's null `./publisher` would be used as default
 * @param {Function} cb - callback
 */
exports.start = function (publisher, cb) {
  if (arguments.length ===  1) {
    cb = publisher;
    publisher = null;
  }
  publisher = publisher || require('./publisher')();
  isWritable(publisher, 'publisher');
  // list of events emitted by docker:
  // create, destroy, die, exec_create, exec_start, export, kill, oom,
  // pause, restart, start, stop, unpause
  // https://docs.docker.com/reference/api/docker_remote_api_v1.17/#monitor-dockers-events
  docker.getEvents(function (err, eventStream) {
    if (err) {
      debug('error connecting to /events', err);
      error.log(err);
      reconnect(publisher, cb);
      return;
    }
    status.docker_connected = true;
    // successfully got stream
    dockerEventStream = eventStream;
    handleConnected(publisher);
    // piping to the redis
    eventStream
      .on('error', handleError())
      .on('close', handleClose(eventStream, publisher, noop))
      .pipe(publisher, {end: false}); // we don't want to close publisher stream
    // timeout is necessary else api tests timeout... 120s is default
    eventStream.socket.setTimeout(process.env.EVENTS_SOCKET_TIMEOUT);
    // pipe events to the datadog
    eventStream.pipe(datadogStream, {end: false});
    if (cb) {
      cb(null, eventStream);
    }
  });
};

/**
 * Close out streams.
 * Note/Question: why are we not closing the "publisher" stream?
 * @param {Function} cb
 */
exports.stop = function (cb) {
  if (dockerEventStream) {
    manualClose = true;
    dockerEventStream.destroy();
  }
  if (cb) { cb(); }
};

/**
 * Assert object is a writable stream
 * @throws Error
 * @param {Object} streamInst
 * @param {String} name
 */
function isWritable (streamInst, name) {
  if (!streamInst.write) {
    debug(name + ' is not writable');
    throw new Error(name + ' stream should be Writable');
  }
}

// send `docker_deamon_up` event
function handleConnected (publisher) {
  debug('connected to docker');
  var dockerUpEvent = JSON.stringify({
    status: 'docker_daemon_up'
  });
  publisher.write(dockerUpEvent);
}

function handleError () {
  return function (err) {
    debug('stream error', err);
    error.log(err);
    datadog.inc({status: 'error'});
  };
}

// send `docker_deamon_down` event
function handleClose (eventStream, publisher, cb) {
  return function () {
    debug('handleClose');
    if (manualClose) { return; }
    manualClose = false;
    debug('connection to docker was closed');
    // destroy stream where socket was closed
    eventStream.destroy();
    eventStream = null;
   var dockerDownEvent = JSON.stringify({
      status: 'docker_daemon_down'
    });
    publisher.write(dockerDownEvent);
    reconnect(publisher, cb);
  };
}

function reconnect (publisher, cb) {
  if (process.env.AUTO_RECONNECT === 'true') {
    setTimeout(function () {
      exports.start(publisher, cb);
      debug('start reconnect');
      datadog.inc({status: 'reconnecting'});
    }, process.env.DOCKER_REMOTE_API_RETRY_INTERVAL);
  }
}
