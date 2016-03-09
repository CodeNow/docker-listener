'use strict'

/**
 * keeps mapping of IP to last event timestamp
 * @type {Object}
 */
const sinceMap = {}

module.exports = class SinceMap {
  /**
   * get timestamp from map
   * @param  {String} ip of dock
   * @return {String}    last event timestamp
   */
  static get (ip) {
    return sinceMap[ip]
  }

  /**
   * set mapping to time stamp. Only set if time if it greater
   * @param {String} ip   ip to map time stamp too
   * @param {Number} time docker event time stamp
   */
  static set (ip, time) {
    if (sinceMap[ip] && sinceMap[ip] > time) {
      return
    }
    sinceMap[ip] = time
  }
}
