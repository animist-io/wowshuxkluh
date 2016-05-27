//var web3 = require('web3');
var lightwallet = require('eth-lightwallet');
var util = require('ethereumjs-util');

var ks, addr, password;
var secretSeed = lightwallet.keystore.generateRandomSeed();

var uuid = "4F7C5946-87BB-4C50-8051-D503CEBA2F19";
console.log("SECRET SEED: " + secretSeed);

password = 'hello';
lightwallet.keystore.deriveKeyFromPassword(password, function (err, pwDerivedKey) {

   ks = new lightwallet.keystore(secretSeed, pwDerivedKey);

   ks.generateNewAddress(pwDerivedKey, 1);
   addr = ks.getAddresses();

   //var buffer = util.toBuffer(uuid);
   var msg = lightwallet.signing.signMsg(ks, pwDerivedKey, uuid, addr[0]);
   var decoded = lightwallet.signing.recoverAddress(uuid, msg.v, msg.r, msg.s);

   console.log('DECODED: ' + decoded.toString('hex'));
   console.log('ADDR: ' + addr[0]);
 
});

