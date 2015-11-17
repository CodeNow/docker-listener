/**
 * @module index
 */
'use strict';

require('loadenv')();

var ErrorCat = require('error-cat');
var error = new ErrorCat();
var main = require('./main');

main.start(process.env.PORT, function (err) {
  if (err) { error.createAndReport(500, 'failed to start', err); }
});
