'use strict';
require('loadenv.js')();
var app = require('./lib/app.js');

app.listen(process.env.PORT);
console.log('server listen on', process.env.PORT);