/**
 * @module index
 */
'use strict';

require('loadenv')('docker-listener:env');

var error = require('./lib/error');
var main = require('./main');

main.start(process.env.PORT, error.logIfError);
