
//(function(){

"use strict"
angular.module('animist')
  .service("AnimistAccount", AnimistAccount);

    function AnimistAccount($rootScope, $q ){

        var self = this;

        // Lightwallet 
        var signing = lightwallet.signing;
        var txutils = lightwallet.txutils;
        var keystore = lightwallet.keystore;
        
        // Locals
        var ks;       // The keystore object serialized in the DB 
        var address;  // The current public user address
        var key;      // The password derived key stored in the device KeyChain
        var db;       // PouchDB object
        var contract; // The current contract ABI

        self.initialized = false;

        self.create = function(password){

            // Errors: 
            // password_bad
            // exists

            if ( password && typeof password === 'string' ){
                if (!keyExists() && !keystoreExists()){
                    // create DB
                    // create key
                    // create keystore
                    // create address
                    // save key 
                    // save keystore or destroy key
                    // save address to currentAddress or destroy keystore and key. 
                    // bind all to runtime;
                } else{
                    d.reject()
                } 
            } else {
                d.reject()
            } 
        };
        
        self.keyExists = function(){};
        self.keystoreExists = function(){};

        self.load = function(){};
            // get key from keystore
            // get keystore from pouchDB
            // get currentAddress
    
        self.saveContract = function(key, val){ };
        self.getContract = function(key){};
        self.allContracts = function(){};
        self.setContract = function( abi ){};
        self.selectFunction = function( state ){};
        self.setFunctionMap = function( map ){};

        self.sign = function( msg ){
            return signing.signMsg( ks, key, msg, address); 
        };

        self.generateTx = function(code, state){

            var contractData, txOptions, fn;
        
            txOptions = {
                gasPrice: 10000000000000,
                gasLimit: 3000000,
                value: 10000000,
                nonce: 2, 
                data: code
            };

            fn = self.selectFunction(state);

            contractData = txutils.createContractTx(address, txOptions);
            txOptions.to = contractData.addr;

            fnTx = txutils.functionTx(contract, fn, [], txOptions);
            return signing.signTx(ks, key, fnTx, address);

        };

        // OLD: This is running in AnimistBeacon . . . from the linkedin testing days . . .
        self.init = function( password ){

            var d = $q.defer();

            var ks, addr, password = 'hello';
            var secretSeed = lightwallet.keystore.generateRandomSeed();
            lightwallet.keystore.deriveKeyFromPassword(password, function (err, pwDerivedKey) {

                if (err){ d.reject(err)
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
                    $rootScope.$apply();
                };
            });

            return d.promise;

        };   
    };
    
//})();
