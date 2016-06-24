
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
            BAD_PASSWORD: 'install(): Bad password',
            EXISTS: 'install(): DB or key already exist',
            NOT_INSTALLED: 'load(): Key/Keystore not installed',
            DERIVE_KEY: 'load(): Derive key from password failed'
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

        // Initial state
        self.initialized = false;
        self.installed = false; 

        // isInstalled(): Resolves immediately if db and keystore are already loaded. 
        // Checks for keystore in pouchDB & user key in keychain. Returns promise.
        self.isInstalled = function(){
            var d = $q.defer();
            var dbTest, p1, p2;

            if (!db && !key){
                
                dbTest = new PouchDB(names.DB, {adapter : 'websql'});

                $q.all([ $q.when(dbTest.get(names.DB_KEYSTORE)), 
                         keychain.getForKey(names.KEY_USER, names.KEY_SERVICE) ])

                .then( function(){ self.installed = true;  d.resolve(true) }, 
                       function(){ self.installed = false; d.reject(false) });

            } else d.resolve();
    
            return d.promise;
        };

        // install(): Should only run when app is first downloaded.
        self.install = function(password){

            var seed, ksDoc, addrDoc;
            var where = 'AnimistAccounts:create';
            var d = $q.defer();

            // Validate password
            if ( password && typeof password === 'string' ){
                
                // Verify not installed
                if (!self.installed ){
                
                    // Keystore setup
                    seed = wallet.keystore.generateRandomSeed();
                    wallet.keystore.deriveKeyFromPassword(password, function(err, derivedKey) {

                        if (err){ 
                            d.reject(err);
                        } else {
                            
                            // Generate keystore object
                            keystore = new wallet.keystore( seed, derivedKey);
                            keystore.generateNewAddress(derivedKey, 1);
                            address = keystore.getAddresses()[0];
                            key = derivedKey;
                            
                            // Open DB and prep docs
                            db = new PouchDB(names.DB, {adapter: "websql"});
                            ksDoc = { '_id': names.DB_KEYSTORE, 'val': keystore.serialize() };
                            addrDoc = {'_id': names.DB_ADDRESS, 'val': address };
                            
                            // Save keys to keychain. Save keystore and current address to DB. 
                            // (Wipe all saved data if there is an error in this sequence.)
                            $q.all( [ keychain.setForKey(names.KEY_USER, names.KEY_SERVICE, password),
                                      $q.when(db.put(ksDoc)),
                                      $q.when(db.put(addrDoc))])
                            
                            .then(  function(success){ 
                                        self.installed = true; 
                                        d.resolve()},

                                    function( error ){ 
                                        reset().then(function(){ 
                                            d.reject(error)
                                        }) 
                                    })

                            // Notify angular we finished. 
                            .finally(function(){ 
                                $rootscope.$apply() 
                            });
                        };
                    });
                } else d.reject(codes.EXISTS);
            } else d.reject(codes.BAD_PASSWORD);

            return d.promise;
        };
        
        self.load = function(){
            var password;
            var d = $q.defer();
            var where = 'AnimistAccounts:create';
            
            if (self.installed){
                
                // Load keystore, current address & password
                $q.all([ $q.when(db.get(names.DB_KEYSTORE)),
                         $q.when(db.get(names.DB_ADDRESS)),
                         keychain.getForKey(names.KEY_USER, names.KEY_SERVICE) ])

                .then(
                    function(data){

                        keystore = wallet.keystore.deserialize(data[0].val);
                        address = data[1].val
                        password = data[2];

                        // Generate password derived key and check against keystore
                        wallet.keystore.deriveKeyFromPassword(password, function(err, derivedKey){
                            if (err) {
                                d.reject(codes.DERIVE_KEY)

                            } else if (!keystore.isDerivedKeyCorrect(derivedKey)){
                                d.reject(codes.BAD_KEY) 
                                
                            } else {
                                key = derivedKey;
                                d.resolve();
                            };
                        });
                    },
                    // Load failed
                    function(e){ d.reject(e)} )

                // Notify angular we finished. 
                .finally(function(){ 
                    $rootscope.$apply() 
                });

            // Not Installed
            } else d.reject(codes.NOT_INSTALLED);

            return d.promise;
        };
           
        self.getCurrentAddress = function(){ return address };

        self.saveContract = function(key, val){ };
        self.getContract = function(key){};
        self.allContracts = function(){};
        self.setContract = function( abi ){};
        self.selectFunction = function( state ){};
        self.setFunctionMap = function( map ){};

        // ----------------------- Utilities -------------------------------
        // reset(): Resetting destroys the local database and deletes the user
        // password from the keychain. Unless DB is replicated AND user can 
        // remember their password, all local accounts are toast. This is 
        // called by install() to unwind installation if it fails mid stream.
        function reset(){
            
            self.installed = false;

            if (keychain){
                keychain.removeForKey(names.KEY_PW, names.KEY_SERVICE);
                keystore = address = key = undefined;    
            }

            if (db)  return $q.when(db.destroy());
            else     return $q.when(true);
        };

        

        // Unit testing helpers . . .
        self.getNames = function(){ return names };
        self.getCodes = function(){ return codes };
        self.getDB = function(){ return db };
        self.getKeychain = function(){ return keychain};
        self.clearPrivate = function(){ keystore = address = key = undefined};
        self.exposePrivate = function(){ return {}}
        
        
        self.sign = function( msg ){
            return wallet.signing.signMsg( keystore, key, msg, address); 
        };

        // Returns Hex address
        self.recover = function(raw){
            return wallet.signing.recover( raw, signed.v, signed.r, signed.s);
        }

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
    };
    
//})();
