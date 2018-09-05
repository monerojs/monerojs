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
   * @param {number} account_index - Index of account to look up             (default: 0)
   * @param (array} address_indices - Array of subaddress indices to look up (optional)
   *
   * @returns {object} - Example: {
   *   balance: 140000000000,
   *   unlocked_balance: 50000000000
   * }
   */
  get_balance(account_index = 0, address_indices = undefined) {
    let params = {
      account_index: account_index,
      address_indices: address_indices
    };

    return this._run('get_balance');
  }
  
  /**
   * Alias of get_balance
   *
   * @function getbalance
   *
   * @returns {object}
   */
  getbalance(account_index = 0, address_indices = undefined) {
    let params = {
      account_index: account_index,
      address_indices: address_indices
    };

    return this._run('getbalance', params);
  }
  
  /**
   * Look up wallet address(es)
   *
   * @function get_address
   * @param {number} account_index - Index of account to look up    (optional)
   * @param (number} address_index - Index of subaddress to look up (optional)
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
  get_address(account_index = undefined, address_index = undefined) {
    let params = {
      account_index: account_index,
      address_index: address_index
    };

    return this._run('get_address', params);
  }

  /** 
   * Alias of get_address
   *
   * @function getaddress
   * @param {number} account_index - Index of account to look up    (optional)
   * @param {number} address_index - Index of subaddress to look up (optional)
   *
   * @returns {object}
   */
  getaddress(account_index = undefined, address_index = undefined) {
    let params = {
      account_index: account_index,
      address_index: address_index
    };

    return this._run('getaddress', params);
  }
  
  /**
   * Create a new subaddress
   *
   * @function create_address
   * @param {number} account_index - The index of the account in which to create new subaddress (default: 0)
   * @param {string} label - Label to apply to new address                                      (optional)
   *
   * @returns {object} - Example: {
   *   address: "Bh3ttLbjGFnVGCeGJF1HgVh4DfCaBNpDt7PQAgsC2GFug7WKskgfbTmB6e7UupyiijiHDQPmDC7wSCo9eLoGgbAFJQaAaDS"
   *   address_index: 1
   * }
   */
  create_address(account_index = 0, label = undefined) {
    return new Promise((resolve, reject) => {
      let params = {
        account_index: account_index,
        label: label
      };

      this._run('create_address', params)
      .then(result => {
        this.store() // Save wallet state after subaddress creation
        .then(() => {
          resolve(result);
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
   * Label an address
   *
   * @function label_address
   * @param {object} index - major (account) and minor (subaddress) indices to label
   * @param {string} label - Label to apply
   *
   * Example index parameter: index: {major: 0, minor: 5}
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
   * @param {string} tag - Tag of account(s) to look up
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
  get_accounts(tag = undefined) {
    let params = { tag: tag };
    return this._run('get_accounts', params);
  }
  
  /**
   * Create a new account
   *
   * @function create_account
   * @param {string} label - Account label
   */
  create_account(label = undefined) {
    return new Promise((resolve, reject) => {
      let params = { label: label };
      this._run('create_account', params)
      .then(result => {
        this.store() // Save wallet state after account creation
        .then(() => {
          resolve(result);
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
   * Label an account
   *
   * @function label_account
   * @param {number} account_index - Index of account to label
   * @param {string} label - Label to apply
   */
  label_account(account_index, label) {
    return new Promise((resolve, reject) => {
      let params = {
        account_index: account_index,
        label: label
      };
      
      this._run('label_account', params)
      .then(result => {
        this.store() // Save wallet state after account label
        .then(() => {
          resolve(result);
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
    return new Promise((resolve, reject) => {
      let params = {
        accounts: accounts,
        tag: tag
      };

      this._run('tag_accounts', params)
      .then(result => {
        this.store() // Save wallet state after account tagginng
        .then(() => {
          resolve(result);
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
   * Untag accounts
   *
   * @function untag_accounts
   * @param {array} account - Account indices to untag
   */
  untag_accounts(accounts) {
    return new Promise((resolve, reject) => {
      let params = { accounts: accounts };
      this._run('untag_accounts', params)
      .then(result => {
        this.store() // Save wallet state after untagging accounts
        .then(() => {
          resolve(result);
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
    return new Promise((resolve, reject) => {
      let params = {
        tag: tag,
        description: description
      };

      this._run('set_account_tag_description', params)
      .then(result => {
        this.store() // Save wallet state after untagging accounts
        .then(() => {
          resolve(result);
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
   * @param {string} payment_id - Payment ID                                                                    (optional)
   * @param {boolean} get_tx_key - Return transaction key after generation                                      (optional)
   * @param {number} mixin - Mixin amount (ringize - 1)                                                         (optional)
   * @param {number} account_index - Account from which to send                                                 (optional)
   * @param {string} subaddr_indices - Comma-separeted list of subaddress indices to spend from                 (optional)
   * @param {number} priority - Transaction priority. 0-3 for: default, unimportant, normal, elevated, priority (optional)
   * @param {number} unlock_time - UNIX time or block height to unlock output                                   (optional)
   * @param {boolean} do_not_relay - Do not relay transaction                                                   (optional)
   * @param {boolean} get_tx_hex - Return transaction as hex after generation                                   (optional)
   * @param {boolean} new_algorithm - Use the new transaction construction algorithm                            (optional)
   * @param {boolean} get_tx_metadata - Return transaction metadata needed to relay later                       (optional)
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
    return new Promise((resolve, reject) => {
      let params = {};
      let destinations = [];

      if (typeof amount == 'object') { // Parameters passed in as object/dictionary
        params = amount;

        if ('destinations' in params) {
          destinations = params['destinations'];

          if (!(destinations.constructor === Array)) {
            throw new Error('Error: destinations must be an array');
          }

          for (let i = 0; i < destinations.length; i++) {
            if ('amount' in destinations[destination]) {
              destinations[i]['amount'] = toAtomicUnits(destinations[i]['amount']);
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
          let new_amount = toAtomicUnits(amount);

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
        let new_amount = toAtomicUnits(amount);

        destinations = [{ amount: new_amount, address: address }];
      }

      params = {
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

      this._run('transfer', params)
      .then(result => {
        this.store() // Save wallet state after transfer
        .then(() => {
          resolve(result);
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
   * Same as transfer, but uses multiple transactions if necessary
   *
   * @function transfer_split
   * @param {string} amount - Amount to send
   * @param {string} address - Address to send to
   * @param {string} payment_id - Payment ID                                                                    (optional)
   * @param {boolean} get_tx_keys - Return transaction keys after generation                                    (optional)
   * @param {number} mixin - Mixin amount (ringize - 1)                                                         (optional)
   * @param {number} account_index - Account from which to send                                                 (optional)
   * @param {string} subaddr_indices - Comma-separeted list of subaddress indices to from which to spend        (optional)
   * @param {number} priority - Transaction priority. 0-3 for: default, unimportant, normal, elevated, priority (optional)
   * @param {number} unlock_time - UNIX time or block height to unlock output                                   (optional)
   * @param {boolean} do_not_relay - Do not relay transaction                                                   (optional)
   * @param {boolean} get_tx_hex - Return transaction as hex after generation                                   (optional)
   * @param {boolean} new_algorithm - Use the new transaction construction algorithm                            (optional)
   * @param {boolean} get_tx_metadata - Return transaction metadata needed to relay later                       (optional)
   * 
   *   OR
   * 
   * @param {object} params - Array containing any of the options listed above, where only amount and address or a destionations array are required
   *
   * @returns {object}
   */
  transfer_split(amount, address = undefined, payment_id = undefined, get_tx_keys = false, mixin = 6, account_index = 0, subaddr_indices = undefined, priority = 2, unlock_time = undefined, do_not_relay = false, get_tx_hex = false, new_algorithm = false, get_tx_metadata = false) {
    return new Promise((resolve, reject) => {
      let params = {};
      let destinations = [];

      if (typeof amount == 'object') { // Parameters passed in as object/dictionary
        params = amount;

        if ('destinations' in params) {
          destinations = params['destinations'];

          if (!(destinations.constructor === Array)) {
            throw new Error('Error: destinations must be an array');
          }

          for (let i = 0; i < destinations.length; i++) {
            if ('amount' in destinations[destination]) {
              destinations[i]['amount'] = toAtomicUnits(destinations[i]['amount']);
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
          let new_amount = toAtomicUnits(amount);

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
        let new_amount = toAtomicUnits(amount);

        destinations = [{ amount: new_amount, address: address }];
      }

      params = {
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

      this._run('transfer_split', params)
      .then(result => {
        this.store() // Save wallet state after transfer
        .then(() => {
          resolve(result);
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
   * @param {string} subaddr_indices - Comma-seperated list of subaddress indices to sweep                      (optional)
   * @param {number} account_index - Account index to sweep                                                     (optional)
   * @param {string} payment_id - Payment ID                                                                    (optional)
   * @param {boolean} get_tx_keys - Return transaction keys after generation                                    (optional)
   * @param {number} mixin - Mixin amount (ringsize - 1)                                                        (optional)
   * @param {number} priority - Transaction priority. 0-3 for: default, unimportant, normal, elevated, priority (optional)
   * @param {number} below_amount - Only send outputs below this amount                                         (optional)
   * @param {number} unlock_time - UNIX time or block height to unlock output                                   (optional)
   * @param {boolean} do_not_relay - Do not relay transaction                                                   (optional)
   * @param {boolean} get_tx_hex - Return transaction as hex after generation                                   (optional)
   * @param {boolean} get_tx_metadata - Return transaction metadata needed to relay later                       (optional)
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
    return new Promise((resolve, reject) => {
      let params = {};
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
          new_below_amount = toAtomicUnits(below_amount);
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
        new_below_amount = toAtomicUnits(below_amount);
      }

      params = {
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
      
      this._run('sweep_all', params)
      .then(result => {
        this.store() // Save wallet state after transfer
        .then(() => {
          resolve(result);
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
   * Sweep a single key image to an address
   * 
   * @function sweep_single
   * @param {string} key_image - Key image to sweep
   * @param {string} address - Address to send to
   * @param {string} payment_id - Payment ID                                                                    (optional)
   * @param {boolean} get_tx_keys - Return transaction keys after generation                                    (optional)
   * @param {number} mixin - Mixin amount (ringsize - 1)                                                        (optional)
   * @param {number} priority - Transaction priority. 0-3 for: default, unimportant, normal, elevated, priority (optional)
   * @param {number} unlock_time - UNIX time or block height to unlock output                                   (optional)
   * @param {boolean} do_not_relay - Do not relay transaction                                                   (optional)
   * @param {boolean} get_tx_hex - Return transaction as hex after generation                                   (optional)
   * @param {boolean} get_tx_metadata - Return transaction metadata needed to relay later                       (optional)
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
  sweep_single(key_image, address, payment_id = undefined, get_tx_keys = false, mixin = 6, priority = 2, unlock_time = undefined, do_not_relay = false, get_tx_hex = false, get_tx_metadata = false) {
    return new Promise((resolve, reject) => {
      let params = {};

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
        if ('priority' in params) {
          priority = params['priority'];
        }
        if ('unlock_time' in params) {
          unlock_time = params['unlock_time'];
        }
        if ('unlock_time' in params) {
          unlock_time = params['unlock_time'];
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
      }

      params = {
        address: address,
        mixin: mixin,
        get_tx_key: true,
        payment_id: payment_id,
        get_tx_keys: get_tx_keys,
        priority: priority,
        unlock_time: unlock_time,
        do_not_relay: do_not_relay,
        get_tx_hex: get_tx_hex,
        get_tx_metadata: get_tx_metadata
      };
      
      this._run('sweep_single', params)
      .then(result => {
        this.store() // Save wallet state after transfer
        .then(() => {
          resolve(result);
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
    return new Promise((resolve, reject) => {
      let params = { hex: hex };
      this._run('relay_tx', params)
      .then(result => {
        this.store() // Save wallet state after transaction relay
        .then(() => {
          resolve(result);
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
   * @param {string} min_block_height - Height to begin search   (default: 0)
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
  get_bulk_payments(payment_ids, min_block_height = 0) {
    let params = {
      payment_id: payment_ids,
      min_block_height: min_block_height
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
   * @param {boolean} verbose - Return key image if true                                                                                                 (optional)
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
  incoming_transfers(type = 'all', account_index = 0, subaddr_indices = undefined, verbose = false) {
    let params = {
      transfer_type: type,
      account_index: account_index,
      subaddr_indices: subaddr_indices,
      verbose: verbose
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
   * @param {string} standard_address - Destination public address
   * @param {string} payment_id - Payment ID to use when generating an integrated address (optional)
   *
   * @returns {object} - Example: {
   *   integrated_address: "4BpEv3WrufwXoyJAeEoBaNW56ScQaLXyyQWgxeRL9KgAUhVzkvfiELZV7fCPBuuB2CGuJiWFQjhnhhwiH1FsHYGQQ8H2RRJveAtUeiFs6J"
   * }
   */
  make_integrated_address(standard_address, payment_id = undefined) {
    let params = {
      standard_address: standard_address,
      payment_id: payment_id
    };

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
    return new Promise((resolve, reject) => {
      let params = {
        txids: txids,
        notes: notes
      };

      this._run('set_tx_notes', params)
      .then(result => {
        this.store() // Save wallet state after setting transaction notes
        .then(() => {
          resolve(result);
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
    return new Promise((resolve, reject) => {
      let params = {
        key: key,
        value: value
      };

      this._run('set_attribute', params)
      .then(result => {
        this.store() // Save wallet state after setting transaction notes
        .then(() => {
          resolve(result);
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
   * @param {string} message - Message to include within signature (optional)
   *
   * @returns {object} - Example: {
   *   signature: "SpendProofV1RnP6ywcDQHuQTBzXEMiHKbe5ErzRAjpUB1h4RUMfGPNv4bbR6V7EFyiYkCrURwbbrYWWxa6Kb38ZWWYTQhr2Y1cRHVoDBkK9GzBbikj6c8GWyKbu3RKi9hoYp2fA9zze7UEdeNrYrJ3tkoE6mkR3Lk5HP6X2ixnjhUTG65EzJgfCS4qZ85oGkd17UWgQo6fKRC2GRgisER8HiNwsqZdUTM313RmdUX7AYaTUNyhdhTinVLuaEw83L6hNHANb3aQds5CwdKCUQu4pkt5zn9K66z16QGDAXqL6ttHK6K9TmDHF17SGNQVPHzffENLGUf7MXqS3Pb6eijeYirFDxmisZc1n2mh6d5EW8ugyHGfNvbLEd2vjVPDk8zZYYr7NyJ8JjaHhDmDWeLYy27afXC5HyWgJH5nDyCBptoCxxDnyRuAnNddBnLsZZES399zJBYHkGb197ZJm85TV8SRC6cuYB4MdphsFdvSzygnjFtbAcZWHy62Py3QCTVhrwdUomAkeNByM8Ygc1cg245Se1V2XjaUyXuAFjj8nmDNoZG7VDxaD2GT9dXDaPd5dimCpbeDJEVoJXkeEFsZF85WwNcd67D4s5dWySFyS8RbsEnNA5UmoF3wUstZ2TtsUhiaeXmPwjNvnyLif3ASBmFTDDu2ZEsShLdddiydJcsYFJUrN8L37dyxENJN41RnmEf1FaszBHYW1HW13bUfiSrQ9sLLtqcawHAbZWnq4ZQLkCuomHaXTRNfg63hWzMjdNrQ2wrETxyXEwSRaodLmSVBn5wTFVzJe5LfSFHMx1FY1xf8kgXVGafGcijY2hg1yw8ru9wvyba9kdr16Lxfip5RJGFkiBDANqZCBkgYcKUcTaRc1aSwHEJ5m8umpFwEY2JtakvNMnShjURRA3yr7GDHKkCRTSzguYEgiFXdEiq55d6BXDfMaKNTNZzTdJXYZ9A2j6G9gRXksYKAVSDgfWVpM5FaZNRANvaJRguQyqWRRZ1gQdHgN4DqmQ589GPmStrdfoGEhk1LnfDZVwkhvDoYfiLwk9Z2JvZ4ZF4TojUupFQyvsUb5VPz2KNSzFi5wYp1pqGHKv7psYCCodWdte1waaWgKxDken44AB4k6wg2V8y1vG7Nd4hrfkvV4Y6YBhn6i45jdiQddEo5Hj2866MWNsdpmbuith7gmTmfat77Dh68GrRukSWKetPBLw7Soh2PygGU5zWEtgaX5g79FdGZg"
   * }
   */
  get_spend_proof(txid, message = undefined) {
    let params = {
      txid: txid,
      message: message
    };

    return this._run('get_spend_proof', params);
  }
  
  /**
   * Verify spend proof
   *
   * @function check_spend_proof
   * @param {string} txid - Transaction ID
   * @param {string} signature - Spend proof to verify
   * @param {string} message - Message that was included within signature (optional)
   *
   * @returns {object} - Example: {
   *   good: 1
   * }
   */
  check_spend_proof(txid, signature, message = undefined) {
    let params = {
      txid: txid,
      signature: signature,
      message: message
    };

    return this._run('check_spend_proof', params);
  }
  
  /**
   * Get proof of reserves
   *
   * @function get_reserve_proof
   * @param {boolean} all - If set to true, proves all wallet reserves
   * @param {number} account_index - Account index of which to prove reserves (ignored if all parameter set to true)
   * @param {number} amount - Amount of reserves to prove                     (ignored if all parameter set to true)
   * @param {string} message - Message to include in reserve proof signature  (optional)
   *
   * @returns   Example: {
   *   signature: "ReserveProofV11BZ23sBt9sZJeGccf84mzyAmNCP3KzYbE111111111111AjsVgKzau88VxXVGACbYgPVrDGC84vBU61Gmm2eiYxdZULAE4yzBxT1D9epWgCT7qiHFvFMbdChf3CpR2YsZj8CEhp8qDbitsfdy7iBdK6d5pPUiMEwCNsCGDp8AiAc6sLRiuTsLEJcfPYEKe"
   * }
   */
  get_reserve_proof(all = true, account_index = 0, amount = 0, message = undefined) {
    let params = {
      all: true,
      account_index: account_index,
      amount: amount,
      message: message
    };

    return this._run('get_reserve_proof', params);
  }
  
  /**
   * Verify a reserve proof
   *
   * @function check_reserve_proof
   * @param {string} address - Wallet address
   * @param {string} signature - Reserve proof
   * @param {string} message - Message that was included
   *
   * @returns {object} - Example: {
   *   good: 1,
   *   spent: 0,
   *   total: 0
   * }
   */
  check_reserve_proof(address, signature, message = undefined) {
    let params = {
      address: address,
      signature: signature,
      message: message
    };

    return this._run('check_reserve_proof', params);
  }
  
  /**
   * Look up transfers
   *
   * @function get_transfers
   * @param {array} input_types - Array of transfer type strings; possible values include 'all', 'in', 'out', 'pending', 'failed', and 'pool' (optional)
   * @param {number} account_index - Index of account to look up                                                                             (optional)
   * @param {string} subaddr_indices - Comma-seperated list of subaddress indices to look up                                                 (optional)
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
    let params = {};

    if (typeof input_types == 'string') { // If user is using old method
      params[input_type] = account_index; // params[input_type] = input_value;
    } else if (typeof input_types == 'object' && input_types.constructor !== Array) { // Parameters passed in as object/dictionary
      params = input_types;

      if ('input_types' in params) {
        input_types = params['input_types'];
        // TODO make sure that input_types is an array
      }
      if ('account_index' in params) {
        account_index = params['account_index'];
        params['account_index'] = account_index;
      }
      if ('subaddr_indices' in params) {
        subaddr_indices = params['subaddr_indices'];
        params['subaddr_indices'] = subaddr_indices;
      }
      if ('min_height' in params) {
        min_height = params['min_height'];
        params['min_height'] = min_height;
      }
      if ('max_height' in params) {
        max_height = params['max_height'];
        params['max_height'] = max_height;
      }
    }
      
    if (input_types.indexOf('all') !== -1) {
      input_types = ['in', 'out', 'pending', 'failed', 'pool'];
    }
    for (let i = 0; i < input_types.length; i++) {
      params[input_types[i]] = true;
    }

    if ((min_height || max_height) && max_height != 4206931337) {
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
  get_transfer_by_txid(txid, account_index = undefined) {
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
    let params = { data: data };
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
   * @returns {boolean} good - Verification status
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
   *   signed_key_images: [
   *     {
   *       key_image: 'cd35239b72a35e26a57ed17400c0b66944a55de9d5bda0f21190fed17f8ea876',
   *       signature: 'c9d736869355da2538ab4af188279f84138c958edbae3c5caf388a63cd8e780b8c5a1aed850bd79657df659422c463608ea4e0c730ba9b662c906ae933816d00'
   *     },
   *     {
   *       key_image: '65158a8ee5a3b32009b85a307d85b375175870e560e08de313531c7dbbe6fc19',
   *       signature: 'c96e40d09dfc45cfc5ed0b76bfd7ca793469588bb0cf2b4d7b45ef23d40fd4036057b397828062e31700dc0c2da364f50cd142295a8405b9fe97418b4b745d0c'
   *     }...
   *   ]
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
   * @returns {object} - Example: {
   *   height: 76428,
   *   spent: 62708953408711,
   *   unspent: 0
   * }
   *
   * Example signed_key_images array: signed_key_images: [{key_image: '65158a8ee5a3b32009b85a307d85b375175870e560e08de313531c7dbbe6fc19', signature: 'c96e40d09dfc45cfc5ed0b76bfd7ca793469588bb0cf2b4d7b45ef23d40fd4036057b397828062e31700dc0c2da364f50cd142295a8405b9fe97418b4b745d0c'}]
   */
  import_key_images(signed_key_images) {
    return new Promise((resolve, reject) => {
      let params = { signed_key_images: signed_key_images };
      this._run('import_key_images', params)
      .then(result => {
        this.store() // Save wallet state after importing key images
        .then(() => {
          resolve(result);
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
   * Create a payment URI using the official URI spec
   *
   * @function make_uri
   * @param {string} address - Recipient address
   * @param {string} amount - Amount to request           (optional)
   * @param {string} payment_id - Payment ID              (optional)
   * @param {string} recipient_name - Name of recipient   (optional)
   * @param {string} tx_description - Payment description (optional)

   * @returns {object} - Example: {
   *   // TODO example
   * }
   */
  make_uri(address, amount = undefined, payment_id = undefined, recipient_name = undefined, tx_description = undefined) {
    // Convert from moneroj to tacoshi (piconero)
    let new_amount = toAtomicUnits(amount);
       
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
   * entries: [
   *   {
   *     address: '77Vx9cs1VPicFndSVgYUvTdLCJEZw9h81hXLMYsjBCXSJfUehLa9TDW3Ffh45SQa7xb6dUs18mpNxfUhQGqfwXPSMrvKhVp',
   *     description: 'Second account',
   *     index: 0,
   *     payment_id: '0000000000000000000000000000000000000000000000000000000000000000'
   *   },
   *   ...]
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
   * @param {string} description - Description of address                        (optional)
   *
   * @returns {number} - Index of address in address book, Example:  {
   *   index: 1
   * }
   */
  add_address_book(address, payment_id = undefined, description = undefined) {
    return new Promise((resolve, reject) => {
      let params = {
        address: address,
        payment_id: payment_id,
        description: description
      };

      this._run('add_address_book', params)
      .then(result => {
        this.store() // Save wallet state after adding entry to address book
        .then(() => {
          resolve(result);
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
   * Delete an entry from the address book
   *
   * @function delete_address_book
   * @param {array} index - Index of the address book entry to remove
   */
  delete_address_book(index) {
    return new Promise((resolve, reject) => {
      let params = { index: index };
      return this._run('delete_address_book', params)
      .then(result => {
        this.store() // Save wallet state after deleting address book entry
        .then(() => {
          resolve(result);
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
   * Rescan the blockchain for spent outputs
   * 
   * @function rescan_spent
   */
  rescan_spent() {
    return new Promise((resolve, reject) => {
      this._run('rescan_spent')
      .then(result => {
        this.store() // Save wallet state after rescanning blockchain
        .then(() => {
          resolve(result);
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
   *
   * @returns {object} - Example: (multisignature wallet) {
   *   languages: ['Deutsch', 'English', 'Español', 'Français', 'Italiano', 'Nederlands', 'Português', 'русский язык', '日本語', '简体中文 (中国)', 'Esperanto', 'Lojban']
   * }
   */
  get_languages() {
    return this._run('get_languages');
  }
  
  /**
   * Create a new wallet
   *
   * @function create_wallet
   * @param {string} filename - Filename to use for new wallet
   * @param {string} password - Password to use for new wallet (optional)
   * @param {string} language - Language to use for new wallet (default: 'English')
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
   *   multisig: false,
   *   ready: false,
   *   threshold: 0,
   *   total: 0
   * }
   *
   * @returns {object} - Example: (multisignature wallet) {
   *   multisig: true,
   *   ready: true,
   *   threshold: 2,
   *   total: 2
   * }
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
   *   multisig_info: 'MultisigV1WBnkPKszceUBriuPZ6zoDsU6RYJuzQTiwUqE5gYSAD1yGTz85vqZGetawVvioaZB5cL86kYkVJmKbXvNrvEz7o5kibr7tHtenngGUSK4FgKbKhKSZxVXRYjMRKEdkcbwFBaSbsBZxJFFVYwLUrtGccSihta3F4GJfYzbPMveCFyT53oK'
   * }
   */
  prepare_multisig() {
    return this._run('prepare_multisig');
  }
  
  /**
   * Make a multisignature wallet
   *
   * @function make_multisig
   * @param {number} threshold - Threshold required to spend from multisig
   * @param {array} multisig_info - Array of multisignature information strings (from eg. prepare_multisig) 
   * @param {string} password - Passphrase to apply to multisig address (default: '')
   *
   * @returns {object} - Example: {
   *   address: '9xXa4CtQsHqaTBoAvZLgZAXjKkzQnXR5tTVtp6P6NwAj2hokhkDd8NmSyLZN95wXqGcpo2wS92KeRBxDQaikNzPJ9nujoUB',
   *   multisig_info: ''
   * }
   */
  make_multisig(threshold, multisig_info, password = '') {
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
   *   info: '4d6f6e65726f206d756c7469736967206578706f72740195e87644092e02e3a061493c0bcf1a698fc3a7b4162720e18ba29fbdc6bacbe71dbf0a7d0496d631d0db6a029cd0dedaa80006a648cfdad0254d3fc373ae0afd41d510f026345e8b8ca7b7464e982dc6110ea57818f69904389ad943fe512f285e80847a1db49194f7cf489216c29e20b69e4c54ea7a4d08298f8805e8c260cbd5198ff8882017da9aacc626d9cf056133afa0c7c12183bc46dc4746d55f17149f8e52bf5d75db84f72d5753211a5d0bdf461eb1e72f278ea327358463bcbdae476cf97a7a9611fbfa16e5da165573558f9f720dcca2296709c23a423c04f302ff178f6e1c3f4b504208f0b19913aadcafbb4fe91381b416a68afb9db31a8f665fa43cbc517dba0c67e38d2aa313ee1e8c1d96a6cd3ea0691e22cc7d06e6816c1c41b910b5c879ed92f61e3935c3f62b40ec650aea27aa082718a29ce1790749c772d732c04b011e3942abf5c8e720339858656eee3fbfac61b22d98d496a368e283a79c372a0fdf6025b3d5144dfa327b290f83d33880c3551590766fa905836498e9bf85088dbeb430fa5be8cab94f4cd1f38c6a882ddb156d6256430370174e692956f1b82f195673348ba325d6c145f76f27df3b1c0d493941d6405b557c4c9716ae067d7a3d46612149e213a0efce751b18acf9736d814295724cf0d0b092a62f60a40c712f6fbaf688c59d0eef3f851678be23ede8b47ff9546371fd75df94fe1272ff2bc1b96afe8b278647d7d2535e1c5bc12fffc2dc72ee4c2698611b40d490bae4fad49da9dbbdfa4c4b6db879f2df55ed943c8718f8010b2f2cabf2152aaaaef7578003677c16f5566dac67e5a4c48014bd9a5e6500b7f78978f6d1bc7a334c203162ea98ab37691b144bdc7c74c6e367b07653735844cb5c186a7584f439663bc5237d843c88836424f1ddd7aef20da33c223f9d16b0fd1216695e206c461b4a46a54c4c050bbc8acef204699d28b61d1cac8a8249f091ff1025a844280df0572ed6dcd7986a1d37e08a4b0a7957cb39db0c766d586e6a39dd5dc9c38bf9e2c274773c446ac20aa0e2f6ec7c33017855b2a21edd2cf141c93b1a90a8bdefe3801a66629cf81d760289652859b0990433bdb445003e53c5d6525bf5ab442e96d1af74fe8d4f8c141bc4fb35de23f8709b443fc7a7bc16cc228ec29f461d06c3f130cb9f365847015365a61f4531e1ff410375320873f257936987ca7f1a83757903113faa556a032c449017931d2f285fdea5cc63d52a0c7ef51d1dcf71778a37a815a24be2659204353736247ceb12f632ba17bb476706'
   * }
   */
  export_multisig_info() {
    return new Promise((resolve, reject) => {
      this._run('export_multisig_info')
      .then(result => {
        this.store() // Save wallet state after multisig info export
        .then(() => {
          resolve(result);
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
   * Import mutlisignature information
   *
   * @function import_multisig_info
   * @param {array} info - Array of multisig info strings (from eg. prepare_multisig)
   *
   * @returns   Example: {
   *   n_outputs: 5
   * }
   */
  import_multisig_info(info) {
    return new Promise((resolve, reject) => {
      let params = { info: info };
      this._run('import_multisig_info', params)
      .then(rseult => {
        this.store() // Save wallet state after multisig info import
        .then(() => {
          resolve(result);
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
   * Finalize a multisignature wallet
   *
   * @function finalize_multisig
   * @param {array} multisig_info - Array of multisignature info strings (from eg. prepare_multisig)
   * @param {string} password - Passphrase to apply to multisig address (default: '')
   *
   * @returns   Example: {
   *   address: '9v8xvJkkj9ZWLykFxh3X3v6w3nEgSVoHyXaWnd5zwz4h2jtUDk3enseWjq4BJNa8eBBqBVLwxj5KhfGhsMS8oDDHNbAULfc'
   * }
   */
  finalize_multisig(multisig_info, password = '') {
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
   *   tx_data_hex: '4d6f6e65726f206d756c746973696720756e7369676e6564207478207365740172b72a9e656292276d9be168184d408723aa777a6e79e97b09de6042c5d5b6e32ed9f7c463d3ca72a594f241109e0e88921f70c750b93b8bc5f7078c3f35e86fec73c56a347a9970b61e784ad9b48c88ee8ad8f33205a2b00e4aadd8b73686b5236ef94083b7d403686e6faa3869fae4e273ef78f1238cd382330cc40ac153494b7e11361d0bf22873d93a83f06f6ed76b43ab3d627617b9515d8071fe3dcde90c2c5db5b1271be6da1a7da6fc55f597462a39e0217651a2cfd6de0f00b785905d085a412ce0bcdc85563c55236cd73ba2900442db71f20ce3d1a3c6e34f242010596bce3a4431d44fd1247ae0e72eee3bb130b614d45dbe3d56e7ad5ae0fd0684ad85cba7404182b2b50b1088c0abfbd65db6ddcabc1793443a8ae90a276dba5d3d2c3c40d3f89d95f9aa0f3aa69b9c8d816667a6e4e174630a98d01d0d6d0c2d3a0ed4455d31b2561c688f7c47f92e979aef595e1a5e70c12b7d404261e9ce6989c48bb4bdcf3c2bddd506caf826796add840d7763452d0feec55dde9b15dae67bbcd276b0be3f2fe485ac1deef996eb7815f5fad13f9ebde6934337b63a430a2ce2be22c5bb82b1d6af793b9d7b666352b30007a0895f32444f81cbcbe3bb8898494b818f390e40654aed571cf6ebf77a4dc2ad5f184e1adf0038bb58114cf7ce7762387d4d26352251724d33159be3e71e795275605ccef9c99998a40272bbe13ee44838e38b027c5b79af6d3e2371a41a6d64b94920f658ef9a155d33d650c61cd7c50e879695c70874feda8e32c9b92c480bbd2edb52ac3c609876ff2076c328b64a4fd33fbbb2103112d113c0dd051bfd885788e8fe0e372709e70279870f3e2fac11e140f43b7822b67fc5dd9a820490e0ee9fd643f58e9c7e6a8fc36edd85076ae23a00ac10b1c2df689a02da93bcc5090d2d0375102c62d9cff833f43f41673228cc273e570846e62a8d8f8542dedd4d3800858d5ea7e486d1966a56f408d88275166ef1bd303fb1e38d064a06e4666b7a6f8600f0fa95e9ca2af77165a93319db08914197ca56e1abaf16329c98601547ecb70ea09c79cbd25fd3a38bf35f1b530df6cea2b5336d973a8e274eef5b5ad5cf607bb092da4bc9cdd9f3257eeddbff61ce842dba0a13a78edb37bd7039fcc3bdc7f4c9f8b9ba92310c61baa715069cf1134de57da338728c808701eb248e9a12a6b7c9a96450a88861fb34839817d71c64f9a548c4422153acb11de1b26fe338396484d7a2221498f9ba2ff338397af504d093a4437b86239220adce0fb6dc13d4c977291dfce09c1c76db39a446ee0deea190c6a86fb05e85397ffd33ed2c6dec6b703798ab7313e86e64077994abe79a5833b3df3c4ea0624797644e330799afaeea3f6e5ab550732480a8476fd1769e3ef63d49923c753fcd42a1cc9bec58cb40b23a39772b7a29920262716a55a79e3aff6064d0247bdbe2b4853b6c8c7aa0d7512e3e259ee20f3da98d02a763f57dcf62a72554ec7b6b1861c5350ceb8e52efb90fa62fff63988692ef128a6424b1f61f249dd9af96158184e2cfc15aefc74426b74ccf0b65b30cffa3cbe04a193027e36d179f78ca0f9a0bc8e47ba696d8b789d28a3aec01414eca568a640555c360eac116b599a1e5ca5f98e19ab95d422f0e98a731e379d7ec3f0902143a06af0526f2620f793ae6a0f28547dfdba43cd561ed9e8208fd37d624505d369b2146adfa0f0ee45572ac74ed44ed629cc264146358c5339f9ec4b68c54980bc0f6a404d74c0f129f2e48851545f60d911487fc132403c5ca4b7d8568cde1aa7afd2470b29915b216467b0fb6935768ca0e3c4cff09b7f304a68e82383c00aedac40d08d3836419072b6587004982838bd26bbb623a2d146540b278276261e2c840c51322dedc00609e5859f06b37ea1f18ba63bed5ec363e0a6c8baad70477eaf41a33d02b624f66d5cdfd5fce3a825ec5b0d5873f938abc1f846bf63250b1a00cc87a1850b71656f9595af0dcf4cc09370bcc4053c9c3d4bb65ca4246e4149872cece596ba45ef503d078bc0ee9b84e9c123aa229258e3f296a83c352aa27e7f0d1195faa35844b797f35fd198fd29f97c798de7ce5c5f08b0a9c0e86e1414590ac5bedf36ffb639c5c2e8b9ab7bf8be28b99fc452cf565f44a4690d35cc3de006beacf1f38757d9079dba4b1798ba72f6c75f979883303a90eada44523cbc37ab1a41d615d14602739432abfbb4febed164a79b0fac7492712198689981c88a63a3be90c99b15a80dcdcf798f06ca29926059f7b4cc99d586bb985b45a56180be145adee257715b1b5295421158df02c27c5369935e8eb04630fb8da098611d370c5755c63fc063eac3aff12ffe370e565e3300866f16a270fe0ef03ac6964347fdd89b17d670ad0e94af624a7adabc4ed4496f3fecc9f87a550593286d3409a9dea0826260545c92fad18a198e004e110b69147c6cd86c6a9d57a3b194854c69c1d65768529d0c3242840a3b85a7d0853dbc4df57dbd413e6b7f9345eb4b564126c5913826b25a72ac22a0032ed71ab4de36d3419098e227cdf7e237e876513bfd78fa3063cd04a2b24f65dc7910d5f41b9b8506d6c9a9b50883de1757ffa3de83db496b5e8a2d432ba90badf022ecae9fa4b1fb508ba9e05eb0ccacd1cb07f5c446509e2cf88a8875a261abbccd7ffae27a00946d35d7f0b07ad8bb5dcfe9d538945e445f3514f958160bf0134e581140096c9d8fda8880ec1e728d3f3b77941cfce00d9eda45be5f3d54fa317186596a14ce6bae15fa1039c18a12b80196f878ea39f35ee29da68299fd36e60e76f5f205ab00bdb4a325ea54841270cdd7a1557fc6e57e7209968fc939f612331b4d8427726e5599f0a510c98e6ccf59a871344486a1125892be78d24e6e168bf87e41db749da88d03f61c011807684e76f247a3a8f13f18d789ce7e43f0120019ba02c9e792d9fc62c4a086cb940cf806b25688c95aa31a07903f98e64bc92724dc946966504700ab2403be2fe0884693e871e73a8a81d351ff59bfc1a24c7e0ca3b855720483d5f25395a9d3796c48f6ecac57565c1bde4c797f142156950af4e4689e2b35526c1f32bce736820c2041e4374258535a58b511bbf30f0abf59d5b2cfea81760812a1252c86a487bc38c8470d0d2d64defa2b5d3d91a8825eb3dc6ad4c097b1476bf1d4ea337c19c4d20dbea5923417860673f446fb2fc5deefb27885141e50ffad6908595a267b283de1c6b7f5a6e34bbd6c1db0839252fd6ddddd2843ef79d3f8aff31f04903da9f42ab535ca762a9b5d1cf9f229776ebe4f7309e5b460bae481a05f6aa22d6830cbe8b45cb20a9e333f5f74b3d692a9a0317663162a899ae2a2932489aba2769a3aa4e33325bb888317d070a4e22a4424d99ade7021796c8eccac74c4b3a87618aa2638b27b1540111e019e73de068a360ea87d8cc849986d97bb65e4e955e1bd9f5bfe7b2d226837cf023cce321798b0e077a1cda05ec4470ff9216927d8b18d5ecfa94c7867d937b64a72ad16c6fcdcbab480d88caf59ffe096bbad70648cfb4f69f82debf3513f23f93c66fe1f0af4c85110ce3207c6e4a80130237b61b0f04b810e20281b4daf3b73e7caaab91ee818242af21972584ad3b14b0d8a58e4db7ad1b5706cd57aa33d487fda2a6ff137172bb45255249fc9c905f41d76c6b25ece72237286c46f30fb8e3ee6a4affd734507aeeacd69579a3c9570ab2217dc3b1d755c3e660b213ff9c01858cb84413e5ceb80211dd839d162ee253e3b520e40eeaccbbb15d863ce4cfcfbc237c84263ad2dba33bad2b98389cfa81b427169c0599aaf4c124b5051c8761b7e6ff7aca61772e531c960415cb13fcb2aa26753deafebaa9244ba74fa15cc7ac273b3bff78c5d01eed1124d01c27dd46e96255c2d316e99aab21a5a922b44e6ddf69289984ee27db53a6e541d89a5cfe24a32661a3acc37733d940d65221ddaf6b28a7e43b21f874f37758bfad3310608c9cb57aa786697155f49f5077dc99419cf17d84d5122c1fea13d38c994cf5fdaddcccf53243ebd8dda1580f2e7fd964fad9bcb7839a3a71e034332dd76eca6ffea9a1cb36bb81af0751a796bdb314df18688d3a7dab0265edb3827984f343988ff39aca8afba79e668d7561d731e208552c635b21107c0a658215eefe7990bb3eef886e5798e3a91f8815f776ab95217ea8054113ce62b562e6ddb4be790204bf65a6462a0c2be425f89ce0c969860a26109733935e2779ba04402c15d1ea3a55be8afec6d08fce8803f952b5cb328445eaf79eefe96be181ec9cc1dbe35c9913beeb55760438c8d2bcb929015d2b7083278516fa2b3b9929eb35972b31bdabccbe5a8338a31f7e25649ae7a7d93b42fc7fe7a5036bdd4279d10559920d6c81054f80d5c274533a3ec2ec54eb755802493cf2cbb5fc447d573c9aaa6cb49a538c2076238405d80791702426adae80fe56f148cb899d248348c215002fcd949fb2dcc22d795ec0e99b176291d21bdcd99e1ddff793f77a97dd9da3b3cf62f71bd13ab975b0877fd50546220b6529e63e06b5d88df1f61656bb8c957982503ee694878eec1fcc0e0340c1ce6fea292ad0a6f3157e2c2824e2813626e8e2d0c365306b6f5b0ee1c09d1261007e23f992af180d06f18671d70eda83c7c415068b250c6f367ed97ba26876dc489c1f71f5fc57c110351f5d0baeea06fd333d087cfcd8ac0b3a4dbb8a587de6904031a1d27dbaf54d22e7a32e030e19ab5951c03807f52414d96356b453224eb7fdfd1691fdee57a32af0e1ea6251e82596d67bc70e98fd0b31c2cb8c087b3c437e748f341bb8c12d5ac75768d0692e54d2cef1f7300f9a7f29e3fe2cc1b38ee8b90a041636021c9c858c6ddde86c42d15627c68456414134dafb59e14ad77b139b8d108ef28c3b430b19632e803577cb518fca0e2287653a881c22df2eeea0d1a21da317f128f89fc3720e14cca1fc29cfcb7588d02d35819cc251b5ae6dea5f6e0e22fd89c526dd99049297b61e31ecd6276256a02c3024851ff44ab65df5be80567f3ea18815f787ec00e07dbc0f7b4b2b0648e3b33926dad347910107ea5ebf306b2983e60ee4bf62b8221790640d875bba0599e2895e4e398564816e1a4da469c2c94a41982ad89263ce9174a63e43e8ee99bfc2a9dd80874e5b04aeaead12e44f6746f1105ff6a9e0767af6ea241beee724ba3df63636381d9a3a8a4adb839b66207a2fb1fd9c7b745174144b2834f1ea20cb5b4ad7d6b3bd4ffc8324075a9b45bfba0cf5809082601a03c4ee5b1c5b08d25f1152d4cb9e9763764b6c5cc1b86cc3c0e3e0c519a8385c1e2b4c57117a7e35df89c124c5ed5a04f01dd573d876ec8dbe78ed4d6fa064d5457711c4d8fc7dafc8a917e2bf3ed60834e58d6fd4df3ad9c770b715ad50276051d643e6cf8cc891d878300c4ffb2b4f0700cdfc86b748381193a5561006b0e059222033c877c9df4f3fe5fc157821362b9c3d735745e196f5a51285e4f4841f3f8c69e8f7d618fa0adf4e21edc3863332a2d1fd37138929f9af0d50de126b89017e106bf3a1c992f1d1c8767afdb1759532dc8a4a16d70d387caa48e4d1785ca6f827415caf92f0816ff5286ed49002855ef35ec4a7a0ca6901dcd6cf51d0bb476912a265208a1dcf2afd1ca0a51598d041c929d28adead772c2a67cc5b52eac89b34d0f2b261d3745be9488c03106a4137510faa8ea48d4ef6b0ad9ad4a4885289ad59ed8de07b1d8736b76227ff77c71e3cf75218f5f91e30e6e303b551639a148222137d83c474dab045455e998a12ba6a900ee768b4b63ad4f0769278db6f93739713b5941e434b7fb76e148dd0eb21eac3d097cce8d70769cdc4ea78f59db78983621d3c6c58c4c819d681ee8c02d5d4abce042e373f52b9048f8a8c7e79ec8258b566c9a74dc07f457905feeeaf9544b49e7d7803df9bbf5d113aab7f78bd6211f52b3f6d68c2685c05ad95925247eeeeb0881220e1ae313fd5f75abd48b8145ed497621cc672cf3d6ebf9add1b26f5eed2c5e5885353876df4d0da0ab08777dd677bc1c54617983b2ab2bc90fcc4a5a6c065414f12da920d7d49fbce05beb3bf413c0aaba9fb501dbc90043119971ba596940ebd2d062f2c09c0f75420e23be673b4ce02bc0e2e5c03778890d5c77f9c50b6c3ff176aacbdcdbb2be1a7d6284881b3e9688cf9cb020cea5caae269560185d5734cfe0c2b1246cf39e34708b0272fb2fc2e17639c6abf496f3a0724cf5959df1791c96c10b6909f29082818417df662d154b3b59dcea6d96a2a01f29456d72fb62db2b644b803b923b8a70a18fd0daa4086c0db060b202d37539628bbf643fe1818babb98c1bee4b9cb4a6276de663058c0c513100159e986f1a94f033d70e82fdff8171a54574e9d9c7b896f3fcacd49a172a25f2b2f301279aa433058623ce1bf6d36487d1a7af7865f1c6443787e44c26caa92a883e122c2024a7b2e0eb042468300f78c250009435661742c4a5426173f005dc450fdf8795a8f02184ac6ed3d6e75cecad85d42534d8bd2800f6a231dac41a779e808f29069a47f736809022a93deeec04edf8e6a488a50578c265e9f9424e4e069de2dbf4304cbd8b15b3a7ccda3b1c7ac51392522a99f86fdddc6914f2cb74af89e1cbdc200bf519c2fac8438fd8e58499446c0c42ab6612abe5855ce5b22abcfdd5fcd6ac471b67ef3dc45a90c73c61e81d8638bca20815d8c064f7a3a1fba6980173e7279d722f42be6277c360faec3941926ad0070ef6920712c71293551059f1e01986728702fadda19b18e27b137111f52e50b94fe6de23d2b2948a15ca2921f414bc5bf6dc901c99689f44992c0a16d1e8294a6020e225565e86a1cf6c404038fd721e85ff3833277f8be270c9e916f383847006b73129e40ea22863ac545d7dcfe92b6c24416c6b64322f4b0d5b4a3e1e7ef581bf7fe40ea60b60982ec17819291b1c0cdf3ac44f78f25d6fb5f611f3ca10bafd928f07d13468063277a24c6e4e9608f89aacb119955071e08295b18551b2a8083272703fe1b5a955e728ed9208aa4f361988167c5b188bc3a6ad804a161e7238d812579ebde6220f50186df191a9e3d3966605d8d3edbf1a5597e543ba61c45829f8e0eadc14267ad5a1dfef5bc6fed83d1b6f0eaad3e7e9187eebef8c20f114d3d07e925601c8359b87732092adcfed8e47cac92dbb0942c71f463d7a98064446efd363d6fd22a5a79b696f3b66c18ecf01e6186df3e8bd5832410d764b65b12f860a0cb61bdc7bccd9fc9b4d55bde02bad0b501c6101a549981b27640f666c32bed22dc2e73980ad8563d004d2d2163094e7704d11b174f02a674d854322116a50758ad8eabfb011c147b125560bd4674cc66b247e5944d7aa05767a55ce2a6a04ffd822014239ccc558b2a6f7e3d51be3bf542b8988aec61317b0b35f752850d8b5ca3c94910937fba41139167a5177accfec40f92360d4a4e166c060e345e4afacfd9b448ccc7c6a0401cc4a76c6509f9b564b56d73408e75684b12bbc7ab844447d6eb623d1cabf340a701a398c22d0fdc5aaee7f10a5d4b859e076f0f80b764db7cb3e58f775211ddd165354bf3dc16a186c0fa5d784a902219063d7c0a958d59d38edaf4dbf9ca0ceaa9b19e83059b5ab36fcac542ec23ccfce7ae91a7c97c0053dc8a0ffada6bf64477e24a879d93e8b61dcbe474c5a2d7b963f7ecf8daff126981d39ab7647479f33b67a1df86de2338826bd831ed5ce792cc4e19dea00636b11dac3fb276de36d753ef17db526432e0b942f403356ebb18f7a72fddf3f75bfc0f66052a48f16b9571a0cbafe5f9445f3837b93866b814b5ceafc1cd87f6452565ee5e2e6dad9e863f17872d9d6df1410cb964757954a375f2aeff74f6fbeee642e478ec6718cd5ca9b9ab103d174773f285d2e9c7c6ed11313d075c0b912d134e25146c6fb3158052ce7d055cf9e743360ed7292b36e95637ec33460d86ed4480842aecbdf4e82f33d5b4ebebf01d7c1fe34e6dd238c0a014bc138d9dc13b3977dd118c0d33c76925b563de847e8176e67f62315cf72777c22da16367e9e756f84f51d17273762163ffc68b7cf79c51be328999c784cb9c34fea877b54930d0b0e7729a61f031625789fb25d8e70f0184018413ef56b40022ba4251d7179e12e056e07be74bf8e1ee888cc364d2bc7cf69f015b7693c1f2ff34f1525991520e005b1c823b819d00045d5c3d7338d39265fd728dbea954a54e95ce9f5bc894e0a96e82f3a503be6f8083e8714d070529b789e116eadfe76e99b303d564a227d884c1a8aa0d574a1686706458eb3814bcfff7bec779671ebe6add2e4b327b7abf08d9cedba31d8da38d8d73528be0d9cfbc4156f52a16bbeba7e527a4663abbeffae0a7da29a3f13b70e5dae821f6bba20bcf32820c715dfc99029f630197c78ef1365363dc2767ca34c5788114d16ba96246ae583771f98f41f14a8ba7b025c661c15ddccac9fbdb66563d2274d029018527402859effb57ba6b7343a188bfaaf8ba4f934bf96e9b4e0712a675fdccbd4e00a7ab41235684db19724d861af3b37cb20609dfa5d8862ca553b404a29ecfb251745101a3081199fd279a1afe649173b0cd7e05e9a436d90e2bcec550f0b0799da2d1ae6d78adcd5ed49f01fbfa10fd96d39399643ebaf32e13d70d2278e4628a2ffda12797b17cd8d21c5a260e16f427ae8b0e26c31c041fecbb5f00b98eff105f52611b3e7d79762ed96854b5dc74c7a2c8bf5254999b8fef5a63676a1e8fb230d1b45cc6b127284f2b4fc68398c0eda2e60ef97c2a9672b053645a934e554ace383f2c7742e6339e062b90c9591c32808a0e32cb6e80317c464819e8ff9954cdfb85e7e107d93339e27094e03ee4e21d31236c57a5e4ac8c8567ad0ff1281e164e353f08f519f1daf165d9e7662fdf9f112abfd1799ddc98f62bd27459e5adb8f894114437b38d06443bcd424bf9e24ba622fc8e80c210399b7be2a99a219a31e7d83d99c567de2e02340a0d24d321e763dc4ecde2c225b40d9f27e4fbdbe6dfbcd57420caebd578a1e4cab890bc4af995aee03a664c8b102ef79c95614919a241979cab7b82151a7929858ea5e521940db60c0d4cb56ff092f793e707b6c969b44996b2694095b43272d75add69b9920e',
   *   tx_hash_list: ['25e8ff6a5a31358372c87c5d508846f5bbdf46bebb720341d958a0496ade8f4a']
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
   *   tx_hash_list: ['7e38dfa8163afd3602151c1c8ba48761e80855a990352d3075f9b3d689d01f78']
   * }
   */
  submit_multisig(tx_data_hex) {
    let params = { tx_data_hex: tx_data_hex };
    return this._run('submit_multisig', params);
  }
}

module.exports = walletRPC;

function toAtomicUnits(num) {
  num = num * 1000000000000;

  // Avoid scientific notation (from https://gist.github.com/jiggzson/b5f489af9ad931e3d186#gistcomment-2681363)
  const sign = Math.sign(num);
  //if the number is in scientific notation remove it
  if(/\d+\.?\d*e[\+\-]*\d+/i.test(num)) {
    const zero = '0';
    const parts = String(num).toLowerCase().split('e'); //split into coeff and exponent
    const e = parts.pop(); //store the exponential part
    let l = Math.abs(e); //get the number of zeros
    const direction = e/l; // use to determine the zeroes on the left or right
    const coeff_array = parts[0].split('.');
    
    if (direction === -1) {
      coeff_array[0] = Math.abs(coeff_array[0]);
      num = zero + '.' + new Array(l).join(zero) + coeff_array.join('');
    }
    else {
      const dec = coeff_array[1];
      if (dec) l = l - dec.length;
      num = coeff_array.join('') + new Array(l+1).join(zero);
    }
  }
  
  if (sign < 0) {
    num = -num;
  }

  return num;
}
