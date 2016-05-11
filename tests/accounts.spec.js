// Accounts api spec

describe('Accounts Service', function(){

   describe('create( password )', function(){

      it('should create an account in the lightwallet', function(){
         expect('test written').toBe(true);
      });

   });

   describe('list()', function(){

      it('should return an array of available accounts', function(){
         expect('test written').toBe(true);
      });

   });

   describe('export( address )', function(){

      it('should return the private key associated with param: address', function(){
         expect('test written').toBe(true);
      });
   
   });

   describe('fund( source, amount )', function(){

      it('should transfer "amount" from "source" to currently selected account', function(){
         expect('test written').toBe(true);
      });
   })

   describe('transfer( target, amount', function(){

      it('should transfer "amount" from currently selected account to "target"', function(){
         expect('test written').toBe(true);
      });
   });

   describe('liquidate( target )', function(){

      it('should transfer the entire balance of selected account to "target"', function(){
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

      it('should return false if an account is already set', function(){
         expect('test written').toBe(true);
      });

      it('should verify that address has been created in lightwallet', function(){
         expect('test written').toBe(true);
      });

      it('should set the address as the default to sign transactions with', function(){
         expect('test written').toBe(true);
      });

   });

   describe('unselect()', function(){

      it('should return false if no account is set', function(){
         expect('test written').toBe(true);
      });

      it('should null out the default transaction signing variable', function(){
         expect('test written').toBe(true);
      });

      it('should return the most recent selected account address', function(){
         expect('test written').toBe(true);
      });

   });
});