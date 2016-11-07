"use strict"

angular.module('animist').service("AnimistAccount", AnimistAccount);

function AnimistAccount($rootScope, $q, $cordovaKeychain ){

		var self = this;
		var here = 'AnimistAccount: ';

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
			BAD_PASSWORD: here + "Cannot install. Bad password.",
			EXISTS: here + "Cannot install. DB or key already exist.",
			NOT_INSTALLED: here + "Can't load: Key/Keystore not installed.",
			DERIVE_KEY: here + "Can't load: Couldn't derive key from password.",
			BAD_KEY: here + "Can't load: User password doesn't unlock keystore",
			BAD_ADDRESS: here + "Can't select: Address malformed",
			ADDRESS_DNE: here + "Can't select: Address couldn't be found",
			NOT_INITIALIZED: here + "Method requires service be initialized" 
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

		/**
		 * Boolean set to true when service has loaded/installed keystore & is able to sign txs
		 * @var initialized
		 */
		self.initialized = false;

		 /**
		 * Boolean set to true when app has a working DB and a password saved to device keychain
		 * @var installed
		 */
		self.installed = false; 

		//-------------------------------------------------------------------------------------------------
		// ------------------------------  Installation & Loading -----------------------------------------
		//-------------------------------------------------------------------------------------------------

		/**
		 * Checks for presence of keystore in pouchDB & user key in keychain. 
		 * FWIW: If password has been deleted from the keychain but keystore 
		 * exists in the DB, subsequent installation will fail AND wipe the DB from the device. 
		 * THEN, subsequent installs should succeed.
		 * @method isInstalled
		 * @return {promise} Resolves if assets are installed or already loaded, rejects otherwise.
		 */
		self.isInstalled = function(){
			var d = $q.defer();
			var dbTest, p1, p2;

			if (!db){
					
				dbTest = new PouchDB(names.DB, {adapter : 'websql'});

				$q.all([ $q.when(dbTest.get(names.DB_KEYSTORE)), 
					     keychain.getForKey(names.KEY_USER, names.KEY_SERVICE) ])

				.then( function(){ self.installed = true;  d.resolve() }, 
					   function(){ self.installed = false; d.reject() });

			} else d.resolve();

			return d.promise;
		};

		/**
		 * Generates keystore and a single address. Saves these to DB and sets address as current account. 
		 * Sets service state to 'installed' and 'initialized'. On fail it wipes whatever assets it 
		 * created attempting to install.
		 * @method install
		 * @param {String} password: the pw to encrypt the keystore with
		 * @return {promise} Resolves when installation is complete, rejects on error w/error
		 */
		self.install = function(password){

			var seed, ksDoc, addrDoc;
			var where = 'AnimistAccounts:create';
			var d = $q.defer();

			// Validate password and verify not installed
			if ( password && typeof password === 'string' ){
					
				if (!self.installed ){
					
					// Keystore setup
					//seed = wallet.keystore.generateRandomSeed();
					wallet.keystore.createVault({ password: password }, function(err, ks){
						keystore = ks;
						ks.keyFromPassword(password, function(err, derivedKey) {

							if (err){ 
								d.reject(err);
							} else {
												
								ks.generateNewAddress(derivedKey, 1);
								address = ks.getAddresses()[0];
								key = derivedKey;
			
								// Open DB and prep docs
								db = new PouchDB(names.DB, {adapter: "websql"});
								ksDoc = { '_id': names.DB_KEYSTORE, 'val': ks.serialize() };
								addrDoc = {'_id': names.DB_ADDRESS, 'val': address };
					
								// Save password to keychain. Save keystore and current address to DB. 
								$q.all( [ keychain.setForKey(names.KEY_USER, names.KEY_SERVICE, password),
										  $q.when(db.put(ksDoc)),
										  $q.when(db.put(addrDoc))])
								
								.then( function(success){ 
									self.installed = true; 
									self.initialized = true;
									d.resolve()
								})

								// Wipe all saved data if there was an error in sequence above.
								.catch(function( error ){ 
									reset().then(function(){ d.reject(error)}) 
								})

								// Tell angular we finished. 
								.finally(function(){ 
									$rootscope.$apply() 
								});
							};
						});
					});
				} else d.reject(codes.EXISTS);
			} else d.reject(codes.BAD_PASSWORD);

			return d.promise;
		};
		
		/**
		 * Loads keystore and current account from DB, gets password from keychain and 
		 * uses it to derive key from keystore.
		 * @method load
		 * @return {promise} Resolves on success, rejects w/error on error
		 */
		self.load = function(){
			var password;
			var d = $q.defer();
			var where = 'AnimistAccounts:create';
			
			if (self.installed){
					
				// Load keystore, current address & password
				$q.all([ $q.when(db.get(names.DB_KEYSTORE)),
						 $q.when(db.get(names.DB_ADDRESS)),
						 keychain.getForKey(names.KEY_USER, names.KEY_SERVICE) ])

					.then(function(data){

						keystore = wallet.keystore.deserialize(data[0].val);
						address = data[1].val
						password = data[2];

						// Generate password derived key and check against keystore
						keystore.keyFromPassword(password, function(err, derivedKey){
							if (err) {
								d.reject(codes.DERIVE_KEY)

							} else if (!keystore.isDerivedKeyCorrect(derivedKey)){
								d.reject(codes.BAD_KEY) 
									
							} else {
								key = derivedKey;
								self.initialized = true;
								d.resolve();
							};
						});
					})

					// Load failed
					.catch(d.reject)
							
					// Notify angular we finished. 
					.finally(function(){ 
						$rootscope.$apply() 
					});

			// Not Installed
			} else d.reject(codes.NOT_INSTALLED);

			return d.promise;
		};
			 

		//-------------------------------------------------------------------------------------------------
		// ------------------------------  Account Mgmt ---------------------------------------------------
		//-------------------------------------------------------------------------------------------------   
		
		/**
		 * Gets address of currently selected account
		 * @method getCurrentAccount
		 * @return {String} ethereum account address 
		 */
		self.getCurrentAccount = function(){ 
			return (self.initialized) ? address : undefined;
		};

		/**
		 * Gets all accounts in keystore 
		 * @method listAccounts
		 * @return {array} account address strings 
		 */
		self.listAccounts = function(){
			return (self.initialized) ? keystore.getAddresses() : undefined;
		}

		 /**
		 * Generates new account in keystore.
		 * @method generateAccount
		 * @return {undefined} 
		 */
		self.generateAccount = function(){
			keystore.generateNewAddress(key);
		};

		/**
		 * Sets newAddress to currentAddress if newAddress 
		 * exists in the the keystore. Saves this change to DB. 
		 * @method selectAccount
		 * @param {string} the account to select
		 * @return {promise} Resolves after db save, rejects w/error on fail 
		 */
		self.selectAccount = function( newAddress ){
			var list, selected, update;
			var d = $q.defer();

			if (self.initialized && typeof newAddress === 'string'){
	
				if (isIn( newAddress, keystore.getAddresses())){
					
					update = { _id: names.DB_ADDRESS, val: newAddress }; 
					$q.when( db.get(names.DB_ADDRESS).then(function(doc) {
		
						update._rev = doc._rev;
						db.put(update)

							.then(function(){ 
								address = newAddress; 
								d.resolve() })

							.catch(d.reject)
									
							}).catch(d.reject)
					)
				} else d.reject(codes.ADDRESS_DNE)
			} else d.reject(codes.BAD_ADDRESS)

			return d.promise;  
		};

		self.sign = function( msg ){
			return wallet.signing.signMsg( keystore, key, msg, address); 
		};

		// Returns Hex address
		self.recover = function(raw){
			return wallet.signing.recover( raw, signed.v, signed.r, signed.s);
		}

		// 
		self.saveContract = function(key, val){ };
		self.getContract = function(key){};
		self.allContracts = function(){};
		self.setContract = function( abi ){};
		self.selectFunction = function( state ){};
		self.setFunctionMap = function( map ){};

		
		// ----------------------- Utilities -------------------------------
		

		// reset(): Resetting destroys the local database and deletes the user
		// password from the keychain. Unless DB is replicated AND user can 
		// remember their password, local accounts are toast. 
		// Called by install() to unwind installation if it fails mid stream.
		function reset(){
				
			self.installed = false;

			if (keychain){
				keychain.removeForKey(names.KEY_PW, names.KEY_SERVICE);
				keystore = address = key = undefined;    
			}

			if (db)  return $q.when(db.destroy());
			else     return $q.when(true);
		};

		// isIn(): Query in target?
		function isIn(query, target){
			for (var i = 0; i < target.length; i++){
				if (query === target[i])
					return true;
			}
			return false;
		};


		// Unit testing helpers . . .
		self.getNames = function(){ return names };
		self.getCodes = function(){ return codes };
		self.getDB = function(){ return db };
		self.getKeychain = function(){ return keychain};
		self.clearPrivate = function(){ keystore = address = key = undefined};
		self.printKeystore = function(){ console.log(keystore.serialize())};
		self.printKey = function(){console.log(key)};
		
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

				// From whale-island experiments
				// Deploy TestContract, compose some signed transactions for rawTx submission.
				// Probably irrelevant since eth-lightwallet is supposed to do all of this for you.
				/*return newContract( contracts.Test, { from: client })
								.then( testContract => {
									deployed = testContract; 
									let code = web3.eth.getCode(deployed.address); 
									let abi = deployed.abi;
									let txOptions = {
										gasPrice: 1,
										gasLimit: 3000000,
										value: 0,
										nonce: 0,
										data: util.stripHexPrefix(code)
									}
									//console.log('code: ' + code);
									//let contractData = wallet.txutils.createContractTx(client, txOptions);
									//console.log('contractData: ' + JSON.stringify(contractData));
									//console.log('deployed: ' + deployed.address);
									//txOptions.to = util.stripHexPrefix(contractData.addr);
									
									txOptions.to = util.stripHexPrefix(deployed.address);
									let setTx = wallet.txutils.functionTx(abi, 'setState', [2], txOptions);
									
									let rawTx = util.stripHexPrefix(setTx);
									let signingAddress = util.stripHexPrefix(client);
									let txCopy = new Transaction(new Buffer(rawTx, 'hex'));
									let privKey = util.stripHexPrefix(keys[0])
									
									txCopy.sign(new Buffer(privKey, 'hex'));
									console.log('sender: ' + txCopy.getSenderAddress().toString('hex'));
									console.log('verify: ' + txCopy.verifySignature());
									let txCopyReg = txCopy.serialize().toString('hex');
									console.log(txCopyReg);
									let hash = web3.eth.sendRawTransaction(txCopyReg);
									console.log(web3.eth.getTransactionReceipt(hash))

									let animistContract = web3.eth.contract(abi);
									let instance = animistContract.at(deployed.address);
									let hash2 = instance.setState(3, {from: client});
									console.log();
									console.log(web3.eth.getTransactionReceipt(hash2));
									//console.log(hash2);

								});*/
		};
};
		
