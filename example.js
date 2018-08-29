// const Monero = require('monerojs'); // Used when accessing class outside of library
const Monero = require('./index.js'); // Used when accessing class from within library

// Autoconnect asynchronously (with a promise)
var daemonRPC = new Monero.daemonRPC({ autoconnect: true, random: true })
.then(daemon => {
  daemonRPC = daemon; // Store daemon interface in global variable
  
  daemonRPC.getblockcount()
  .then(blocks => {
    console.log(`Block count: ${blocks['count'] - 1}`);
  });
})
.catch(err => {
  console.error(err);
});

var walletRPC = new Monero.walletRPC()
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
.catch(err => {
  console.error(err);
});
