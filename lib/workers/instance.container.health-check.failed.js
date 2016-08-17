'use strict'
require('loadenv')()

const Joi = require('joi')
const Promise = require('bluebird')
const rabbitmq = require('../rabbitmq')

module.exports.jobSchema = Joi.object({
  host: Joi.string().required(),
  id: Joi.string().required(),
  tid: Joi.string()
}).required().label('DockerContainerPoll job')

module.exports.task = (job) => {
  return Promise
    .try(() => {
      rabbitmq.publishTask('container.state.poll', job)
    })
}
