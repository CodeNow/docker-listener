'use strict';
require('loadenv.js')();
var Docker = require('dockerode');
var datadog = require('./datadog');
var error = require('./error');
var debug = require('debug')('docker-listener:listener');
var events = require('./events');

var docker = new Docker({
	protocol: process.env.DOCKER_REMOTE_API_PROTOCOL,
	host: process.env.DOCKER_REMOTE_API_HOST,
	port: process.env.DOCKER_REMOTE_API_PORT
});
var datadogStream = datadog.stream();

var manualClose = false;
var dockerEventStream;

/**
 * @publisher should be writable stream. If it's null `process.stdout` would be used
 * @cb - optional callback
 */
exports.start = function (publisher, cb) {
  publisher = publisher || process.stdout;
  isWritable(publisher, 'publisher');

  docker.getEvents(function (err, eventStream) {
    if (err) {
      debug('error connecting to /events', err);
      error.log(err);
      reconnect(publisher);
      if (cb) { cb(err); }
      return;
    }
    // successfully got stream
    dockerEventStream = eventStream;
    handleConnected(publisher);
    // piping to the redis
    eventStream
      .on('error', handleError())
      .on('close', handleClose(eventStream, publisher))
      .pipe(publisher, {end: false}); // we don't want to close publisher stream
    // pipe events to the datadog
    eventStream.pipe(datadogStream, {end: false});
    if (cb) { cb(); }
  });
};

exports.stop = function (cb) {
  if (dockerEventStream) {
    manualClose = true;
    dockerEventStream.on('close', cb);
    dockerEventStream.close();
  }
};

function isWritable (streamInst, name) {
  if (!streamInst.write) {
    debug(name + ' is not writable');
    throw new Error(name + ' stream should be Writable');
  }
}

// send `docker_deamon_up` event
function handleConnected (publisher) {
  debug('connected to docker');
  var dockerUpEvent = {
    status: 'docker_daemon_up'
  };
  dockerUpEvent = events.enhanceEvent(dockerUpEvent);
  publisher.write(JSON.stringify(dockerUpEvent));
  datadog.inc(dockerUpEvent);
}


function handleError () {
  return function (err) {
    debug('stream error', err);
    error.log(err);
    datadog.inc({status: 'error'});
  };
}

// send `docker_deamon_down` event
function handleClose (eventStream, publisher) {
  return function () {
    if (manualClose) { return; }
    manualClose = false;
    debug('connection to docker was closed');
    // destroy stream where socket was closed
    eventStream.destroy();
    eventStream = null;
    var dockerDownEvent = {
      status: 'docker_daemon_down'
    };
    dockerDownEvent = events.enhanceEvent(dockerDownEvent);
    publisher.write(JSON.stringify(dockerDownEvent));
    datadog.inc(dockerDownEvent);
    reconnect(publisher);
  };
}

function reconnect (publisher) {
  if (process.env.AUTO_RECONNECT === 'true') {
    setTimeout(function () {
      exports.start(publisher);
      debug('start reconnect');
      datadog.inc({status: 'reconnecting'});
    }, process.env.DOCKER_REMOTE_API_RETRY_INTERVAL);
  }
}