'use strict';
var JSONStream = require('JSONStream');
var Docker = require('dockerode');
var debug = require('debug')('docker-listener:listener');
var docker = new Docker({
	protocol: process.env.DOCKER_REMOTE_API_PROTOCOL,
	host: process.env.DOCKER_REMOTE_API_HOST,
	port: process.env.DOCKER_REMOTE_API_PORT
});



docker.getEvents(function (err, eventStream) {
  
  if (err) {
    debug('error getting events', err);
    return;
  }
  if (eventStream) {
    eventStream.pipe(JSONStream.parse().on('root', function(ev) {
      debug('parsed event', ev);
    }));

  }
  
});
