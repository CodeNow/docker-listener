'use strict'

const joi = require('joi')

module.exports.dockLost = joi.object({
  host: joi.string().uri({ scheme: 'http' }).required(),
  githubOrgId: joi.number().required()
}).unknown().required()

module.exports.containerStatePoll = joi.object({
  host: joi.string().required(),
  id: joi.string().required(),
  githubOrgId: joi.number().required()
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
  uuid: joi.string().required()
}).unknown().required()

module.exports.containerLifeCycle = joi.object({
  dockerPort: joi.string().required(),
  dockerUrl: joi.string().required(),
  from: joi.string().required(),
  host: joi.string().required(),
  Host: joi.string().required(),
  id: joi.string().required(),
  ip: joi.string().required(),
  needsInspect: joi.boolean().required(),
  inspectData: joi.object({}).unknown().when('needsInspect', { is: true, then: joi.required() }),
  org: joi.string().required(),
  status: joi.string().only('create', 'start', 'die', 'engine_connect').required(),
  tags: joi.string().required(),
  time: joi.number().required(),
  uuid: joi.string().required()
}).unknown().required()

module.exports.dockerEventsStreamConnect = joi.object({
  host: joi.string().required(),
  org: joi.string().required()
}).unknown().required()

module.exports.swarmEventsStreamConnect = joi.object({
  host: joi.string().required()
}).unknown().required()

module.exports.dockerEventsStreamConnected = joi.object({
  host: joi.string().uri({ scheme: 'http' }).required(),
  org: joi.number().required()
}).unknown().required()

module.exports.swarmEventsStreamConnected = joi.object({
  host: joi.string().uri({ scheme: 'http' }).required()
}).unknown().required()

module.exports.eventsStreamDisconnected = joi.object({
  host: joi.string().uri({ scheme: 'http' }).required(),
  org: joi.number().required()
}).unknown().required()

module.exports.containerStatePolled = joi.object({
  id: joi.string().required(),
  inspectData: joi.object({
    Config: joi.object({
      Labels: joi.object({
        instanceId: joi.string().required(),
        sessionUserGithubId: joi.number().required(),
        deploymentUuid: joi.string()
      }).unknown().required()
    }).unknown().required()
  }).unknown().required()
}).unknown().required()
