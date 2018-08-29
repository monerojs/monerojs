/**
 * monerojs
 * 
 * ES6 JavaScript Monero library 
 * https://github.com/monerojs/monerojs
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
'use strict'

var daemonRPC = require('./lib/daemonRPC.js');
var walletRPC = require('./lib/walletRPC.js');

// Exports

module.exports = {
  daemonRPC: daemonRPC,
  walletRPC: walletRPC
}
