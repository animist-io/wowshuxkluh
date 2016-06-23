// Accounts api spec
var debug;

describe('AnimistAccounts Service', function(){

   var $scope, $q, $cordovaKeychain, $timeout, $window, pouchDB, AnimistAccount, names;

   beforeEach(function(){
      var $injector = angular.injector(['ng', 'ngCordovaMocks', 'animist']);

      $scope = $injector.get('$rootScope');
      $q = $injector.get('$q');
      $timeout = $injector.get('$timeout');
      $cordovaKeychain = $injector.get('$cordovaKeychain');

      AnimistAccount = $injector.get('AnimistAccount');
      names = AnimistAccount.getNames();
   });

   describe('isInstalled', function(){

      it('should return true if keychain has key and DB has keystore', function(done){

         var promise, db, expected = 'abcd';
      
         // Setup: Good db, good key
         db = new PouchDB(names.DB, {adapter: "websql"});
         $q.when(db.put({'_id': names.DB_KEYSTORE, 'val': 'someVal'}));
         $cordovaKeychain.setForKey(names.KEY_USER, names.KEY_SERVICE, expected);
         $scope.$digest();

         // Should succeed
         AnimistAccount.isInstalled().then(
         
            function(val){ expect(val).toBe(true) },
            function(val){ expect(true).toBe(false)}
         
         ).finally(done);
         $scope.$digest();

      });

      it('should return false if keychain is missing users key', function(done){

         var promise, db, expected = 'abcd';
      
         // Setup: Good db, bad key.
         db = new PouchDB(names.DB, {adapter: "websql"});
         $q.when(db.put({'_id': names.DB_KEYSTORE, 'val': 'someVal'}));
         $cordovaKeychain.setForKey('bad_name', 'bad_service', expected);
         $scope.$digest();

         // Should error
         AnimistAccount.isInstalled().then(
         
            function(val){ expect(true).toBe(false) },
            function(val){ expect(val).toBe(false)}
         
         ).finally(done);
         $scope.$digest();

      })

      it('should return false if DB is missing keystore', function(done){

         var promise, db, expected = 'abcd';
      
         // Setup: Bad db, good key.
         db = new PouchDB(names.DB, {adapter: "websql"});
         $cordovaKeychain.setForKey('bad_name', 'bad_service', expected);
         $scope.$digest();

         // Should error
         AnimistAccount.isInstalled().then(
         
            function(val){ expect(true).toBe(false) },
            function(val){ expect(val).toBe(false)}
         
         ).finally(done);
         $scope.$digest();

      });
   });

   describe('createKeystore( string id, string password )', function(){

      it('should validate the params and reject on error', function(){
         expect('test written').toBe(true);
      });

      it('should create a keystore if none exists in the DB', function(){
         expect('test written').toBe(true);
      });

      it('should reject w/ message if Keystore exists', function(){
         expect('test written').toBe(true);
      });

      it('should add the pwDerived key to iOS Keychain or Android encrypted storage', function(){
         expect('test written').toBe(true);
      });

   });

   describe('getKey( string id )', function(){

      it('should return the pwDerived key for the user keystore or null on failure', function(){
         expect('test written').toBe(true);
      });

   });

   describe('createUserAccount( string key )', function(){

      it('should create an account in the user keystore', function(){
         expect('test written').toBe(true);
      });

      it('should return the address of the new account', function(){
         expect('test written').toBe(true);
      });

      it('should return null on failure', function(){
         expect('test written').toBe(true);
      });
      
   });

   describe('initUserDb( string remote (optional) )', function(){

      it('should reject with a message if there is an existing userDB', function(){
         expect('test written').toBe(true);
      });

      it('should create a local PouchDB if no remote is specified and return its ref', function(){
         expect('test written').toBe(true);
      });

      it('should reject if creating a localDB fails', function(){
         expect('test written').toBe(true);
      });

      it('should create a synched DB if remote is specified and return its ref', function(){
         expect('test written').toBe(true);
      });

      it('should reject with message if creating a synched DB fails', function(){
         expect('test written').toBe(true);
      });

   });

   describe('deleteDB( string remote (optional))', function(){

      it('should delete the DB', function(){
         expect('test written').toBe(true);
      });
   });

   describe('saveUser( keystore )', function(){

      it('should reject if no userDB has been initialized', function(){
         expect('test written').toBe(true);
      });

      it('should save the serialized keystore in the DB', function(){
         expect('test written').toBe(true);
      });    

   });

   describe('listAccounts()', function(){

      it('should return an array of available accounts', function(){
         expect('test written').toBe(true);
      });

   });


   describe('exportPrivateKey( address )', function(){

      it('should return the private key associated with param: address', function(){
         expect('test written').toBe(true);
      });
   
   });

   describe('current()', function(){

      it('should return false if no account has been selected', function(){
         expect('test written').toBe(true);
      });

      it('should return the address of the currently selected account', function(){
         expect('test written').toBe(true);
      });
   });

   describe('select(address)', function(){

      it('should verify that address has been created in lightwallet', function(){
         expect('test written').toBe(true);
      });

      it('should set the address as the default to sign transactions with', function(){
         expect('test written').toBe(true);
      });

   });
});