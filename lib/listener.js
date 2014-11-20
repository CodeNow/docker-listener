'use strict';
require('loadenv.js')();
var stream = require('stream');
var Docker = require('dockerode');
var datadog = require('./datadog');
var debug = require('debug')('docker-listener:listener');
var docker = new Docker({
	protocol: process.env.DOCKER_REMOTE_API_PROTOCOL,
	host: process.env.DOCKER_REMOTE_API_HOST,
	port: process.env.DOCKER_REMOTE_API_PORT
});
var datadogStream = datadog.stream();

/**
 * @publisher should be writable stream. If it's null `process.stdout` would be used
 * @reporter should be used if you want to know when problems happened.
 *   It is an optional parameter. It should be writable stream
 */
exports.start = function (publisher, reporter) {
  isWritable(publisher, 'publisher');
  isWritable(reporter, 'reporter');

  publisher = publisher || process.stdout;
  docker.getEvents(function (err, eventStream) {
    if (err) {
      debug('error connecting to /events', err);
      if (reporter) {
        reporter.write('cannot connect to the docker');
      }
      reconnect(publisher, reporter);
      return;
    }
    if (eventStream) {
      handleConnected(publisher);
      // piping to the redis
      eventStream
        .on('error', handleError())
        .on('close', handleClose(eventStream, publisher, reporter))
        .pipe(publisher, {end: false}); // we don't want to close publisher stream
      // pipe events to the datadog
      eventStream.pipe(datadogStream, {end: false});
    }

  });
};

function isWritable (streamInst, name) {
  if (streamInst && ((!streamInst.write) && !(streamInst instanceof stream.Writable))) {
    debug(name + ' is not writable');
    throw new Error(name + ' stream should be Writable');
  }
}

// send `docker_deamon_up` event
function handleConnected (publisher) {
  debug('connected to docker');
  publisher.write(JSON.stringify({status: 'docker_daemon_up', time: new Date().getTime()}));
  datadog.inc({status: 'connect'});
}


function handleError () {
  return function (err) {
    // TODO (anton) do we need to do here something specific
    debug('stream error', err);
    datadog.inc({status: 'error'});
  };
}

// send `docker_deamon_down` event
function handleClose (eventStream, publisher, reporter) {
  return function () {
    debug('connection to docker was closed');
    // destroy stream where socket was closed
    eventStream.destroy();
    eventStream = null;
    publisher.write(JSON.stringify({status: 'docker_daemon_down', time: new Date().getTime()}));
    reconnect(publisher, reporter);
  };
}

function reconnect (publisher, reporter) {
  if (process.env.AUTO_RECONNECT === 'true') {
    setTimeout(function () {
      exports.start(publisher, reporter);
      debug('start reconnect');
      datadog.inc({status: 'reconnect'});
    }, process.env.DOCKER_REMOTE_API_RETRY_INTERVAL);
  }
}