# `monerojs`
A Monero library written in ES6 JavaScript

This library has two main parts: a Monero daemon (`monerod`) JSON-RPC API wrapper, `daemonRPC.js`, and a Monero wallet (`monero-wallet-rpc`) JSON-RPC API wrapper, `walletRPC.js`.

### Requirements
 - Node.js
 - A Monero node (remote nodes support most, but not all, methods.)

## Installation
```bash
npm install monerojs
```
*`--save` optional*

## Testing

Install dependencies (`npm install`) and then run `npm test`

## Usage

JSON-RPC interfaces and their methods are wrapped in promises.  Much more exhaustive examples can be found in the [tests](https://github.com/monerojs/monerojs/blob/dev/test/index_test.js)

#### Autoconnect to Monero daemon (`monerod`)

```js
const Monero = require('monerojs');

var daemonRPC = new Monero.daemonRPC({ autoconnect: true })
.then((daemon) => {
  daemonRPC = daemon; // Store daemon interface in global variable
  
  daemonRPC.getblockcount()
    .then(blocks => {
      console.log(blocks);
    });
  })
  .catch((err) => {
    console.error(err);
  });
```

#### Connect to specific Monero daemons

```js
// const daemonRPC = new Monero.daemonRPC().then(...).catch(...); // Connect with defaults
// const daemonRPC = new Monero.daemonRPC('127.0.0.1', 28081, 'user', 'pass', 'http').then(...).catch(...); // Example of passing in parameters
// const daemonRPC = new Monero.daemonRPC({ port: 28081, protocol: 'https' }).then(...).catch(...); // Parameters can be passed in as an object/dictionary
const daemonRPC = new Monero.daemonRPC() // Connect with defaults
.then(daemon => {
  daemonRPC = daemon; // Store daemon interface in global variable

  daemonRPC.getblockcount()
  .then(height => {
    console.log(height);
  });
})
.catch(err => {
  throw new Error(err);
});
```

#### Connect to Monero wallet (`monero-wallet-rpc`)

```js
// const walletRPC = new Monero.walletRPC('127.0.0.1', 28083, 'user', 'pass', 'http').then(...).catch(...); // Example of passing in parameters
// const walletRPC = new Monero.walletRPC({ port: 28083, protocol: 'https' }).then(...).catch(...); // Parameters can be passed in as an object/dictionary
// const walletRPC = new Monero.walletRPC({ autoconnect: true }).then(...).catch(...); // Autoconnect
const walletRPC = new Monero.walletRPC() // Connect with defaults
.then(wallet => {
  walletRPC = wallet; // Store wallet interface in global variable

  walletRPC.create_wallet('monero_wallet', '')
  .then(new_wallet => {
    walletRPC.open_wallet('monero_wallet', '')
    .then(wallet => {
      walletRPC.getaddress()
      .then(balance => {
        console.log(balance);
      });
    });
  });
})
.catch(err = {
  console.error(err);
});
```

#### Check if Monero wallet is available (running)

```js
var checkForLocalWalletRPC = new Monero.walletRPC({ initialize: false })
.then(() => {
  console.log('monero-wallet-rpc available');
})
.catch(error => {
  console.error('monero-wallet-rpc is unavailable')
});
```
