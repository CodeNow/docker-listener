'use strict'

/**
 * keeps mapping of IP to last event timestamp
 * @type {Object}
 */
class SinceMap {
  constructor () {
    this.map = {}
  }

  /**
   * get timestamp from map
   * @param  {String} ip of dock
   * @return {String}    last event timestamp
   */
  get (ip) {
    return this.map[ip]
  }

  /**
   * set mapping to time stamp. Only set if time if it greater
   * @param {String} ip   ip to map time stamp too
   * @param {Number} time docker event time stamp
   */
  set (ip, time) {
    if (this.map[ip] && this.map[ip] > time) {
      return
    }
    this.map[ip] = time
  }

  /**
   * delete key from map
   * @param  {String} ip key to delete
   */
  delete (ip) {
    delete this.map[ip]
  }
}

module.exports = new SinceMap()
