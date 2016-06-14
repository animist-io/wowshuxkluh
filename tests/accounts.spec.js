// Accounts api spec

describe('Accounts Service', function(){


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