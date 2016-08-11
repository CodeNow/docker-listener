'use strict'

/**
 * keeps mapping of IP to last event timestamp
 * @type {Map}
 */
class SinceMap extends Map {

  /**
   * set mapping to time stamp. Only set if time if it greater
   * @param {String} ip   ip to map time stamp too
   * @param {Number} time docker event time stamp
   */
  set (ip, time) {
    if (this.get(ip) && this.get(ip) > time) {
      return
    }
    super.set(ip, time)
  }
}
module.exports = new SinceMap()

