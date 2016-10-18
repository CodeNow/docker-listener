'use strict'
require('loadenv')()

const joi = require('joi')
const Promise = require('bluebird')
const rabbitmq = require('../rabbitmq')

module.exports.jobSchema = joi.object({
  host: joi.string().uri({ scheme: 'http' }).required(),
  id: joi.string().required()
}).unknown().required()

module.exports.task = (job) => {
  return Promise
    .try(() => {
      rabbitmq.publishTask('container.state.poll', job)
    })
}
