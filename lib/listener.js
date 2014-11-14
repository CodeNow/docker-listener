'use strict';
var JSONStream = require('JSONStream');
var Docker = require('dockerode');
var debug = require('debug')('docker-listener:listener');
var docker = new Docker({
	protocol: process.env.DOCKER_REMOTE_API_PROTOCOL,
	host: process.env.DOCKER_REMOTE_API_HOST,
	port: process.env.DOCKER_REMOTE_API_PORT
});


/**
 * @publisher shouuld be writable stream. If it's null `process.stdout` would be used
 */
exports.start = function (publisher) {

  if (publisher) {
    if (!publisher.constructor || publisher.constructor.name !== 'WriteStream') {
      throw new Error('Please call listener with the WriteStream');
    }
  }
  publisher = publisher || process.stdout;

  docker.getEvents(function (err, eventStream) {

    if (err) {
      debug('error connecting to /events', err);
      return;
    }
    if (eventStream) {

      eventStream
        .on('error', function (err) {
          debug('stream error', err);
        })
        .on('close', function () {
          debug('close error');
        })
        .pipe(JSONStream.parse().pipe(publisher));
    }

  });
};