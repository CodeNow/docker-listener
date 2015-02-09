'use strict';
require('./lib/loadenv')();
var main = require('./main.js');
var error = require('./lib/error.js');

main.start(process.env.PORT, error.logIfError);
