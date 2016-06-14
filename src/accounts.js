
(function(){

"use strict"

angular.module('Animist')
  .service("AnimistAccount", AnimistAccount);

    function AnimistAccount($rootScope, $q ){

        var self = this;
        var user = {};
        
        // Testing
        self.init = function(){

            var d = $q.defer();

            var ks, addr, password = 'hello';
            var secretSeed = lightwallet.keystore.generateRandomSeed();
            lightwallet.keystore.deriveKeyFromPassword(password, function (err, pwDerivedKey) {

                if (err){
                    d.reject(err);
                } else {
                    ks = new lightwallet.keystore(secretSeed, pwDerivedKey);
                    ks.generateNewAddress(pwDerivedKey, 1);
                    addr = ks.getAddresses();

                    user = {
                        animistUserIsInitialized: true,
                        pwDerivedKey: pwDerivedKey,
                        address: addr,
                        keystore: ks,
                        sign: sign,
                        recover: recover
                    } 
                    d.resolve(user);
                };
            });

            return d.promise;

        };

        function sign(msg){
            return lightwallet.signing.signMsg(user.keystore, user.pwDerivedKey, msg, user.address);
        }

        function recover(msg, signed){
            return lightwallet.signing.recoverAddress(msg, signed.v, signed.r, signed.s);
        }

        // TEST . . . 
        function generateTx(tx){

            var abi = [{"constant":true,"inputs":[{"name":"key","type":"uint256"}],"name":"getValue","outputs":[{"name":"value","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[{"name":"key","type":"uint256"},{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"key","type":"uint256"},{"name":"newValue","type":"uint256"}],"name":"setValue","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"key","type":"uint256"}],"name":"getOwner","outputs":[{"name":"owner","type":"address"}],"type":"function"},{"constant":false,"inputs":[{"name":"key","type":"uint256"}],"name":"register","outputs":[],"type":"function"}]

            var txOptions = {
                gasPrice: 10000000000000,
                gasLimit: 3000000,
                value: 10000000,
                nonce: 2,
                data: tx.code
            }
            var contractData = lightwallet.txutils.createContractTx(sendingAddr, txOptions);

            var registerTx = txutils.functionTx(abi, 'register', [123], txOptions)
            var signedRegisterTx = signing.signTx(user.keystore, user.pwDerivedKey, registerTx, user.address)  

            console.log(JSON.stringify(signedRegisterTx));
        }

        self.validate = function(_user){
            return ( _user != null && typeof _user === 'object' && 
                    _user.hasOwnProperty('isInitialized') && _user.isInitialized ) 
                
        };
      
        //var decoded = lightwallet.signing.recoverAddress(uuid, msg.v, msg.r, msg.s);
        //console.log('DECODED: ' + decoded.toString('hex'));
        //console.log('ADDR: ' + addr[0]);
     
    };
    
})();
