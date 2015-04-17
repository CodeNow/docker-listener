/**
 * Export singleton instance hermes client
 * @module lib/hermes-client
 */
'use strict';

require('loadenv')();

module.exports = require('hermes').hermesSingletonFactory({
  hostname: process.env.RABBITMQ_HOSTNAME,
  password: process.env.RABBITMQ_PASSWORD,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USERNAME
});
