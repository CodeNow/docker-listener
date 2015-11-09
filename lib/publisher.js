/**
 * @module lib/publisher
 */
'use strict';

var keypath = require('keypather')();
var stream = require('stream');
var util = require('util');

var error = require('./error');
var events = require('./events');
var hermesClient = require('./hermes-client');
var log = require('./logger').getChild(__filename);
var redis = require('./redis-client');
var status = require('./status');

module.exports = RedisPublisherStream;

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
function RedisPublisherStream () {
  stream.Writable.call(this);
}

util.inherits(RedisPublisherStream, stream.Writable);

RedisPublisherStream.prototype._write = function (chunk, encoding, callback) {
  /*jshint maxcomplexity: 11*/
  log.trace({
    chunk: chunk,
    encoding: encoding
  }, 'publish events to redis');
  if (!chunk) { return callback(); }
  var ev;
  try {
    ev = JSON.parse(chunk.toString());
  } catch (err) {
    return callback(err);
  }
  status.count_events = status.count_events + 1;
  status.last_event_time = new Date().toISOString();
  // if this errors still send raw enhanced
  events.enhance(ev, function (err, enhanced) {
    if (err) { enhanced = ev; }
    var channel = process.env.DOCKER_EVENTS_NAMESPACE + enhanced.status;
    var data = JSON.stringify(enhanced);
    log.info({
      channel: channel,
      enhanced: enhanced
    }, 'redis publish');
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
        if (enhanced) {
          log.info(logData, 'publishing container.life-cycle.started event');
          hermesClient.publish('container.life-cycle.started', enhanced);
        }
        break;
      case 'die':
        if (isUserContainer(enhanced)) {
          log.info(logData, 'inserting on-instance-container-die task into queue');
          hermesClient.publish('on-instance-container-die', enhanced);
        } else if (isBuildContainer(enhanced)) {
          log.info(logData, 'inserting on-image-builder-container-die task into queue');
          hermesClient.publish('on-image-builder-container-die', enhanced);
        }
        if (enhanced) {
          log.info(logData, 'publishing container.life-cycle.died event');
          hermesClient.publish('container.life-cycle.died', enhanced);
        }
        break;
    }
    redis.publish(channel, data, function (err) {
      if (err) {
        error.log(err);
        return callback(err);
      }
      log.trace({
        data: data
      }, 'published');
      callback(null);
    });
  });
};
