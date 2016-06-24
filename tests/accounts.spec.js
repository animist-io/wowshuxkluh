var debug_1, debug_2;

// Gnarly: Promises are non-angular so expectations have to be put
// in blocks you don't intend to run to catch test failures. Cannot use angular mocks. 
// Database has to be explicitly destroyed after each test because it will persist
// if chrome is running live-reload. 

describe('AnimistAccounts Service', function(){

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
               // to saved address. Install works, QED. 
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

      it('should set installed flag to true on success', function(done){

         var password = 'Xdkklwlwmmmm';

         AnimistAccount.install(password).then( function(){

               expect(AnimistAccount.installed).toBe(true);
         
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

   describe('load()', function(){

      it('should load keystore, currentAddress, password and derive the wallet key', function(done){

         var msg, current_address, signing_address, expected_address, signed, wallet;

         AnimistAccount.install('secret').then(function(){

            // Setup: remember address then erase everything.
            expected_address = AnimistAccount.getCurrentAddress();
            wallet = lightwallet.signing;
            msg = 'should work';

            AnimistAccount.clearPrivate();

            // Show everything loaded & address persisted by signing and recovering, 
            AnimistAccount.load().then(function(){

               // This signs w/ current address by default
               signed = AnimistAccount.sign(msg);
            
               signing_address = wallet.recoverAddress(msg, signed.v, signed.r, signed.s);
               current_address = AnimistAccount.getCurrentAddress();

               expect(signing_address.toString('hex')).toEqual(expected_address);
               expect(current_address).toEqual(expected_address);

            }, function(){
               expect(true).toEqual('Shouldnt reject');
            
            }).finally(function(){
                  $q.when(AnimistAccount.getDB().destroy()).finally(done);
            });
         })

      });

      it('should reject with "BAD KEY" if derived key is incorrect', function(){

         var kc, codes;
         codes = AnimistAccount.getCodes();

         AnimistAccount.install('secret').then(function(){

            // Corrupt users password . . .
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

         promise = AnimistAccount.load();
         $scope.$digest();

         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value).toEqual(codes.NOT_INSTALLED);

      })
   })

   describe('listAccounts()', function(){

      it('should return an array of available accounts', function(){
         expect('test written').toBe(true);
      });

   });

   describe('getCurrentAddress()', function(){

      it('should return false if no account has been selected', function(){
         expect('test written').toBe(true);
      });

      it('should return the address of the currently selected account', function(){
         expect('test written').toBe(true);
      });
   });

   describe('selectAddress(address)', function(){

      it('should verify that address has been created in lightwallet', function(){
         expect('test written').toBe(true);
      });

      it('should set the address as the default to sign transactions with', function(){
         expect('test written').toBe(true);
      });

   });
});