'use strict'

const joi = require('joi')

module.exports.containerStatePoll = joi.object({
  host: joi.string().required(),
  id: joi.string().required(),
  tid: joi.string()
}).unknown().required()

module.exports.dockerEventPublish = joi.object({
  dockerPort: joi.string().required(),
  dockerUrl: joi.string().required(),
  from: joi.string().required(),
  host: joi.string().required(),
  Host: joi.string().required(),
  id: joi.string().required(),
  ip: joi.string().required(),
  needsInspect: joi.boolean().required(),
  org: joi.string().required(),
  status: joi.string().only('create', 'start', 'die', 'engine_connect').required(),
  tags: joi.string().required(),
  time: joi.number().required(),
  uuid: joi.string().required(),
  tid: joi.string()
}).unknown().required()

module.exports.eventsStreamConnect = joi.object({
  host: joi.string().required(),
  org: joi.string().required(),
  tid: joi.string()
}).unknown().required()
