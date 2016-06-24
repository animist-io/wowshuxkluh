var debug_1, debug_2;

// Gnarly: PouchDB promises are plain JS. To catch test failure, add expectations to the promise
// callbacks you don't intend to hit. Cannot use angular mocks. Database should be explicitly 
// destroyed post test because it will persist if chrome is live-reloading. Failing tests do not
// clean up after themselves and will result in a cascade of failures across reloads . . . so 
// start from the top fixing errors and restart chrome until the 'shouldnt' errors disappear. 

describe('AnimistAccount Service', function(){

   var $scope, $q, $cordovaKeychain, $timeout, $window, pouchDB, AnimistAccount, names;

   // Explicitly inject everything to avoid angular-mocks, so we can test non-angular promises.
   beforeEach(function(){
      
      var $injector = angular.injector(['ng', 'ngCordovaMocks', 'animist']);

      $scope = $injector.get('$rootScope');
      $q = $injector.get('$q');
      $timeout = $injector.get('$timeout');
      $cordovaKeychain = $injector.get('$cordovaKeychain');

      AnimistAccount = $injector.get('AnimistAccount');
      names = AnimistAccount.getNames();
   });

   //-------------------------------------------------------------------------------------------------
   // isInstalled()
   //-------------------------------------------------------------------------------------------------
   describe('isInstalled()', function(){

      it('should set installed flag to true and resolve if key & keystore are saved', function(done){

         var promise, db, expected = 'abcd';
      
         // Setup: Good db, good key
         db = new PouchDB(names.DB, {adapter: "websql"});
         $q.when(db.put({'_id': names.DB_KEYSTORE, 'val': 'someVal'}));
         $cordovaKeychain.setForKey(names.KEY_USER, names.KEY_SERVICE, expected);
         $scope.$digest();

         // Should succeed
         AnimistAccount.isInstalled().then(
            
            function(){ expect(AnimistAccount.installed).toBe(true) },
            function(){ expect(true).toEqual('Should not reject')}
         
         ).finally(function(){
            $q.when(db.destroy()).finally(done);
         });
         $scope.$digest();

      });

      it('should set installed flag to false if keychain is missing users key and reject', function(done){

         var promise, db, expected = 'abcd';
      
         // Setup: Good db, bad key.
         db = new PouchDB(names.DB, {adapter: "websql"});
         $q.when(db.put({'_id': names.DB_KEYSTORE, 'val': 'someVal'}));
         $cordovaKeychain.setForKey('bad_name', 'bad_service', expected);
         $scope.$digest();

         // Should error
         AnimistAccount.isInstalled().then(
         
            function(){ expect(true).toEqual('Should not succeed')},
            function(){ expect(AnimistAccount.installed).toBe(false)}
         
         ).finally(function(){
            $q.when(db.destroy()).finally(done);
         });

         $scope.$digest();

      })

      it('should set installed flag to false if DB is missing keystore and reject', function(done){

         var promise, db, expected = 'abcd';
      
         // Setup: Bad db, good key.
         db = new PouchDB(names.DB, {adapter: "websql"});
         $q.when(db.put({'_id': 'bad_name', 'val': 'someVal'}));
         $cordovaKeychain.setForKey(names.KEY_USER, names.KEY_SERVICE, expected);
         $scope.$digest();

         // Should error
         AnimistAccount.isInstalled().then(
         
            function(){ expect(true).toEqual('Should not succeed')}, 
            function(){ expect(AnimistAccount.installed).toBe(false)}
         
         ).finally(function(){
            $q.when(db.destroy()).finally(done);
         });

         $scope.$digest();

      });
   });

   //-------------------------------------------------------------------------------------------------
   // install()
   //-------------------------------------------------------------------------------------------------
   describe('install(password)', function(){

      it('should save the users password in the keychain', function(done){

         var kc, password = 'Xdkklwlwmmmm';

         AnimistAccount.install(password).then(
            function(){
               kc = $cordovaKeychain.keychains;
               expect(kc[names.KEY_SERVICE][names.KEY_USER]).toEqual(password);
         
         }, function(){
               expect(true).toEqual('Should not reject')

         }).finally(function(){
            if (AnimistAccount.getDB())
               $q.when(AnimistAccount.getDB().destroy()).finally(done);
         });
      });

      it('should save the keystore and one address to the database', function(done){

         var db, keystore, address, saved_address, password = 'Xdkklwlwmmmm';

         AnimistAccount.install(password).then(
            function(){
               db = AnimistAccount.getDB();
               
               // Fetch expected saves from DB
               $q.all([$q.when(db.get(names.DB_KEYSTORE)),
                       $q.when(db.get(names.DB_ADDRESS))])

               // Deserialize keystore, extract address from it and compare 
               // to saved address. QED. 
               .then(function(results){

                  keystore = lightwallet.keystore.deserialize(results[0].val);
                  address = results[1].val;
                  saved_address = keystore.getAddresses()[0];
                  expect(address).toEqual(saved_address);
               })
               .finally(function(){
                  $q.when(AnimistAccount.getDB().destroy()).finally(done);
               });
         }, function(){
               expect(true).toEqual('Should not reject');
         });         
      });

      it('should set installed & initialized flags to true on success', function(done){

         var password = 'Xdkklwlwmmmm';

         AnimistAccount.install(password).then( function(){

               expect(AnimistAccount.installed).toBe(true);
               expect(AnimistAccount.initialized).toBe(true);
         
         }, function(e){
               console.log(e);
               expect(true).toEqual('Should not reject')

         }).finally(function(){
            if (AnimistAccount.getDB())
               $q.when(AnimistAccount.getDB().destroy()).finally(done);
         });
      });

      it('should set "installed" to false, clear resources & reject on failure', function(done){

         var db, password = 'Xdkklwlwmmmm';

         // Mock keychain failure
         $cordovaKeychain.setForKey = function(a, b, c){ return $q.reject('failed')}

         AnimistAccount.install(password).then( function(){

            expect(true).toEqual('Should not succeed');
         
         }, function(fail){
               
            db = AnimistAccount.getDB();
            expect(db._docCount).toEqual(-1);
            expect(db._destroyed).toEqual(true);

         }).finally(function(){
            $q.when(db.destroy()).finally(done);
         });
      });

      it ('should reject with PASSWORD error if there is no password', function(done){

         var codes = AnimistAccount.getCodes();

         // No password
         AnimistAccount.install().catch(function(e){
         
            expect(e).toEqual(codes.BAD_PASSWORD);
         
         }).finally(done);
      });

      it ('should reject with PASSWORD error if password is malformed', function(done){

         var codes = AnimistAccount.getCodes();

         // Boolean password
         AnimistAccount.install(true).catch(function(e){
         
            expect(e).toEqual(codes.BAD_PASSWORD);
         
         }).finally(done);
         
      });

      it('should reject w/ EXISTS error if already installed', function(done){

         var promise, db, codes;

         codes = AnimistAccount.getCodes();
         AnimistAccount.installed = true;

         // Should exist
         AnimistAccount.install('password').catch(function(e){
            
            expect(e).toEqual(codes.EXISTS);
         
         }).finally(done);
      });
   });

   //-------------------------------------------------------------------------------------------------
   // load()
   //-------------------------------------------------------------------------------------------------
   describe('load()', function(){

      it('should load account assets & set initialized flag to true', function(done){

         var msg, current_address, signing_address, expected_address, signed, wallet;

         AnimistAccount.install('secret').then(function(){

            // Setup: remember address then erase everything.
            expected_address = AnimistAccount.getCurrentAccount();
            wallet = lightwallet.signing;
            msg = 'should work';

            AnimistAccount.clearPrivate();

            // Show everything loaded & address persisted by signing and recovering, 
            AnimistAccount.load().then(function(){

               // This signs w/ current address by default
               signed = AnimistAccount.sign(msg);
            
               signing_address = wallet.recoverAddress(msg, signed.v, signed.r, signed.s);
               current_address = AnimistAccount.getCurrentAccount();

               expect(signing_address.toString('hex')).toEqual(expected_address);
               expect(current_address).toEqual(expected_address);

               expect(AnimistAccount.initialized).toBe(true);

            }, function(){
               expect(true).toEqual('Shouldnt reject');
            
            }).finally(function(){
                  $q.when(AnimistAccount.getDB().destroy()).finally(done);
            });
         })

      });

      it('should reject with "BAD KEY" if derived key is incorrect', function(done){

         var kc, codes;
         codes = AnimistAccount.getCodes();

         AnimistAccount.install('secret').then(function(){

            // Corrupt users password & clear everything
            kc = $cordovaKeychain.keychains;
            kc[names.KEY_SERVICE][names.KEY_USER] = 'NOT_secret';
            
            AnimistAccount.clearPrivate();

            // Should error
            AnimistAccount.load().then(function(){

               expect(true).toEqual('Shouldnt succeed');

            }, function(error){
               expect(error).toEqual(codes.BAD_KEY);
            
            }).finally(function(){
                  $q.when(AnimistAccount.getDB().destroy()).finally(done);
            });
         })
      })


      it('should reject w/ NOT_INSTALLED if installation hasnt been verified', function(){
         
         var promise;
         var codes = AnimistAccount.getCodes();

         // No installation
         promise = AnimistAccount.load();
         $scope.$digest();

         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value).toEqual(codes.NOT_INSTALLED);

      })
   })

   //-------------------------------------------------------------------------------------------------
   // getCurrentAccount();
   //-------------------------------------------------------------------------------------------------
   describe('getCurrentAccount()', function(){

      it('should return the address of the currently selected account', function(done){
         var account;

         AnimistAccount.install('password').then(function(){

            // Verifying that currentAccount and DB value are the same
            $q.when(AnimistAccount.getDB().get(names.DB_ADDRESS))
               
               .then(function(record){
                  account = AnimistAccount.getCurrentAccount();
                  expect(account).toEqual(record.val);
               })
               .catch(function(){
                  expect(true).toEqual('Shouldnt reject db.get');
               })
               .finally(function(){
                  $q.when(AnimistAccount.getDB().destroy()).finally(done);
               });
            
         }).catch(function(){
            expect(true).toEqual('Shouldnt reject installation')
         });
      });

      it('should return undefined if service not initialized', function(){
         expect(AnimistAccount.getCurrentAccount()).toBe(undefined);
      })
   });

   //-------------------------------------------------------------------------------------------------
   // listAccounts();
   //-------------------------------------------------------------------------------------------------
   describe('listAccounts()', function(){

      it('should return an array of available accounts', function(done){
         
         var expected_address, accounts;

         AnimistAccount.install('password').then(function(){

            expected_address = AnimistAccount.getCurrentAccount();
            accounts = AnimistAccount.listAccounts();

            expect(accounts.length).toEqual(1);
            expect(accounts[0]).toEqual(expected_address);
         
         }).catch( function(){
            expect(true).toEqual('Shouldnt reject installation')

         }).finally(function(){
            $q.when(AnimistAccount.getDB().destroy()).finally(done);
         })

      });

      it('should return undefined if service not initialized', function(){
         expect(AnimistAccount.getCurrentAccount()).toBe(undefined);
      })

   });

   //-------------------------------------------------------------------------------------------------
   // generateAccount();
   //-------------------------------------------------------------------------------------------------
   describe('generateAccount()', function(){

      it('should generate a new account address in the keystore', function(done){
         
         var initial_length, new_length;

         AnimistAccount.install('password').then(function(){

            initial_length = AnimistAccount.listAccounts().length;
   
            AnimistAccount.generateAccount();
            new_length = AnimistAccount.listAccounts().length;

            expect(initial_length).toEqual(1);
            expect(new_length).toEqual(2);
         
         }).catch( function(){
            expect(true).toEqual('Shouldnt reject installation')

         }).finally(function(){
            $q.when(AnimistAccount.getDB().destroy()).finally(done);
         })

      });

   });
   
   //-------------------------------------------------------------------------------------------------
   // selectAccount();
   //-------------------------------------------------------------------------------------------------
   describe('selectAccount(address)', function(){

      it('should set address param as current account address and save this state to the DB', function(done){

         var initial_account, new_account, current_account, saved_account, db;

         AnimistAccount.install('password').then(function(){

            db = AnimistAccount.getDB();
            initial_account = AnimistAccount.listAccounts()[0];

            AnimistAccount.generateAccount();
            new_account = AnimistAccount.listAccounts()[1];

            // Sanity check
            expect(initial_account).not.toEqual(new_account);

            // Check loaded and saved value of address
            AnimistAccount.selectAccount(new_account).then(function(){
               $q.when(db.get(names.DB_ADDRESS))

               .then(function(record){
                  
                  current_account = AnimistAccount.getCurrentAccount();
                  saved_account = record.val;
                  expect(new_account).toEqual(current_account);
                  expect(new_account).toEqual(saved_account);

               }).catch(function(){
                  expect(true).toEqual('Shouldnt reject DB get');

               }).finally(function(){
                  $q.when(AnimistAccount.getDB().destroy()).finally(done);
               })
            })
            .catch(function(){
               expect(true).toEqual('Shouldnt reject on select');
            });
         })   
         .catch(function(){
            expect(true).toEqual('Shouldnt reject installation')
         });

      });

      it('should reject w/ ADDRESS_DNE if address param not found in keystore', function(){
         var promise;

         AnimistAccount.install('password').then(function(){

            promise = AnimistAccount.selectAccount('does_not_exist');   
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(codes.ADDRESS_DNE);
         
         }).catch( function(){
            expect(true).toEqual('Shouldnt reject installation')

         }).finally(function(){
            $q.when(AnimistAccount.getDB().destroy()).finally(done);
         })
      });

      it('should reject w/ BAD_ADDRESS if address param is missing or malformed ', function(){
         var promise, codes = AnimistAccount.getCodes();

         // Not initialized;
         promise = AnimistAccount.selectAccount('dkdklsja;ljke');

         $scope.$digest();
         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value).toEqual(codes.BAD_ADDRESS);

         // Missing param
         promise = AnimistAccount.selectAccount();
         
         $scope.$digest();
         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value).toEqual(codes.BAD_ADDRESS);

         // Non-string param
         promise = AnimistAccount.selectAccount({address: 'kdkdklslsl'});
         
         $scope.$digest();
         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value).toEqual(codes.BAD_ADDRESS);

      });

   });
});