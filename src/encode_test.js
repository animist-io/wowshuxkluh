//var web3 = require('web3');
var lightwallet = require('eth-lightwallet');
var util = require('ethereumjs-util');

var ks, addr, password;
var secretSeed = lightwallet.keystore.generateRandomSeed();
var code = '6060604052610381806100136000396000f30060606040526000357c0100000000000000000000000000000000000000000000000000000000900480630ff4c9161461006557806329507f731461008c5780637b8d56e3146100a5578063c41a360a146100be578063f207564e146100fb57610063565b005b610076600480359060200150610308565b6040518082815260200191505060405180910390f35b6100a36004803590602001803590602001506101b3565b005b6100bc60048035906020018035906020015061026e565b005b6100cf600480359060200150610336565b604051808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b61010c60048035906020015061010e565b005b60006000600050600083815260200190815260200160002060005060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614156101af57336000600050600083815260200190815260200160002060005060000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908302179055505b5b50565b3373ffffffffffffffffffffffffffffffffffffffff166000600050600084815260200190815260200160002060005060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16141561026957806000600050600084815260200190815260200160002060005060000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908302179055505b5b5050565b3373ffffffffffffffffffffffffffffffffffffffff166000600050600084815260200190815260200160002060005060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff161415610303578060006000506000848152602001908152602001600020600050600101600050819055505b5b5050565b600060006000506000838152602001908152602001600020600050600101600050549050610331565b919050565b60006000600050600083815260200190815260200160002060005060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905061037c565b91905056';
//var abi = [{"constant":true,"inputs":[{"name":"key","type":"uint256"}],"name":"getValue","outputs":[{"name":"value","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[{"name":"key","type":"uint256"},{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"key","type":"uint256"},{"name":"newValue","type":"uint256"}],"name":"setValue","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"key","type":"uint256"}],"name":"getOwner","outputs":[{"name":"owner","type":"address"}],"type":"function"},{"constant":false,"inputs":[{"name":"key","type":"uint256"}],"name":"register","outputs":[],"type":"function"}];
var abi = [{"constant":false,"inputs":[{"name":"key","type":"uint256"}],"name":"register","outputs":[],"type":"function"}];

var uuid = "4F7C5946-87BB-4C50-8051-D503CEBA2F19";

console.log("SECRET SEED: " + secretSeed);

password = 'hello';
lightwallet.keystore.deriveKeyFromPassword(password, function (err, pwDerivedKey) {

   ks = new lightwallet.keystore(secretSeed, pwDerivedKey);

   ks.generateNewAddress(pwDerivedKey, 1);
   addr = ks.getAddresses();

   //var buffer = util.toBuffer(uuid);
   var msg = lightwallet.signing.signMsg(ks, pwDerivedKey, uuid, addr[0]);

   console.log(msg)
   var decoded = lightwallet.signing.recoverAddress(uuid, msg.v, msg.r, msg.s);

   
    var txOptions = {
        gasPrice: 10000000000000,
        gasLimit: 3000000,
        value: 10000000,
        nonce: 2,
        data: code
    }
    var contractData = lightwallet.txutils.createContractTx(addr[0], txOptions);

    txOptions.to = contractData.addr;

    var registerTx = lightwallet.txutils.functionTx(abi, 'register', [123], txOptions)
    var signedRegisterTx = lightwallet.signing.signTx(ks, pwDerivedKey, registerTx, addr[0])  

    console.log(signedRegisterTx);
    var total = msg + signedRegisterTx;
    console.log(signedRegisterTx.length)
    console.log(total.length);

    console.log(total)
 
});

