/**
 * @module lib/publisher
 */
'use strict';

var keypath = require('keypather')();
var stream = require('stream');
var util = require('util');
var ip = require('ip');

var events = require('./events');
var hermesClient = require('./hermes-client');
var log = require('./logger').getChild(__filename);
var status = require('./status');

module.exports = RabbitPublisherStream;

//helper
function isUserContainer (enhanced) {
  return keypath.get(enhanced, 'inspectData.Config.Labels.type') === 'user-container';
}
function isBuildContainer (enhanced) {
  return keypath.get(enhanced, 'inspectData.Config.Labels.type') === 'image-builder-container';
}
/**
 * @class
 */
function RabbitPublisherStream () {
  stream.Writable.call(this);
}

// Ignore events from blacklisted conatiners
function isBlacklisted (ev) {
  if (!ev.from) {
    // this is `connected` or `disconnected` event
    return false;
  }
  var blackList = process.env.CONTAINERS_BLACKLIST.split(',');
  var isBlocked = blackList.some(function (item) {
    return ~ev.from.indexOf(item);
  });
  return isBlocked;
}

util.inherits(RabbitPublisherStream, stream.Writable);

RabbitPublisherStream.prototype._write = function (chunk, encoding, callback) {
  /*jshint maxcomplexity: 11*/
  log.trace({
    chunk: chunk,
    encoding: encoding
  }, 'publish events to rabbit');
  if (!chunk) { return callback(); }
  var ev;
  try {
    ev = JSON.parse(chunk.toString());
  } catch (err) {
    return callback(err);
  }
  if (isBlacklisted(ev)) {
    // do nothing
    return callback(null);
  }
  status.count_events = status.count_events + 1;
  status.last_event_time = new Date().toISOString();
  // if this errors still send raw enhanced
  events.enhance(ev, function (err, enhanced) {
    if (err) { enhanced = ev; }
    log.info({ enhanced: enhanced }, 'rabbit publish enhanced');
    var logData = {
      enhanced: enhanced
    };
    /**
     * RabbitMQ Jobs in response to docker events
     */
    switch (enhanced.status) {
      case 'create':
        // ignore build containers
        if (isUserContainer(enhanced)) {
          log.info(logData, 'inserting on-instance-container-create task into queue');
          hermesClient.publish('on-instance-container-create', enhanced);
        } else if (isBuildContainer(enhanced)) {
          log.info(logData, 'inserting on-image-builder-container-create task into queue');
          hermesClient.publish('on-image-builder-container-create', enhanced);
        }
        break;
      case 'start':
        log.info(logData, 'publishing container.life-cycle.started event');
        hermesClient.publish('container.life-cycle.started', enhanced,
          RabbitPublisherStream.createRoutingKey());
        break;
      case 'die':
        if (isUserContainer(enhanced)) {
          log.info(logData, 'inserting on-instance-container-die task into queue');
          hermesClient.publish('on-instance-container-die', enhanced);
        } else if (isBuildContainer(enhanced)) {
          log.info(logData, 'inserting on-image-builder-container-die task into queue');
          hermesClient.publish('on-image-builder-container-die', enhanced);
        }
        log.info(logData, 'publishing container.life-cycle.died event');
        hermesClient.publish('container.life-cycle.died', enhanced,
          RabbitPublisherStream.createRoutingKey());
        break;
      case 'docker.events-stream.connected':
        log.info(logData, 'inserting docker.events-stream.connected task into queue');
        hermesClient.publish('docker.events-stream.connected', enhanced);
        break;
      case 'docker.events-stream.disconnected':
        log.info(logData, 'inserting docker.events-stream.disconnected task into queue');
        hermesClient.publish('docker.events-stream.disconnected', enhanced);
        break;
    }
    callback(null);
  });
};

/**
 * returns routing key. format:
 * <org>.<host_ip>
 * org is org id which is parsed from HOST_TAGS
 * host_ip is the private ip of the dock replacing `.` with `-`
 * @return {String} routing key
 */
RabbitPublisherStream.createRoutingKey = function () {
  return [
    process.env.HOST_TAGS.split(',')[0],
    ip.address().replace('.', '-')
  ].join('.');
};
