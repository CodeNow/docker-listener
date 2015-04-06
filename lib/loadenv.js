/**
 * @module lib/loadenv
 */
'use strict';

var dotenv = require('dotenv');
var envIs = require('101/env-is');
var eson = require('eson');
var execSync = require('exec-sync');
var path = require('path');

var ROOT_DIR = path.resolve(__dirname, '..');
var env = process.env.NODE_ENV || 'development';
var read = false;

module.exports = readDotEnvConfigs;

/**
 * Populate process.env with keys from env dotfiles
 */
function readDotEnvConfigs () {
  if (read === true) {
    return;
  }
  read = true;
  dotenv._getKeysAndValuesFromEnvFilePath(path.resolve(__dirname, '../configs/.env'));
  dotenv._getKeysAndValuesFromEnvFilePath(path.resolve(__dirname, '../configs/.env.'+ env));
  dotenv._setEnvs();
  dotenv.load();

  process.env = eson()
    .use(eson.ms)
    .use(convertStringToNumeral)
    .parse(JSON.stringify(process.env));

  process.env._VERSION_GIT_COMMIT = execSync('git rev-parse HEAD');
  process.env._VERSION_GIT_BRANCH = execSync('git rev-parse --abbrev-ref HEAD');

  process.env.ROOT_DIR = ROOT_DIR;
  if (!envIs('test')) {
    console.log('DOCKER LISTENER ENV', process.env.NODE_ENV, process.env);
  }
}

/**
 * helper - convert value from string to number if string represents
 * valid number
 */
function convertStringToNumeral(key, val) {
  if (typeof val === 'string' && !isNaN(val)) {
    return parseInt(val);
  } else {
    return val;
  }
}
