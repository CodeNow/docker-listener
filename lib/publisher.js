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

/**
 * @class
 */
function RedisPublisherStream () {
  stream.Writable.call(this);
}

util.inherits(RedisPublisherStream, stream.Writable);

RedisPublisherStream.prototype._write = function (chunk, encoding, callback) {
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
    /**
     * RabbitMQ Jobs in response to docker events
     */
    switch (enhanced.status) {
      case 'create':
        // ignore build containers
        if (isUserContainer(enhanced)) {
          log.info({
            enhanced: enhanced
          }, 'container-create');
          hermesClient.publish('container-create', enhanced);
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
