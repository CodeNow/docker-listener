/**
 * Listen to Docker events and publish/proxy to Redis
 * @module lib/listener
 */
'use strict';
require('loadenv')('docker-listener:env');

var debug = require('debug')('docker-listener:listener');
var noop = require('101/noop');

var datadog = require('./datadog');
var docker = require('./docker');
var error = require('./error');
var status = require('./status');

var datadogStream = datadog.stream();


function Listener (publisher) {
  this.publisher = publisher || require('./publisher')();
  isWritable(publisher, 'publisher');
  this.dockerEventStream = null;
  this.manualClose = false;
}
module.exports = Listener;

/**
 * @param {Stream} publisher should be writable stream.
 *   If it's null `./publisher` would be used as default
 * @param {Function} cb - callback
 */
Listener.prototype.start = function () {
  // list of events emitted by docker:
  // create, destroy, die, exec_create, exec_start, export, kill, oom,
  // pause, restart, start, stop, unpause
  // https://docs.docker.com/reference/api/docker_remote_api_v1.17/#monitor-dockers-events
  docker.getEvents(function (err, eventStream) {
    if (err) {
      debug('error connecting to /events', err);
      error.log(err);
      this.reconnect();
      return;
    }
    status.docker_connected = true;
    // successfully got stream
    this.dockerEventStream = eventStream;
    this.handleConnected();
    // piping to the redis
    eventStream
      .on('error', this.handleError.bind(this))
      .on('close', this.handleClose.bind(this))
      .pipe(this.publisher, {end: false}); // we don't want to close publisher stream
    // timeout is necessary else api tests timeout... 120s is default
    eventStream.socket.setTimeout(process.env.EVENTS_SOCKET_TIMEOUT);
    // pipe events to the datadog
    eventStream.pipe(datadogStream, {end: false});
  }.bind(this));
};

/**
 * Close out streams.
 * Note/Question: why are we not closing the "publisher" stream?
 */
Listener.prototype.stop = function () {
  if (this.dockerEventStream) {
    this.manualClose = true;
    this.dockerEventStream.destroy();
  }
  status.docker_connected = false;
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
Listener.prototype.handleConnected = function() {
  debug('connected to docker');
  var dockerUpEvent = JSON.stringify({
    status: 'docker_daemon_up'
  });
  this.publisher.write(dockerUpEvent);
};

Listener.prototype.handleError = function (err) {
  debug('stream error', err);
  error.log(err);
  datadog.inc({status: 'error'});
};

// send `docker_deamon_down` event
Listener.prototype.handleClose = function () {
  debug('handleClose');
  if (this.manualClose) { return; }
  this.manualClose = false;
  debug('connection to docker was closed');
  // destroy stream where socket was closed
  this.dockerEventStream.destroy();
  this.dockerEventStream = null;
  var dockerDownEvent = JSON.stringify({
    status: 'docker_daemon_down'
  });
  this.publisher.write(dockerDownEvent);
  this.reconnect();
}

Listener.prototype.reconnect = function () {
  if (process.env.AUTO_RECONNECT === 'true') {
    setTimeout(function () {
      this.start();
      debug('start reconnect');
      datadog.inc({status: 'reconnecting'});
    }.bind(this), process.env.DOCKER_REMOTE_API_RETRY_INTERVAL);
  }
}
