describe('Proximity Service', function(){

   describe('enter()', function(){

      it('should authenticate the node that triggered it', function(){
         expect('test written').toBe(true);
      });

      it('should handle authentication failure', function(){
         expect('test written').toBe(true);
      });

      it('should compose an "entrance" event with the correct data', function(){
         expect('test written').toBe(true);
         // triggering node id
         // application id
         // public account key
         // array of contract addresses written by application pertaining to this key
         // time

      });

      it('should post an "entrance" event to the node', function(){
         expect('test written').toBe(true);
      });

      it('should handle post failure', function(){
         expect('test written').toBe(true);
      });
   
   });

   describe('becomeImmediate()', function(){

      it('should authenticate the node that triggered it', function(){
         expect('test written').toBe(true);
      });

      it('should handle authentication failure', function(){
         expect('test written').toBe(true);
      });

      it('should compose an "immediate" event with the correct data', function(){
         expect('test written').toBe(true);
         // triggering node id
         // application id
         // public account key
         // array of contract addresses written by application pertaining to this key
         // time

      });

      it('should post an "immediate" event to the node', function(){
         expect('test written').toBe(true);
      });

      it('should handle post failure', function(){
         expect('test written').toBe(true);
      });
   
   });

   describe('becomeNear()', function(){

      it('should authenticate the node that triggered it', function(){
         expect('test written').toBe(true);
      });

      it('should handle authentication failure', function(){
         expect('test written').toBe(true);
      });

      it('should compose a "near" event with the correct data', function(){
         expect('test written').toBe(true);
         // triggering node id
         // application id
         // public account key
         // array of contract addresses written by application pertaining to this key
         // time

      });

      it('should post a "near" event to the node', function(){
         expect('test written').toBe(true);
      });

      it('should handle post failure', function(){
         expect('test written').toBe(true);
      });
   
   });

   describe('becomeFar()', function(){

      it('should authenticate the node that triggered it', function(){
         expect('test written').toBe(true);
      });

      it('should handle authentication failure', function(){
         expect('test written').toBe(true);
      });

      it('should compose a "far" event with the correct data', function(){
         expect('test written').toBe(true);
         // triggering node id
         // application id
         // public account key
         // array of contract addresses written by application pertaining to this key
         // time

      });

      it('should post a "far" event to the node', function(){
         expect('test written').toBe(true);
      });

      it('should handle post failure', function(){
         expect('test written').toBe(true);
      });
   
   });

   /* Issue: by definition, exiting the range of the node prevents any kind of 
      local authentication. Auth will have to be done by contract stages
      that require a pre-existing entry event and accept a server sourced exit event
      in that context */
   describe('exit()', function(){

      it('should compose an "exit" event with the correct data', function(){
         expect('test written').toBe(true);
         // triggering node id
         // application id
         // public account key
         // array of contract addresses written by application pertaining to this key
         // time

      });

      it('should post an "exit" event to the node', function(){
         expect('test written').toBe(true);
      });

      it('should handle post failure', function(){
         expect('test written').toBe(true);
      });
   });

});