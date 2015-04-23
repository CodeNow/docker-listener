/**
 * @module index
 */
'use strict';

require('loadenv')('docker-listener:env');

var error = require('./lib/error.js');
var main = require('./main.js');

main.start(process.env.PORT, error.logIfError);
