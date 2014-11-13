'use strict';
require('loadenv.js')();
var app = require('./lib/app.js');
var debug = require('debug')('docker-listener:server');

app.listen(process.env.PORT);
debug('server listen on', process.env.PORT);