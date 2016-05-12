describe('Bluetooth Service', function(){

   it('should define some constants for the events it publishes', function(){
      expect('test written').toBe(true);
      // UNFUNDED
      // PENDING
      // POSTED
      // POSTFAILURE

   });

   describe('findNode(uuid, major, minor)', function(){

      it('should return the means to connect to specified node from a server', function(){
         expect('test written').toBe(true);
      });

      it('should handle server connection failure', function(){
         expect('test written').toBe(true);
      });

      it('should handle lookup failure', function(){
         expect('test written').toBe(true);
      })
   });

   describe('connect(node)', function(){

      it('should open a serialized bluetooth connection to the "node"', function(){
         expect('test written').toBe(true);
      });

      it('should set a public flag indicating its connected', function(){
         expect('test written').toBe(true);
      });

      it('it should handle connection failure', function(){
         expect('test written').toBe(true);
      });

   });

   describe('disconnect()', function(){

      it('should close the bluetooth connection to the current node', function(){
         expect('test written').toBe(true);
      });

      it('should set a public flag indicating its disconnected', function(){
         expect('test written').toBe(true);
      });

      it('it should handle disconnection errors', function(){
         expect('test written').toBe(true);
      });

   });

   describe('transmit( packet )', function(){

      it('should verify that device is connected to a node', function(){
         expect('test written').toBe(true);
      });

      it('should handle non-connection error state', function(){
         expect('test written').toBe(true);
      });

      it('should pass the packet to the node', function(){
         expect('test written').toBe(true);
      });

   });

   // Events
   describe('AnimistBluetooth:connect (Event)', function(){

      it('should fire on connection to the node', function(){
         expect('test written').toBe(true);
      });
   });

   describe('AnimistBluetooth:disconnect (Event)', function(){

      it('should fire on disconnection from the node', function(){
         expect('test written').toBe(true);
      });
   });

   describe('AnimistBluetooth:txSuccess (Event)', function(){

      it('should fire on successful blockchain writes from the node', function(){
         expect('test written').toBe(true);
      });

      it('should pass data about the success to the broadcast', function(){
         expect('test written').toBe(true);
      });

   });

   describe('AnimistBluetooth:txStatus (Event)', function(){

      it('should fire on transaction status update from the node', function(){
         expect('test written').toBe(true);
      });

      it('should pass data about the status to the broadcast', function(){
         expect('test written').toBe(true);
      });
   });

   describe('AnimistBluetooth:txFailure (Event)', function(){

      it('should fire on transaction failure msg from the node', function(){
         expect('test written').toBe(true);
      });

      it('should pass data about the failure to the broadcast', function(){
         expect('test written').toBe(true);
      });
   });

});