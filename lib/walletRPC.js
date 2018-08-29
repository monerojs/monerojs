/**
 * monerojs/walletRPC
 * 
 * A class for making calls to monero-wallet-rpc using Node.js
 * https://github.com/monerojs/monerojs
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
'use strict'

const request = require('request-promise');
const http = require('http');

/**
 * @class walletRPC
 * @param {string} hostname - RPC hostname
 * @param {number} port - RPC port
 * @param {string} user - RPC username
 * @param {string} pass - RPC password
 * @param {string} protocol - RPC protocol
 * @param {string} network - Monero network to connect to (default: 'mainnet')
 *
 *   OR
 *
 * @param {object} params - The same parameters above in any order as an object/dictionary
 *
 * @return none
 *
 *   OR
 *
 * @param {object} params - Use test: true to test if a wallet from monero-wallet-rpc.json is available (running)
 *
 * @return {promise} resolve, reject
 */
class walletRPC {
  constructor(hostname = '127.0.0.1', port = 28083, user = undefined, pass = undefined, protocol = 'http', network = 'mainnet') {
    return new Promise((resolve, reject) => {
      this.wallets = require('./local-monero-wallet-rpcs.json');

      if (typeof hostname == 'object') { // Parameters can be passed in as object/dictionary
        let params = hostname;
        this.hostname = params['hostname'] || '127.0.0.1';
        this.port = params['port'] || port;
        this.user = params['user'] || user;
        this.pass = params['pass'] || pass;
        this.protocol = params['protocol'] || protocol;
        this.network = params['network'] || network;

        if (this.network in this.wallets) {
          this.wallets = this.wallets[this.network];
        } else {
          throw new Error(`No ${this.network} wallets found in list`);
          this.wallets = this.wallets['mainnet'];
        }

        // if ('wallets' in params) {
        //   // TODO set list of wallets from passed parameter, local file import, or HTTP/HTTPS URL
        // }

        if ('autoconnect' in params) {
          if (params['autoconnect']) { // TODO add mainnet/testnet toggle
            if ('random' in params) {
              // Fisher-Yates Shuffle  
              let i = 0,
                  j = 0,
                  temp = null;

              for (i = this.wallets.length - 1; i > 0; i -= 1) {
                j = Math.floor(Math.random() * (i + 1));
                temp = this.wallets[i];
                this.wallets[i] = this.wallets[j];
                this.wallets[j] = temp;
              }
            }

            // Try the passed wallet first
            if ('hostname' in params) {
              this.wallets.unshift({ hostname: this.hostname, port: this.port, protocol: this.protocol, user: this.user, pass: this.pass });
            }

            return this._autoconnect()
            .then(wallet => { // TODO add type for wallet
              this._run('get_balance') // This line is necessary in order to do the initial handshake between this wrapper and monero-wallet-rpc; without it, the first request to the wrapper fails (subsequent request succeed, though.)
              .then(() => {
                resolve(this);
              })
              .catch(err => {
                reject(err);
              });
            })
            .catch(err => {
              reject(err);
            });
          }
        }
      } else {
        this.hostname = hostname;
        this.port = port;
        this.user = user;
        this.pass = pass;
        this.protocol = protocol;
        this.network = network;
      }

      return this._autoconnect([{
        hostname: this.hostname,
        port: this.port,
        user: this.user,
        pass: this.pass,
        protocol: this.protocol
      }])
      .then(wallet => {
        this._run('get_balance') // This line is necessary in order to do the initial handshake between this wrapper and monero-wallet-rpc; without it, the first request to the wrapper fails (subsequent request succeed, though.)
        .then(() => {
          resolve(this);
        })
        .catch(err => {
          reject(err);
        });
      })
      .catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Autoconnect to a local or remote wallet
   * 
   * @function _autoconnect
   * @param {array} wallets - Array of wallet objects // TODO add type for wallet object
   *
   * @return {promise} resolve, reject
   */
  _autoconnect(wallets = this.wallets) {
    return new Promise((resolve, reject) => {
      let wallet = wallets.shift();

      this._test(wallet)
      .then(() => {
        this.hostname = wallet['hostname'];
        this.port = wallet['port'];
        this.protocol = wallet['protocol'];
        if ('user' in wallet)
          this.user = wallet['user'];
        if ('pass' in wallet)
          this.pass = wallet['pass'];
        if ('network' in wallet)
          this.network = wallet['network'];
        resolve(this);
      })
      .catch(err => {
        if (wallets.length > 0) {
          this._autoconnect(wallets)
          .then(wallet => { // TODO add wallet type
            resolve(wallet);
          })
          .catch(err => {
            reject('Failed to autoconnect to wallet', err);
          });
        } else {
          reject('Failed to autoconnect to wallet', err);
        }
      });
    });
  }

  /**
   * Test a local or remote Monero wallet RPC API for accessibility
   *
   * @function _test
   * @param {string} hostname - RPC hostname
   * @param {string} port - RPC port
   * @param {string} user - RPC user
   * @param {string} pass - RPC pass
   * @param {string} protocol - RPC protocol
   *
   *   OR
   *
   * @param {object} params - The same parameters above in any order as an object/dictionary
   *
   * @return {promise} resolve, reject
   */
  _test(hostname = this.hostname, port = this.port, user = this.user, pass = this.pass, protocol = this.protocol) {
    if (typeof hostname == 'object') {
      let params = hostname;

      hostname = params['hostname'] || this.hostname;
      port = params['port'] || port || this.port;
      user = params['user'] || user || this.user;
      pass = params['pass'] || pass || this.pass;
      protocol = params['protocol'] || protocol || this.protocol;
    }
    let options = {
      forever: true,
      json: {
        jsonrpc: '2.0',
        id: '0',
        method: 'get_address'
      }
    };

    if (user) {
      options['auth'] = {
        user: user,
        pass: pass,
        sendImmediately: false
      };
    }

    return new Promise((resolve, reject) => {
      return request.post(`${protocol}://${hostname}:${port}/json_rpc`, options)
      .then(result => {
        resolve({
          hostname: this.hostname,
          port: this.port,
          user: this.user,
          pass: this.pass,
          protocol: this.protocol
        }); // TODO test with authenticated endpoints
      })
      .catch(err => {
        reject();
      });
    });
  }

  /**
   * Execute command on the monero-wallet-rpc API
   *
   * @function _run
   * @param {string} ethod - RPC method to call
   * @param {string} arams - Options to include (optional)
   *
   * @returns {promise} resolve, reject
   *
   * @resolves {object} - Method result, possibly including error object
   */
  _run(method = null, params = undefined) {
    let options = {
      forever: true,
      json: {
        jsonrpc: '2.0',
        id: '0',
        method: method,
        params: params
      },
      agent: new http.Agent({
        keepAlive: true,
        maxSockets: 1
      })
    };

    if (this.user) {
      options['auth'] = {
        user: this.user,
        pass: this.pass,
        sendImmediately: false
      };
    }

    return request.post(`${this.protocol}://${this.hostname}:${this.port}/json_rpc`, options)
    .then(result => {
      if (result['result']) {
        return result['result'];
      } else {
        return result;
      }
    })
    .catch(err => {
      throw new Error(err);
    });
  }
  
  /**
   * Look up wallet balance
   *
   * @function get_balance
   *
   * @returns {object} - Example: {
   *   balance: 140000000000,
   *   unlocked_balance: 50000000000
   * }
   */
  get_balance() {
    return this._run('get_balance');
  }
  
  /**
   * Alias of get_balance
   *
   * @function getbalance
   *
   * @returns {object}
   */
  getbalance() {
    return this._run('getbalance');
  }
  
  /**
   * Look up wallet address(es)
   *
   * @function get_address
   * @param{{number}}ccount_index -- Index of account to look up   (optional)
   * @param({number})ddress_index -- Index of subaddress to look up (optional)
   *
   * @returns {object} - Example: {
   *   address: 'A2XE6ArhRkVZqepY2DQ5QpW8p8P2dhDQLhPJ9scSkW6q9aYUHhrhXVvE8sjg7vHRx2HnRv53zLQH4ATSiHHrDzcSFqHpARF',
   *   addresses: [
   *     {
   *       address: 'A2XE6ArhRkVZqepY2DQ5QpW8p8P2dhDQLhPJ9scSkW6q9aYUHhrhXVvE8sjg7vHRx2HnRv53zLQH4ATSiHHrDzcSFqHpARF',
   *       address_index: 0,
   *       label: 'Primary account',
   *       used: true
   *     }, {
   *       address: 'Bh3ttLbjGFnVGCeGJF1HgVh4DfCaBNpDt7PQAgsC2GFug7WKskgfbTmB6e7UupyiijiHDQPmDC7wSCo9eLoGgbAFJQaAaDS',
   *       address_index: 1,
   *       label: '',
   *       used: true
   *     }
   *   ]
   * }
   */
  get_address() {
    return this._run('get_address');
  }

  /** 
   * Alias of get_address
   *
   * @function getaddress
   * @param{{number}}ccount_index -- Index of account to look up   (optional)
   * @param({number})ddress_index -- Index of subaddress to look up (optional)
   *
   * @returns {object}
   */
  getaddress() {
    return this._run('getaddress');
  }
  
  /**
   * Create a new subaddress
   *
   * @function create_address
   * @param {number} account_index - The index of the account in which to create new subaddress
   * @param {string} label - Label to apply to new address
   *
   * @returns {object} - Example: {
   *   address: "Bh3ttLbjGFnVGCeGJF1HgVh4DfCaBNpDt7PQAgsC2GFug7WKskgfbTmB6e7UupyiijiHDQPmDC7wSCo9eLoGgbAFJQaAaDS"
   *   address_index: 1
   * }
   */
  create_address(account_index = 0, label = undefined) {
    let params = {
      account_index: account_index,
      label: label
    };
    let method = this._run('create_address', params);

    let save = this.store(); // Save wallet state after subaddress creation

    return method;
  }
  
  /**
   * Label an address
   *
   * @function label_address
   * @param {object} index - major (account) and minor (subaddress) indices to label
   * @param {string} label - label to use
   */
  label_address(index, label) {
    let params = {
      index: index,
      label: label
    };

    return this._run('label_address', params);
  }

  /**
   * Get wallet accounts
   *
   * @function get_accounts
   *
   * @returns {object} - Example: {
   *   subaddress_accounts: {
   *     0: {
   *       account_index: 0,
   *       balance: 2808597352948771,
   *       base_address: "A2XE6ArhRkVZqepY2DQ5QpW8p8P2dhDQLhPJ9scSkW6q9aYUHhrhXVvE8sjg7vHRx2HnRv53zLQH4ATSiHHrDzcSFqHpARF",
   *       label: "Primary account",
   *       tag: "",
   *       unlocked_balance: 2717153096298162
   *     },
   *     1: {
   *       account_index: 1,
   *       balance: 0,
   *       base_address: "BcXKsfrvffKYVoNGN4HUFfaruAMRdk5DrLZDmJBnYgXrTFrXyudn81xMj7rsmU5P9dX56kRZGqSaigUxUYoaFETo9gfDKx5",
   *       label: "Secondary account",
   *       tag: "",
   *       unlocked_balance: 0 )
   *    },
   *    total_balance: 2808597352948771,
   *    total_unlocked_balance: 2717153096298162
   * }
   */
  get_accounts() {
    return this._run('get_accounts');
  }
  
  /**
   * Create a new account
   *
   * @function create_account
   * @param {string} label - Account label
   */
  create_account(label = undefined) {
    let params = { label: label };
    let method = this._run('create_account', params);

    let save = this.store(); // Save wallet state after account creation

    return method;
  }
  
  /**
   * Label an account
   *
   * @function label_account
   * @param {number} account_index - Index of account to label
   * @param {string} label - Label to apply
   */
  label_account(account_index, label) {
    let params = {
      account_index: account_index,
      label: label
    };
    let method = this._run('label_account', params);

    let save = this.store(); // Save wallet state after account label

    return method;
  }
  
  /**
   * Get account tags
   *
   * @function get_account_tags
   *
   * @returns {object} - Example: {
   *   account_tags: {
   *     0: {
   *       accounts: {
   *         0: 0,
   *         1: 1
   *       },
   *       label: "",
   *       tag: "Example tag"
   *     }
   *   }
   * }
   */
  get_account_tags() {
    return this._run('get_account_tags');
  }
  
  /**
   * Tag a accounts
   *
   * @function tag_accounts
   * @param {array} accounts - Account indices to tag
   * @param {string} tag - Tag to apply
   */
  tag_accounts(accounts, tag) {
    let params = {
      accounts: accounts,
      tag: tag
    };
    let method = this._run('tag_accounts', params);

    let save = this.store(); // Save wallet state after account tagginng

    return method;
  }
  
  /**
   * Untag accounts
   *
   * @function untag_accounts
   * @param {array} account - Account indices to untag
   */
  untag_accounts(accounts) {
    let params = { accounts: accounts };
    let method = this._run('untag_accounts', params);

    let save = this.store(); // Save wallet state after untagging accounts

    return method;
  }
  
  /**
   * Describe a tag
   * 
   * @function set_account_tag_description
   * @param {string} tag - Tag to describe
   * @param {string} description - Description to apply to tag
   *
   * @returns {object} - Example: {
   * }
   */
  set_account_tag_description(tag, description) {
    let params = {
      tag: tag,
      description: description
    };
    let method = this._run('set_account_tag_description', params);

    let save = this.store(); // Save wallet state after describing tag

    return method;
  }
  
  /**
   * Look up current block height of wallet
   *
   * @function get_height
   *
   * @returns {object} - Example: {
   *   height: 994310
   * }
   */
  get_height() {
    return this._run('get_height');
  }
  
  /**
   * Alias of get_height
   *
   * @function getheight
   *
   * @returns {object}
   */
  getheight() {
    return this._run('getheight');
  }

  /**
   * Send monero.  Parameters can be passed in individually (as listed below) or as an object/dictionary (as listed at bottom.)  If multiple destinations are required, use the object/dictionary (bottom) format and pass an array of objects containing recipient addresses and amount in the destinations field, like destinations: [{amount: 1, address: ...}, {amount: 2, address: ...}]
   * 
   * @function transfer
   * @param {string} amount - Amount to transfer
   * @param {string} address - Address to transfer to
   * @param {string} payment_id - Payment ID                                                    (optional)
   * @param {boolean} get_tx_key - Return transaction key after generation                      (optional)
   * @param {number} mixin - Mixin amount (ringize - 1)                                         (optional)
   * @param {number} account_index - Account from which to send                                 (optional)
   * @param {string} subaddr_indices - Comma-separeted list of subaddress indices to spend from (optional)
   * @param {number} priority - Transaction priority                                            (optional)
   * @param {number} unlock_time - UNIX time or block height to unlock output                   (optional)
   * @param {boolean} do_not_relay - Do not relay transaction                                   (optional)
   * @param {boolean} get_tx_hex - Return transaction as hex after generation                   (optional)
   * @param {boolean} new_algorithm - Use the new transaction construction algorithm            (optional)
   * @param {boolean} get_tx_metadata - Return transaction metadata needed to relay later       (optional)
   * 
   *   OR
   * 
   * @param {object} params - Array containing any of the options listed above, where only amount and address or a destionations array are required
   *
   * @returns {object} - Example: {
   *   amount: "1000000000000",
   *   fee: "1000020000",
   *   tx_hash: "c60a64ddae46154a75af65544f73a7064911289a7760be8fb5390cb57c06f2db",
   *   tx_key: "805abdb3882d9440b6c80490c2d6b95a79dbc6d1b05e514131a91768e8040b04"
   * }
   */
  transfer(amount, address = undefined, payment_id = undefined, get_tx_key = false, mixin = 6, account_index = 0, subaddr_indices = undefined, priority = 2, unlock_time = undefined, do_not_relay = false, get_tx_hex = false, new_algorithm = false, get_tx_metadata = false) {
    let destinations = [];

    if (typeof amount == 'object') { // Parameters passed in as object/dictionary
      let params = amount;

      if ('destinations' in params) {
        destinations = params['destinations'];

        if (!(destinations.constructor === Array)) {
          throw new Error('Error: destinations must be an array');
        }

        for (let i = 0; i < destinations.length; i++) {
          if ('amount' in destinations[$destination]) {
            destinations[i]['amount'] = destinations[i]['amount'] * 1000000000000;
          } else {
            throw new Error('Error: Amount required');
          }
          if (!('address' in destinations[i])) {
            throw new Error('Error: Address required');
          }
        }
      } else {
        if ('amount' in params) {
          amount = params['amount'];
        } else {
          throw new Error('Error: Amount required');
        }
        if ('address' in params) {
          address = params['address'];
        } else {
          throw new Error('Error: Address required');
        }
    
        // Convert from moneroj to tacoshi (piconero)
        let new_amount = amount * 1000000000000;

        destinations = [{ amount: new_amount, address: address }];
      }
      if ('payment_id' in params) {
        payment_id = params['payment_id'];
      }
      if ('get_tx_key' in params) {
        get_tx_key = params['get_tx_key'];
      }
      if ('mixin' in params) {
        mixin = params['mixin'];
      }
      if ('account_index' in params) {
        account_index = params['account_index'];
      }
      if ('subaddr_indices' in params) {
        subaddr_indices = params['subaddr_indices'];
      }
      if ('priority' in params) {
        priority = params['priority'];
      }
      if ('unlock_time' in params) {
        unlock_time = params['unlock_time'];
      }
      if ('do_not_relay' in params) {
        do_not_relay = params['do_not_relay'];
      }
      if ('get_tx_hex' in params) {
        get_tx_hex = params['get_tx_hex'];
      }
      if ('new_algorithm' in params) {
        new_algorithm = params['new_algorithm'];
      }
      if ('get_tx_metadata' in params) {
        get_tx_metadata = params['get_tx_metadata'];
      }
    } else { // Legacy parameters used
      // Convert from moneroj to tacoshi (piconero)
      let new_amount = amount * 1000000000000;

      destinations = [{ amount: new_amount, address: address }];
    }

    let params = {
      destinations: destinations,
      mixin: mixin,
      payment_id: payment_id,
      get_tx_key: get_tx_key,
      account_index: account_index,
      subaddr_indices: subaddr_indices,
      priority: priority,
      do_not_relay: do_not_relay,
      get_tx_hex: get_tx_hex,
      new_algorithm: new_algorithm,
      get_tx_metadata: get_tx_metadata
    };
    let method = this._run('transfer', params);

    let save = this.store(); // Save wallet state after transfer

    return method;
  }
  
  /**
   * Same as transfer, but uses multiple transactions if necessary
   *
   * @function transfer_split
   * @param {string} amount - Amount to send
   * @param {string} address - Address to send to
   * @param {string} payment_id - Payment ID                                                    (optional)
   * @param {boolean} get_tx_keys - Return transaction keys after generation                     (optional)
   * @param {number} mixin - Mixin amount (ringize - 1)                                         (optional)
   * @param {number} account_index - Account from which to send                                 (optional)
   * @param {string} subaddr_indices - Comma-separeted list of subaddress indices to spend from (optional)
   * @param {number} priority - Transaction priority                                            (optional)
   * @param {number} unlock_time - UNIX time or block height to unlock output                   (optional)
   * @param {boolean} do_not_relay - Do not relay transaction                                   (optional)
   * @param {boolean} get_tx_hex - Return transaction as hex after generation                   (optional)
   * @param {boolean} new_algorithm - Use the new transaction construction algorithm            (optional)
   * @param {boolean} get_tx_metadata - Return transaction metadata needed to relay later       (optional)
   * 
   *   OR
   * 
   * @param {object} params - Array containing any of the options listed above, where only amount and address or a destionations array are required
   *
   * @returns {object}
   */
  transfer_split(amount, address = undefined, payment_id = undefined, get_tx_keys = false, mixin = 6, account_index = 0, subaddr_indices = undefined, priority = 2, unlock_time = undefined, do_not_relay = false, get_tx_hex = false, new_algorithm = false, get_tx_metadata = false) {
    let destinations = [];

    if (typeof amount == 'object') { // Parameters passed in as object/dictionary
      let params = amount;

      if ('destinations' in params) {
        destinations = params['destinations'];

        if (!(destinations.constructor === Array)) {
          throw new Error('Error: destinations must be an array');
        }

        for (let i = 0; i < destinations.length; i++) {
          if ('amount' in destinations[$destination]) {
            destinations[i]['amount'] = destinations[i]['amount'] * 1000000000000;
          } else {
            throw new Error('Error: Amount required');
          }
          if (!('address' in destinations[i])) {
            throw new Error('Error: Address required');
          }
        }
      } else {
        if ('amount' in params) {
          amount = params['amount'];
        } else {
          throw new Error('Error: Amount required');
        }
        if ('address' in params) {
          address = params['address'];
        } else {
          throw new Error('Error: Address required');
        }
    
        // Convert from moneroj to tacoshi (piconero)
        let new_amount = amount * 1000000000000;

        destinations = [{ amount: new_amount, address: address }];
      }
      if ('mixin' in params) {
        mixin = params['mixin'];
      }
      if ('payment_id' in params) {
        payment_id = params['payment_id'];
      }
      if ('get_tx_keys' in params) {
        get_tx_keys = params['get_tx_keys'];
      }
      if ('account_index' in params) {
        account_index = params['account_index'];
      }
      if ('subaddr_indices' in params) {
        subaddr_indices = params['subaddr_indices'];
      }
      if ('priority' in params) {
        priority = params['priority'];
      }
      if ('unlock_time' in params) {
        unlock_time = params['unlock_time'];
      }
      if ('do_not_relay' in params) {
        do_not_relay = params['do_not_relay'];
      }
      if ('get_tx_hex' in params) {
        get_tx_hex = params['get_tx_hex'];
      }
      if ('new_algorithm' in params) {
        new_algorithm = params['new_algorithm'];
      }
      if ('get_tx_metadata' in params) {
        get_tx_metadata = params['get_tx_metadata'];
      }
    } else { // Legacy parameters used
      // Convert from moneroj to tacoshi (piconero)
      let new_amount = amount * 1000000000000;

      destinations = [{ amount: new_amount, address: address }];
    }

    let params = {
      destinations: destinations,
      mixin: mixin,
      get_tx_keys: get_tx_keys,
      account_index: account_index,
      subaddr_indices: subaddr_indices,
      payment_id: payment_id,
      priority: priority,
      unlock_time: unlock_time,
      do_not_relay: do_not_relay,
      get_tx_hex: get_tx_hex,
      new_algorithm: new_algorithm,
      get_tx_metadata: get_tx_metadata
    };
    let method = this._run('transfer_split', params);

    let save = this.store(); // Save wallet state after transfer

    return method;
  }
  
  /**
   * Send all dust outputs back to the wallet to make them easier to spend (and mix)
   *
   * @function sweep_dust
   *
   * @returns {object} - Example: {
   *   multisig_txset: []
   * }
   */
  sweep_dust() {
    return this._run('sweep_dust');
  }
  
  /**
   * Send all unmixable output back to the wallet
   *
   * @function sweep_unmixable
   *
   * @returns {object} - Example: {
   *   multisig_txset: []
   * }
   */
  sweep_unmixable() {
    return this._run('sweep_unmixable');
  }
  
  /**
   * Send all unlocked balance from an account to an address
   * 
   * @function sweep_all
   * @param {string} address - Address to send to
   * @param {string} subaddr_indices - Comma-seperated list of subaddress indices to sweep (optional)
   * @param {number} account_index - Account index to sweep                                (optional)
   * @param {string} payment_id - Payment ID                                               (optional)
   * @param {boolean} get_tx_keys - Return transaction keys after generation               (optional)
   * @param {number} mixin - Mixin amount (ringsize - 1)                                   (optional)
   * @param {number} priority - Payment ID                                                 (optional)
   * @param {number} below_amount - Only send outputs below this amount                    (optional)
   * @param {number} unlock_time - UNIX time or block height to unlock output              (optional)
   * @param {boolean} do_not_relay - Do not relay transaction                              (optional)
   * @param {boolean} get_tx_hex - Return transaction as hex after generation              (optional)
   * @param {boolean} get_tx_metadata - Return transaction metadata needed to relay later  (optional)
   * 
   *   OR
   * 
   * @param {object} params - Array containing any of the options listed above, where only address is required
   *
   * @returns {object} - Example: {
   *   amount: "1000000000000",
   *   fee: "1000020000",
   *   tx_hash: "c60a64ddae46154a75af65544f73a7064911289a7760be8fb5390cb57c06f2db",
   *   tx_key: "805abdb3882d9440b6c80490c2d6b95a79dbc6d1b05e514131a91768e8040b04"
   * }
   */
  sweep_all(address, subaddr_indices = undefined, account_index = 0, payment_id = undefined, get_tx_keys = false, mixin = 6, priority = 2, below_amount = 0, unlock_time = undefined, do_not_relay = false, get_tx_hex = false, get_tx_metadata = false) {
    let new_below_amount = 0;

    if (typeof address == 'object') { // Parameters passed in as object/dictionary
      let params = address;

      if ('address' in params) {
        address = params['address'];
      } else {
        throw new Error('Error: Address required');
      }
      if ('subaddr_indices' in params) {
        subaddr_indices = params['subaddr_indices'];
      }
      if ('account_index' in params) {
        account_index = params['account_index'];
      }
      if ('payment_id' in params) {
        payment_id = params['payment_id'];
      }
      if ('get_tx_keys' in params) {
        get_tx_keys = params['get_tx_keys'];
      }
      if ('mixin' in params) {
        mixin = params['mixin'];
      }
      if ('priority' in params) {
        priority = params['priority'];
      }
      if ('below_amount' in params) {
        below_amount = params['below_amount'];

        // Convert from moneroj to tacoshi (piconero)
        new_below_amount = below_amount * 1000000000000;
      }
      if ('unlock_time' in params) {
        unlock_time = params['unlock_time'];
      }
      if ('do_not_relay' in params) {
        do_not_relay = params['do_not_relay'];
      }
      if ('get_tx_hex' in params) {
        get_tx_hex = params['get_tx_hex'];
      }
      if ('get_tx_metadata' in params) {
        get_tx_metadata = params['get_tx_metadata'];
      }
    } else { // Legacy parameters used
      // Convert from moneroj to tacoshi (piconero)
      new_below_amount = below_amount * 1000000000000;
    }

    let params = {
      address: address,
      mixin: mixin,
      get_tx_key: true,
      subaddr_indices: subaddr_indices,
      account_index: account_index,
      payment_id: payment_id,
      get_tx_keys: get_tx_keys,
      priority: priority,
      below_amount: new_below_amount,
      unlock_time: unlock_time,
      do_not_relay: do_not_relay,
      get_tx_hex: get_tx_hex,
      get_tx_metadata: get_tx_metadata
    };
    let method = this._run('sweep_all', params);

    let save = this.store(); // Save wallet state after transfer

    return method;
  }
  
  /**
   * Sweep a single key image to an address
   * 
   * @function sweep_single
   * @param {string} key_image - Key image to sweep
   * @param {string} address - Address to send to
   * @param {string} payment_id - Payment ID                                               (optional)
   * @param {boolean} get_tx_keys - Return transaction keys after generation               (optional)
   * @param {number} below_amount - Only send outputs below this amount                    (optional)
   * @param {number} mixin - Mixin amount (ringsize - 1)                                   (optional)
   * @param {number} priority - Payment ID                                                 (optional)
   * @param {number} unlock_time - UNIX time or block height to unlock output              (optional)
   * @param {boolean} do_not_relay - Do not relay transaction                              (optional)
   * @param {boolean} get_tx_hex - Return transaction as hex after generation              (optional)
   * @param {boolean} get_tx_metadata - Return transaction metadata needed to relay later  (optional)
   * 
   *   OR
   * 
   * @param {object} params - Array containing any of the options listed above, where only address is required
   *
   * @returns {object} - Example: {
   *   amount: "1000000000000",
   *   fee: "1000020000",
   *   tx_hash: "c60a64ddae46154a75af65544f73a7064911289a7760be8fb5390cb57c06f2db",
   *   tx_key: "805abdb3882d9440b6c80490c2d6b95a79dbc6d1b05e514131a91768e8040b04"
   * }
   */
  sweep_single(key_image, address, payment_id = undefined, get_tx_keys = false, mixin = 6, priority = 2, below_amount = 0, unlock_time = undefined, do_not_relay = 0, get_tx_hex = false, get_tx_metadata = false) {
    if (typeof key_image == 'object') { // Parameters passed in as object/dictionary
      let params = key_image;

      if ('key_image' in params) {
        key_image = params['key_image'];
      } else {
        throw new Error('Error: Key image required');
      }
      if ('address' in params) {
        address = params['address'];
      } else {
        throw new Error('Error: Address required');
      }

      if ('payment_id' in params) {
        payment_id = params['payment_id'];
      }
      if ('get_tx_keys' in params) {
        get_tx_keys = params['get_tx_keys'];
      }
      if ('mixin' in params) {
        mixin = params['mixin'];
      }
      if ('account_index' in params) {
        account_index = params['account_index'];
      }
      if ('priority' in params) {
        priority = params['priority'];
      }
      if ('unlock_time' in params) {
        unlock_time = params['unlock_time'];
      }
      if ('unlock_time' in params) {
        unlock_time = params['unlock_time'];
      }
      if ('below_amount' in params) {
        below_amount = params['below_amount'];

        // Convert from moneroj to tacoshi (piconero)
        let new_below_amount = below_amount * 1000000000000;
      }
      if ('do_not_relay' in params) {
        do_not_relay = params['do_not_relay'];
      }
      if ('new_algorithm' in params) {
        new_algorithm = params['new_algorithm'];
      }
      if ('get_tx_metadata' in params) {
        get_tx_metadata = params['get_tx_metadata'];
      }
    } else { // Legacy parameters used
      // Convert from moneroj to tacoshi (piconero)
      let new_below_amount = below_amount * 1000000000000;
    }

    let params = {
      address: address,
      mixin: mixin,
      get_tx_key: true,
      account_index: account_index,
      payment_id: payment_id,
      get_tx_keys: get_tx_keys,
      priority: priority,
      below_amount: new_below_amount,
      unlock_time: unlock_time,
      do_not_relay: do_not_relay,
      get_tx_hex: get_tx_hex,
      get_tx_metadata: get_tx_metadata
    };
    let method = this._run('sweep_single', params);

    let save = this.store(); // Save wallet state after transfer

    return method;
  }
  
  /**
   * Relay a transaction
   *
   * @function relay_tx
   * @param {string} hex - Transaction metadata in hex as string
   *
   * @returns {object} - Example: {
   *   fee: 0,
   *   tx_blob: '',
   *   tx_hash: '0e4b1a1755ba7279bbb2207975a6a87b8ac38a5b63303f1f6c3825d6e01c6c93',
   *   tx_key: ''
   * }
   */
  relay_tx(hex) {
    let params = { hex: hex };
    let method = this._run('relay_tx', params);

    let save = this.store(); // Save wallet state after transaction relay

    return method;
  }
  
  /**
   * Save wallet state to file
   *
   * @function store
   */
  store() {
    return this._run('store');
  }
  
  /**
   * Get a list of incoming payments using a given payment ID
   *
   * @function get_payments
   * @param {string} payment_id - Payment ID to look up
   *
   * @returns {object} - Example: {
   *   payments: [{
   *     amount: 10350000000000,
   *     block_height: 994327,
   *     payment_id: "4279257e0a20608e25dba8744949c9e1caff4fcdafc7d5362ecf14225f3d9030",
   *     tx_hash: "c391089f5b1b02067acc15294e3629a463412af1f1ed0f354113dd4467e4f6c1",
   *     unlock_time: 0
   *   }]
   * }
   */
  get_payments(payment_id) {
    let params = { payment_id: payment_id };
    return this._run('get_payments', params);
  }
  
  /**
   * Get a list of incoming payments using an array of payment IDs from a given height
   *
   * @function get_bulk_payments
   * @param {array} payment_ids - Array of payment ID to look up
   * @param {string} min_block_height - Height to begin search
   *
   * @returns {object} - Example: {
   *   payments: [{
   *     amount: 10350000000000,
   *     block_height: 994327,
   *     payment_id: "4279257e0a20608e25dba8744949c9e1caff4fcdafc7d5362ecf14225f3d9030",
   *     tx_hash: "c391089f5b1b02067acc15294e3629a463412af1f1ed0f354113dd4467e4f6c1",
   *     unlock_time: 0
   *   }]
   * }
   */
  get_bulk_payments(payment_ids, min_block_height) {
    let params = {
      payment_id: payment_ids,
      min_block_height:min_block_height
    };

    return this._run('get_bulk_payments', params);
  }
  
  /**
   * Look up incoming transfers
   *
   * @function incoming_transfers
   * @param {string} type - Type of transfer to look up; must be 'all', 'available', or 'unavailable' (incoming transfers which have already been spent)
   * @param {number} account_index - Index of account to look up                                                                                         (optional)
   * @param {string} subaddr_indices - Comma-seperated list of subaddress indices to look up                                                             (optional)
   *
   * @returns {object} - Example: {
   *   transfers: [{
   *     amount: 10000000000000,
   *     global_index: 711506,
   *     spent: false,
   *     tx_hash: "c391089f5b1b02067acc15294e3629a463412af1f1ed0f354113dd4467e4f6c1",
   *     tx_size: 5870
   *   }, {
   *     amount: 300000000000,
   *     global_index: 794232,
   *     spent: false,
   *     tx_hash: "c391089f5b1b02067acc15294e3629a463412af1f1ed0f354113dd4467e4f6c1",
   *     tx_size: 5870
   *   }, {
   *     amount: 50000000000,
   *     global_index: 213659,
   *     spent: false,
   *     tx_hash: "c391089f5b1b02067acc15294e3629a463412af1f1ed0f354113dd4467e4f6c1",
   *     tx_size: 5870
   *   }]
   * }
   */
  incoming_transfers(type = 'all', account_index = 0, subaddr_indices = undefined) {
    let params = {
      transfer_type: type,
      account_index: account_index,
      subaddr_indices: subaddr_indices
    };

    return this._run('incoming_transfers', params);
  }
  
  /**
   * Query wallet key
   *
   * @function key_type
   * @param {string} key_type - Type of key to look up; must be 'view_key', 'spend_key', or 'mnemonic'
   *
   * @returns {object} - Example: {
   *   key: "7e341d..."
   * }
   */
  query_key(key_type) {
    let params = { key_type: key_type };
    return this._run('query_key', params);
  }
  
  /**
   * Look up wallet view key
   *
   * @function view_key
   *
   * @returns {object} - Example: {
   *   key: "7e341d..."
   * }
   */
  view_key() {
    let params = { key_type: 'view_key' };
    return this._run('query_key', params);
  }
  
  /**
   * Look up wallet spend key
   *
   * @function spend_key
   *
   * @returns {object} - Example: {
   *   key: "2ab810..."
   * }
   */
  spend_key() {
    let params = { key_type: 'spend_key' };
    return this._run('query_key', params);
  }
  
  /**
   * Look up wallet spend key
   *
   * @function mnemonic
   *
   * @returns {object} - Example: {
   *   key: "2ab810..."
   * }
   */
  mnemonic() {
    let params = { key_type: 'mnemonic' };
    return this._run('query_key', params);
  }
  
  /**
   * Make an integrated address for the current account from the given payment ID
   *
   * @function make_integrated_address
   * @param {string} payment_id - Payment ID to use when generating an integrated address (optional)
   *
   * @returns {object} - Example: {
   *   integrated_address: "4BpEv3WrufwXoyJAeEoBaNW56ScQaLXyyQWgxeRL9KgAUhVzkvfiELZV7fCPBuuB2CGuJiWFQjhnhhwiH1FsHYGQQ8H2RRJveAtUeiFs6J"
   * }
   */
  make_integrated_address(payment_id = undefined) {
    let params = { payment_id: payment_id };
    return this._run('make_integrated_address', params);
  }
  
  /**
   * Retrieve the standard address and payment ID from an integrated address
   *
   * @function split_integrated_address
   * @param {string} integrated_address - Integrated address to split
   *
   * @returns {object} - Example: {
   *   payment_id: "420fa29b2d9a49f5",
   *   standard_address: "427ZuEhNJQRXoyJAeEoBaNW56ScQaLXyyQWgxeRL9KgAUhVzkvfiELZV7fCPBuuB2CGuJiWFQjhnhhwiH1FsHYGQGaDsaBA"
   * }
   */
  split_integrated_address(integrated_address) {
    let params = { integrated_address: integrated_address };
    return this._run('split_integrated_address', params);
  }
  
  /**
   * Stop the wallet, saving the state
   *
   * @function stop_wallet
   *
   */
  stop_wallet() {
    return this._run('stop_wallet');
  }
  
  /**
   * Rescan blockchain from scratch
   * WARNING: Deletes wallet cache.  Anything that's not on the blockchain will be deleted by this method, including (but not limited to) tx_keys and recipient addresses for outgoing txes.
   *
   * @function rescan_blockchain
   *
   */
  rescan_blockchain() {
    let method = this._run('rescan_blockchain');

    let save = this.store(); // Save wallet state after blockchain scan

    return method;
  }
  
  /**
   * Set arbitrary string notes for transactions
   *
   * @function set_tx_notes
   * @param {array} txids - Array of transaction IDs (strings) to apply notes to
   * @param {array} notes - Array of notes (strings) to add
   */
  set_tx_notes(txids, notes) {
    let params = {
      txids: txids,
      notes: notes
    };

    return this._run('set_tx_notes', params);
  }
  
  /**
   * Get string notes for transactions
   *
   * @function get_tx_notes
   * @param {array} txids - Array of transaction IDs (strings) to look up
   */
  get_tx_notes(txids) {
    let params = { txids: txids };
    return this._run('get_tx_notes', params);
  }
  
  /**
   * Set an option in the wallet
   *
   * @function set_attribute
   * @param {string} key - Option to set
   * @param {string} value - Value to set
   */
  set_attribute(key, value) {
    let params = {
      key: key,
      value: value
    };

    return this._run('set_attribute', params);
  }
  
  /**
   * Look up a  wallet option
   *
   * @function 
   * @param {string} key - Wallet option to look up
   *
   * @returns {object} - Example: {
   *   // TODO example
   * }
   */
  get_attribute(key) {
    let params = { key: key };
    return this._run('get_attribute', params);
  }
  
  /**
   * Get a transaction key
   *
   * @function get_tx_key
   * @param {string} txid - Transaction ID
   *
   * @returns  object - Example: {
   *   tx_key: "e8e97866b1606bd87178eada8f995bf96d2af3fec5db0bc570a451ab1d589b0f"
   * }
   */
  get_tx_key(txid) {
    let params = { txid: txid };
    return this._run('get_tx_key', params);
  }
  
  /**
   * Check a transaction key
   *
   * @function check_tx_key
   * @param {string} address - Address that sent transfer
   * @param {string} txid - Transaction ID
   * @param {string} tx_key - Transaction key
   *
   * @returns  object - Example: {
   *   confirmations: 1,
   *   in_pool: ,
   *   received: 0
   * }
   */
  check_tx_key(address, txid, tx_key) {
    let params = {
      address: address,
      txid: txid,
      tx_key: tx_key
    };

    return this._run('check_tx_key', params);
  }
  
  /**
   * Get proof (signature) of transaction
   *
   * @function get_tx_proof
   * @param {string} address - Address that spent funds
   * @param {string} txid - Transaction ID
   *
   * @returns {object} - Example: {
   *   signature: "InProofV1Lq4nejMXxMnAdnLeZhHe3FGCmFdnSvzVM1AiGcXjngTRi4hfHPcDL9D4th7KUuvF9ZHnzCDXysNBhfy7gFvUfSbQWiqWtzbs35yUSmtW8orRZzJpYKNjxtzfqGthy1U3puiF"
   * }
   */
  get_tx_proof(address, txid) {
    let params = {
      address: address,
      txid: txid
    };

    return this._run('get_tx_proof', params);
  }
  
  /**
   * Verify transaction porof
   *
   * @function check_tx_proof
   * @param {string} address - Address that spent funds
   * @param {string} txid - Transaction ID
   * @param {string} signature - Signature (tx_proof)
   *
   * @returns   Example: {
   *   confirmations: 2,
   *   good: 1,
   *   in_pool: ,
   *   received: 15752471409492,
   * }
   */
  check_tx_proof(address, txid, signature) {
    let params = {
      address: address,
      txid: txid,
      signature: signature
    };

    return this._run('check_tx_proof', params);
  }
  
  /**
   * Get proof of a spend
   *
   * @function get_spend_proof
   * @param {string} txid - Transaction ID
   *
   * @returns {object} - Example: {
   *   signature: "SpendProofV1RnP6ywcDQHuQTBzXEMiHKbe5ErzRAjpUB1h4RUMfGPNv4bbR6V7EFyiYkCrURwbbrYWWxa6Kb38ZWWYTQhr2Y1cRHVoDBkK9GzBbikj6c8GWyKbu3RKi9hoYp2fA9zze7UEdeNrYrJ3tkoE6mkR3Lk5HP6X2ixnjhUTG65EzJgfCS4qZ85oGkd17UWgQo6fKRC2GRgisER8HiNwsqZdUTM313RmdUX7AYaTUNyhdhTinVLuaEw83L6hNHANb3aQds5CwdKCUQu4pkt5zn9K66z16QGDAXqL6ttHK6K9TmDHF17SGNQVPHzffENLGUf7MXqS3Pb6eijeYirFDxmisZc1n2mh6d5EW8ugyHGfNvbLEd2vjVPDk8zZYYr7NyJ8JjaHhDmDWeLYy27afXC5HyWgJH5nDyCBptoCxxDnyRuAnNddBnLsZZES399zJBYHkGb197ZJm85TV8SRC6cuYB4MdphsFdvSzygnjFtbAcZWHy62Py3QCTVhrwdUomAkeNByM8Ygc1cg245Se1V2XjaUyXuAFjj8nmDNoZG7VDxaD2GT9dXDaPd5dimCpbeDJEVoJXkeEFsZF85WwNcd67D4s5dWySFyS8RbsEnNA5UmoF3wUstZ2TtsUhiaeXmPwjNvnyLif3ASBmFTDDu2ZEsShLdddiydJcsYFJUrN8L37dyxENJN41RnmEf1FaszBHYW1HW13bUfiSrQ9sLLtqcawHAbZWnq4ZQLkCuomHaXTRNfg63hWzMjdNrQ2wrETxyXEwSRaodLmSVBn5wTFVzJe5LfSFHMx1FY1xf8kgXVGafGcijY2hg1yw8ru9wvyba9kdr16Lxfip5RJGFkiBDANqZCBkgYcKUcTaRc1aSwHEJ5m8umpFwEY2JtakvNMnShjURRA3yr7GDHKkCRTSzguYEgiFXdEiq55d6BXDfMaKNTNZzTdJXYZ9A2j6G9gRXksYKAVSDgfWVpM5FaZNRANvaJRguQyqWRRZ1gQdHgN4DqmQ589GPmStrdfoGEhk1LnfDZVwkhvDoYfiLwk9Z2JvZ4ZF4TojUupFQyvsUb5VPz2KNSzFi5wYp1pqGHKv7psYCCodWdte1waaWgKxDken44AB4k6wg2V8y1vG7Nd4hrfkvV4Y6YBhn6i45jdiQddEo5Hj2866MWNsdpmbuith7gmTmfat77Dh68GrRukSWKetPBLw7Soh2PygGU5zWEtgaX5g79FdGZg"
   * }
   */
  get_spend_proof(txid) {
    let params = { txid: txid };
    return this._run('get_spend_proof', params);
  }
  
  /**
   * Verify spend proof
   *
   * @function check_spend_proof
   * @param {string} txid - Transaction ID
   * @param {string} signature - Spend proof to verify
   *
   * @returns {object} - Example: {
   *   good: 1
   * }
   */
  check_spend_proof(txid, signature) {
    let params = {
      txid: txid,
      signature: signature
    };

    return this._run('check_spend_proof', params);
  }
  
  /**
   * Get proof of reserves
   *
   * @function get_reserve_proof
   * @param {string} account_index - Comma-separated list of account indices of which to prove reserves.  If empty, proves reserve of all accounts (optional)
   *
   * @returns   Example: {
   *   signature: "ReserveProofV11BZ23sBt9sZJeGccf84mzyAmNCP3KzYbE111111111111AjsVgKzau88VxXVGACbYgPVrDGC84vBU61Gmm2eiYxdZULAE4yzBxT1D9epWgCT7qiHFvFMbdChf3CpR2YsZj8CEhp8qDbitsfdy7iBdK6d5pPUiMEwCNsCGDp8AiAc6sLRiuTsLEJcfPYEKe"
   * }
   */
  get_reserve_proof(account_index = 'all') {
    if (account_index == 'all') {
      let params = { all: true };
    } else {
      let params = { account_index: account_index };
    }

    return this._run('get_reserve_proof');
  }
  
  /**
   * Verify a reserve proof
   *
   * @function check_reserve_proof
   * @param {string} address - Wallet address
   * @param {string} signature - Reserve proof
   *
   * @returns {object} - Example: {
   *   good: 1,
   *   spent: 0,
   *   total: 0
   * }
   */
  check_reserve_proof(address, signature) {
    let params = {
      address: address,
      signature: signature
    };

    return this._run('check_reserve_proof', params);
  }
  
  /**
   * Look up transfers
   *
   * @function get_transfers
   * @param {array} input_types - Array of transfer type strings; possible values include 'all', in', 'out', 'pending', 'failed', and 'pool' (optional)
   * @param {number} account_index - Index of account to look up                                                                                (optional)
   * @param {string} subaddr_indices - Comma-seperated list of subaddress indices to look up                                                      (optional)
   * @param {number} min_height - Minimum block height to use when looking up transfers                                                      (optional)
   * @param {number} max_height - Maximum block height to use when looking up transfers                                                      (optional)
   *
   *   OR
   *
   * @param {object} params - Array containing any of the options listed above, where only an input types array is required
   *
   * @returns {object} - Example: {
   *   pool: [{
   *     amount: 500000000000,
   *     fee: 0,
   *     height: 0,
   *     note: "",
   *     payment_id: "758d9b225fda7b7f",
   *     timestamp: 1488312467,
   *     txid: "da7301d5423efa09fabacb720002e978d114ff2db6a1546f8b820644a1b96208",
   *     type: "pool"
   *   }]
   * }
   */
  get_transfers(input_types = ['all'], account_index = 0, subaddr_indices = undefined, min_height = 0, max_height = 4206931337) {
    if (typeof input_types == 'string') { // If user is using old method
      let params = {};
      params[input_type] = account_index; // params[input_type] = input_value;
    } else {
      if (typeof input_types == 'object') { // Parameters passed in as object/dictionary
        let params = input_types;

        if ('input_types' in params) {
          input_types = params['input_types'];
        } else {
          input_types = ['all'];
        }
        if ('account_index' in params) {
          account_index = params['account_index'];
        }
        if ('subaddr_indices' in params) {
          subaddr_indices = params['subaddr_indices'];
        }
        if ('min_height' in params) {
          min_height = params['min_height'];
        }
        if ('max_height' in params) {
          max_height = params['max_height'];
        }
      }

      let params = {
        account_index: account_index,
        subaddr_indices: subaddr_indices,
        min_height: min_height,
        max_height: max_height
      };

      for (let i = 0; i < input_types.length; i++) {
        params[input_types[i]] = true;
      }
    }

    if ((min_height || $max_height) && $max_height != 4206931337) {
      params['filter_by_height'] = true;
    }

    return this._run('get_transfers', params);
  }
  
  /**
   * Show information about a transfer with a given transaction ID
   *
   * @function get_transfer_by_txid
   * @param {string} txid - Transaction ID to look up
   * @param {string} account_index - Index of account to search (optional)
   *
   * @returns {object} - Example: {
   *   transfer: {
   *     amount: 10000000000000,
   *     fee: 0,
   *     height: 1316388,
   *     note: "",
   *     payment_id: "0000000000000000",
   *     timestamp: 1495539310,
   *     txid: "f2d33ba969a09941c6671e6dfe7e9456e5f686eca72c1a94a3e63ac6d7f27baf",
   *     type: "in"
   *   }
   * }
   */
  get_transfer_by_txid(txid, account_index = 0) {
    let params = {
      txid: txid,
      account_index: account_index
    };

    return this._run('get_transfer_by_txid', params);
  }
  
  /**
   * Sign a string
   *
   * @function sign
   * @param {string} data - Data to sign
   *
   * @returns {object} - Example: {
   *   signature: "SigV1Xp61ZkGguxSCHpkYEVw9eaWfRfSoAf36PCsSCApx4DUrKWHEqM9CdNwjeuhJii6LHDVDFxvTPijFsj3L8NDQp1TV"
   * }
   */
  sign(data) {
    let params = { string: data };
    return this._run('sign', params);
  }
  
  /**
   * Verify a signature on a string
   *
   * @function verify
   * @param {string} data - Signed data
   * @param {string} address - Address that signed data
   * @param {string} signature - Signature to verify
   *
   * @returns boolean  $good       Verification status
   * 
   */
  verify(data, address, signature) {
    let params = {
      data: data,
      address: address,
      signature: signature
    };

    return this._run('verify', params);
  }
  
  /**
   * Export an array of signed key images
   *
   * @function export_key_images
   *
   * @returns {object} - Example: {
   *   // TODO example
   * }
   *
   */
  export_key_images() {
    return this._run('export_key_images');
  }
  
  /**
   * Import a signed set of key images
   *
   * @function import_key_images
   * @param {array} signed_key_images - Array of signed key images
   *
   * @param {number} height - 
   * @param {number} spent - 
   * @param {number} unspent - 
   *
   * @returns {object} - Example: {
   *   // TODO example
   *   height: ,
   *   spent: ,
   *   unspent: 
   * }
   */
  import_key_images(signed_key_images) {
    let params = { signed_key_images: signed_key_images };
    return this._run('import_key_images', params);
  }

  /**
   * Create a payment URI using the official URI spec
   *
   * @function make_uri
   * @param {string} address - Recipient address
   * @param {string} amount - Amount to request
   * @param {string} payment_id - Payment ID              (optional)
   * @param {string} recipient_name - Name of recipient   (optional)
   * @param {string} tx_description - Payment description (optional)

   * @returns {object} - Example: {
   *   // TODO example
   * }
   */
  make_uri(address, amount, payment_id = null, recipient_name = undefined, tx_description = undefined) {
    // Convert from moneroj to tacoshi (piconero)
    let new_amount = amount * 1000000000000;
       
    let params = {
      address: address,
      amount: new_amount,
      payment_id: payment_id,
      recipient_name: recipient_name,
      tx_description: tx_description
    };

    return this._run('make_uri', params);
  }

  /**
   * Parse a payment URI to get payment information
   *
   * @function parse_uri
   * @param {string} uri - Payment URI
   *
   * @returns {object} - Example: {
   *   uri: {
   *     address: "44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A",
   *     amount: 10,
   *     payment_id: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
   *     recipient_name: "Monero Project donation address",
   *     tx_description: "Testing out the make_uri function"
   *   }
   * }
   */
  parse_uri(uri) {
    let params = { uri: uri };
    return this._run('parse_uri', params);
  }
  
  /**
   * Retrieve entries from the address book
   *
   * @function get_address_book
   * @param {array} entries - Array of indices to return from the address book
   *
   * @returns {object} - Example: {
   *   // TODO example
   * }
   */
  get_address_book(entries) {
    let params = { entries: entries };
    return this._run('get_address_book', params);
  }
  
  /**
   * Retrieve entries from the address book
   *
   * @function add_address_book
   * @param {string} address - Address to add to address book
   * @param {string} payment_id - Payment ID to use with address in address book (optional)
   * @param {string} description - Description of address                         (optional)
   *
   * @returns {number} - Index of address in address book, Example:  {
   *   // TODO example
   * }
   */
  add_address_book(address, payment_id, description) {
    let params = {
      address: address,
      payment_id: payment_id,
      description: description
    };

    return this._run('add_address_book', params);
  }
  
  /**
   * Delete an entry from the address book
   *
   * @function delete_address_book
   * @param {array} index - Index of the address book entry to remove
   */
  delete_address_book(index) {
    let params = { index: index };
    return this._run('delete_address_book', params);
  }
  
  /**
   * Rescan the blockchain for spent outputs
   * 
   * @function rescan_spent
   */
  rescan_spent() {
    return this._run('rescan_spent');
  }
  
  /**
   * Start mining in the Monero daemon
   *
   * @function start_mining
   * @param {number} threads_count - Number of threads with which to mine
   * @param {boolean} do_background_mining - Mine in backgound?
   * @param {boolean} ignore_battery - Ignore battery?
   */
  start_mining(threads_count, do_background_mining, ignore_battery) {
    let params = {
      threads_count: threads_count,
      do_background_mining: do_background_mining,
      ignore_battery: ignore_battery
    };

    return this._run('start_mining', params);
  }
  
  /**
   * Stop mining
   *
   * @function stop_mining
   */
  stop_mining() {
    return this._run('stop_mining');
  }
  
  /**
   * Get a list of available languages for your wallet's seed
   *
   * @function get_languages
   */
  get_languages() {
    return this._run('get_languages');
  }
  
  /**
   * Create a new wallet
   *
   * @function create_wallet
   * @param {string} filename - Filename to use for new wallet
   * @param {string} password - Password to use for new wallet
   * @param {string} language - Language to use for new wallet
   */
  create_wallet(filename = 'monero_wallet', password = undefined, language = 'English') {
    let params = {
      filename: filename,
      password: password,
      language: language
    };

    return this._run('create_wallet', params);
  }
  
  /**
   * Open a wallet
   *
   * @function open_wallet
   * @param {string} filename - Filename to use for new wallet
   * @param {string} password - Password to use for new wallet
   */
  open_wallet(filename = 'monero_wallet', password = undefined) {
    let params = {
      filename: filename,
      password: password
    };

    return this._run('open_wallet', params);
  }
  
  /**
   * Check if wallet is multisig
   *
   * @function is_multisig
   *
   * @returns {object} - Example: (non-multisignature wallet) {
   *   multisig: ,
   *   ready: ,
   *   threshold: 0,
   *   total: 0
   * } // TODO multisig wallet example
   */
  is_multisig() {
    return this._run('is_multisig');
  }
  
  /**
   * Get information needed to create a multisignature wallet.  Run on an unused wallet
   *
   * @function prepare_multisig
   *
   * @returns {object} - Example: {
   *   multisig_info: "MultisigV1WBnkPKszceUBriuPZ6zoDsU6RYJuzQTiwUqE5gYSAD1yGTz85vqZGetawVvioaZB5cL86kYkVJmKbXvNrvEz7o5kibr7tHtenngGUSK4FgKbKhKSZxVXRYjMRKEdkcbwFBaSbsBZxJFFVYwLUrtGccSihta3F4GJfYzbPMveCFyT53oK"
   * }
   */
  prepare_multisig() {
    return this._run('prepare_multisig');
  }
  
  /**
   * Make a multisig account
   *
   * @function make_multisig
   * @param {number} threshold - Threshold required to spend from multisig
   * @param {array} multisig_info - Array of multisignature information strings (from eg. prepare_multisig) 
   * @param {string} password - Passphrase to apply to multisig address
   *
   * @returns {object} - Example: {
   *   address: '9xXa4CtQsHqaTBoAvZLgZAXjKkzQnXR5tTVtp6P6NwAj2hokhkDd8NmSyLZN95wXqGcpo2wS92KeRBxDQaikNzPJ9nujoUB',
   *   multisig_info: ''
   * }
   */
  make_multisig(threshold, multisig_info, password = undefined) {
    let params = {
      threshold: threshold,
      multisig_info: multisig_info,
      password: password
    };

    return this._run('make_multisig', params);
  }
  
  /**
   * Export multisignature information
   *
   * @function export_multisig_info
   *
   * @returns {object} - Example: {
   *   // TODO example
   * }
   */
  export_multisig_info() {
    return this._run('export_multisig_info');
  }
  
  /**
   * Import mutlisignature information
   *
   * @function import_multisig_info
   * @param {string} info - Multisig info (from eg. prepare_multisig)
   *
   * @returns   Example: {
   *   // TODO example
   * }
   */
  import_multisig_info(info) {
    let params = { info: info };
    return this._run('import_multisig_info', params);
  }
  
  /**
   * Finalize a multisignature wallet
   *
   * @function finalize_multisig
   * @param {array} multisig_info - Array of multisignature info strings (from eg. prepare_multisig)
   * @param {string} password - Passphrase to apply to multisig address
   *
   * @returns   Example: {
   *   address: '9v8xvJkkj9ZWLykFxh3X3v6w3nEgSVoHyXaWnd5zwz4h2jtUDk3enseWjq4BJNa8eBBqBVLwxj5KhfGhsMS8oDDHNbAULfc'
   * }
   */
  finalize_multisig(multisig_info, password = undefined) {
    let params = {
      multisig_info: multisig_info,
      password: password
    };

    return this._run('finalize_multisig', params);
  }
  
  /**
   * Sign a multisignature transaction
   *
   * @function sign_multisig
   * @param {string} tx_data_hex - Transaction as hex blob
   *
   * @returns {object} - Example: {
   *   // TODO example
   * }
   */
  sign_multisig(tx_data_hex) {
    let params = { tx_data_hex: tx_data_hex };
    return this._run('sign_multisig', params);
  }
  
  /**
   * Submit (relay) a multisignature transaction
   *
   * @function 
   * @param {string} tx_data_hex - Transaction as hex blob
   *
   * @returns   Example: {
   *   // TODO example
   * }
   */
  submit_multisig(tx_data_hex) {
    let params = { tx_data_hex: tx_data_hex };
    return this._run('submit_multisig', params);
  }
}

module.exports = walletRPC;
