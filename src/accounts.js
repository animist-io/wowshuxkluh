
//(function(){

"use strict"

var acc_debug;
angular.module('animist')
  .service("AnimistAccount", AnimistAccount);

    function AnimistAccount($rootScope, $q, $cordovaKeychain ){

        var self = this;

        // Lightwallet 
        var wallet = {};
        wallet.signing = lightwallet.signing;
        wallet.txutils = lightwallet.txutils;
        wallet.keystore = lightwallet.keystore;

        // Keychain
        var keychain = $cordovaKeychain; 
        
        // Locals
        var keystore; // The keystore object serialized in the DB 
        var address;  // The current public user address
        var key;      // The password derived key stored in the device KeyChain
        var db;       // PouchDB object
        var contract; // The current contract ABI

        // Errors
        var codes = {
            BAD_PASSWORD: 'Password unacceptable',
            EXISTS: 'Db or key already exist',
        }

        // Names of external resources
        var names = {
            DB: 'animist',
            DB_KEYSTORE: 'keystore',
            DB_ADDRESS: 'current_address', 
            KEY_SERVICE: '9tieods',
            KEY_USER: 'o9021qw',
            KEY_API: 'zvuekx3' 
        };

        self.initialized = false;

        self.install = function(password){

            var seed, ksDoc, addrDoc;
            var where = 'AnimistAccounts:create';
            var d = $q.defer();

            if ( password && typeof password === 'string' ){
                
                // Already installed? Reject. 
                self.isInstalled().then(function( isInstalled ){
                    d.reject({where: where, error: codes.EXISTS })
                
                // Install
                }, function( notInstalled ){
                    // Generate keystore object
                    seed = wallet.keystore.generateRandomSeed();
                    wallet.keystore.deriveKeyFromPassword(password, function(err, derivedKey) {

                        if (err){ 
                            console.log('error: ' + JSON.stringify(err));
                            d.reject({ where: where, error: err });

                        } else {
                            
                            keystore = new wallet.keystore( seed, derivedKey);
                            keystore.generateNewAddress(derivedKey, 1);
                            address = keystore.getAddresses()[0];
                            key = derivedKey;
                            db = new PouchDB(names.DB, {adapter: "websql"});

                            ksDoc = { '_id': names.DB_KEYSTORE, 'val': keystore.serialize() };
                            addrDoc = {'_id': names.DB_ADDRESS, 'val': address };
                            
                            // Save keys to keychain, keystore and address to DB. Wipes all saved data
                            // clear if there is an error in this sequence.
                            $q.all( [ keychain.setForKey(names.KEY_USER, names.KEY_SERVICE, password),
                                      $q.when(db.put(ksDoc)),
                                      $q.when(db.put(addrDoc))] )
                            
                            .then(function(success){ d.resolve()},
                                  function( error ){ eraseAll(); d.reject({ where: where, error, error}) })

                            .finally(function(){
                                $rootscope.$apply();
                            });
                        };
                    });
                });

            } else d.reject({where: where, error: codes.BAD_PASSWORD});

            return d.promise;
        };
        
        function eraseAll(){
            
            if (db) 
                $q.when(db.destroy());
    
            if (keychain){
                keychain.removeForKey(names.KEY_PW, names.KEY_SERVICE);
                keystore = address = key = undefined;
            }
        };

        // isInstalled(): If db and keystore are already loaded, resolves immediately. 
        // Otherwise checks for keystore existence in pouchDB & user key existence 
        // in keychain. Returns promise.
        self.isInstalled = function(){
            var d = $q.defer();
            var dbTest, p1, p2;

            var print = function(val){console.log('val: ' + val)};

            if (!db && !key){
                
                dbTest = new PouchDB(names.DB, {adapter : 'websql'});

                $q.all([ $q.when(dbTest.get(names.DB_KEYSTORE)), 
                         keychain.getForKey(names.KEY_USER, names.KEY_SERVICE) ])

                .then( function(val){ d.resolve(true) }, 
                       function(){ d.reject(false) });

            } else d.resolve();
    
            return d.promise;
        };

        self.getNames = function(){ return names };
        self.getCodes = function(){ return codes };
        self.getDB = function(){ return db };
        self.getKeychain = function(){ return keychain};

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
            return wallet.signing.signMsg( ks, key, msg, address); 
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

            contractData = wallet.txutils.createContractTx(address, txOptions);
            txOptions.to = contractData.addr;

            fnTx = wallet.txutils.functionTx(contract, fn, [], txOptions);
            return wallet.signing.signTx(keystore, key, fnTx, address);

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
