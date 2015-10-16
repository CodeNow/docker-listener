/**
 * @module lib/logger
 */
'use strict';

var Bunyan2Loggly = require('bunyan-loggly').Bunyan2Loggly;
var bunyan = require('bunyan');
var keypather = require('keypather')();
var path = require('path');
var put = require('101/put');

var streams = [];

streams.push({
  level: process.env.LOG_LEVEL,
  stream: process.stdout
});

if (process.env.LOGGLY_TOKEN) {
  streams.push({
    level: 'trace',
    stream: new Bunyan2Loggly({
      token: process.env.LOGGLY_TOKEN,
      subdomain: 'sandboxes'
    }),
    type: 'raw'
  });
}

var serializers = put(bunyan.stdSerializers, {
  tx: function () {
    // TODO pull of log data
    return keypather.get(process.domain, 'runnableData');
  },
  req: function (req) {
    return {
      method: req.method,
      url: req.url,
      isInternalRequest: req.isInternalRequest
    };
  }
});

var logger = module.exports = bunyan.createLogger({
  name: 'docker-listener',
  streams: streams,
  serializers: serializers,
  // DO NOT use src in prod, slow
  src: !!process.env.LOG_SRC,
  // default values included in all log objects
  branch: process.env.VERSION_GIT_COMMIT,
  commit: process.env.VERSION_GIT_BRANCH,
  environment: process.env.NODE_ENV,
  host: require('ip').address()
});

/**
 * Initiate and return child instance
 */
module.exports.getChild = function (moduleName) {
  moduleName = path.relative(process.cwd(), moduleName);
  return logger.child({ module: moduleName }, true);
};
