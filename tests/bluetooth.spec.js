describe('Bluetooth Service', function(){

   it('should define some constants for the events it publishes', function(){
      expect('test written').toBe(true);
   
   });

   // endpoints: returns a list of valid enpoint uuids
   describe('endpoints', function(){

      it('should return a list of valid animist endpoint ids from (?)', function(){
         expect('test written').toBe(true);
      });

      it('should verify that these values are correctly formatted', function(){
         expect('test written').toBe(true);
      });

   });

   // Listen (iOS): Initializes app to hear animist endpoint beacon signals & connect via BLE Returns promise
   describe('listen([uuid, . . . (optional)])', function(){

      it('should validate passed argument as an array of correctly formatted uuids', function(){
         expect('test written').toBe(true);
      });
      
      it('should reject w/ error message if argument is invalid', function(){
         expect('test written').toBe(true);
      });

      it('should ask CB to listen for a discrete set of uuids if an array is passed to it', function(){
         expect('test written').toBe(true);
      });

      it('should listen for the full set of default endpoints if called without argument', function(){
         expect('test written').toBe(true);
      });

      it('should check to see if BLE is enabled and initialize if necessary', function(){
         expect('test written').toBe(true);
      });

      it('should reject on BLE initialization failure w/ message', function(){
         expect('test written').toBe(true);
      });

      it('should reject on iBeacon requestAuthorization failure w/ message', function(){
         expect('test written').toBe(true);
      });

   });

   // authenticate()   (For iOS) Client passes signed beacon signal to endpoint and gets conf.
   // message if address parses correctly.
   describe('authenticate(node)', function(){

      it('should open a BLE connection to the node at service "beaconUuid + 1', function(){
         expect('test written').toBe(true);
      });

      it('should reject on BLE connection attempt failure w/ message', function(){
         expect('test written').toBe(true);
      });

      it('should sign & write the beacon uuid to the peripheral auth characteristic', function(){
         expect('test written').toBe(true);
      });

      it('should write its proximity to the proximity characteristic', function(){
         expect('test written').toBe(true);
      });

      it('should reject on write characteristic failure', function(){
         expect('test written').toBe(true);
      });

   });

   // hasTx() Queries current endpoint to see if there are tx's about this event and
   // returns them to client. Tx's can require additional confirmations.
   describe('hasTx()', function(){

      it('should subscribe to the txVerify characteristic', function(){
         expect('test written').toBe(true);
      });

      it('should reject if subscription fails or device disconnects w/message', function(){
         expect('test written').toBe(true);
      });

      it('should resolve w/ array of txs if endpoint finds txs in log data', function(){
         expect('test written').toBe(true);
      });

      it('should resolve false if no tx data was found', function(){
         expect('test written').toBe(true);
      });

   });

   // A second layer of authentication in which an app with an api key enumerated in the
   // contract requests confirmation of location by passing Google GeoLocation data to 
   // the endpoint. Endpoint needs to pull the contract to get the public api key. 
   describe('authGeo(tx)', function(){

      it('should write {tx, lat, lng} geoData to rawGeo characteristic', function(){
         expect('test written').toBe(true);
      });

      it('should *then* write signed geoData to signedGeo characteristic', function(){
         expect('test written').toBe(true);
      });

      it('should resolve if the endpoint accepts the data', function(){
         expect('test written').toBe(true);
      });

      it('should reject on raw/signed Geo writes technical failure w/ message', function(){
         expect('test written').toBe(true);
      });

      it('should reject on signed Geo write substantive failure w/ message', function(){
         expect('test written').toBe(true);
      });

   });

   describe('close()', function(){

      it('should close the connection to the endpoint', function(){
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

   // Remote server confirmations/failures . . . . 
   describe('AnimistCentral:txSuccess (Event)', function(){

      it('should fire on successful blockchain writes from the node', function(){
         expect('test written').toBe(true);
      });

      it('should pass data about the success to the broadcast', function(){
         expect('test written').toBe(true);
      });

   });

   describe('AnimistCentral:txStatus (Event)', function(){

      it('should fire on transaction status update from the node', function(){
         expect('test written').toBe(true);
      });

      it('should pass data about the status to the broadcast', function(){
         expect('test written').toBe(true);
      });
   });

   describe('AnimistCentral:txFailure (Event)', function(){

      it('should fire on transaction failure msg from the node', function(){
         expect('test written').toBe(true);
      });

      it('should pass data about the failure to the broadcast', function(){
         expect('test written').toBe(true);
      });
   });

});