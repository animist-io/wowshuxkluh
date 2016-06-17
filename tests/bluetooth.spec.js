"use strict"
var test_debug;

describe('AnimistBLE Service', function(){

   beforeEach(module('animist'));      // Animist
   beforeEach(module('animistMocks'));  // cordovaBluetoothBLE & cordovaBeacon

   var $scope, $q, $ble, Beacons, AnimistAccount, $timeout;

   beforeEach(inject(function(_$rootScope_, _$q_, _$cordovaBluetoothLE_, _$timeout_, _AnimistBLE_, _AnimistAccount_ ){
     
      $scope = _$rootScope_;
      $ble = _$cordovaBluetoothLE_;
      $q = _$q_;
      $timeout = _$timeout_;
 
      AnimistBLE = _AnimistBLE_; 

      // AnimistAccount Mocks
      AnimistAccount = _AnimistAccount_;
      AnimistAccount.initialized = true;
      AnimistAccount.user = { 
         sign: function(){ return 'message' },
         generateTx: function(tx){ return 'message'} 
      };

   }));

   it('should define constants that expose the services state to the listen() callback', function(){
      
      expect(AnimistBLE.state.PROXIMITY_UNKNOWN).toBe(0);
      expect(AnimistBLE.state.TRANSACTING).toBe(1);
      expect(AnimistBLE.state.NOT_ANIMIST).toBe(3);
      expect(AnimistBLE.state.CONNECTING).toBe(4);
      expect(AnimistBLE.state.COMPLETED).toBe(5);
      expect(AnimistBLE.state.INITIALIZING).toBe(6);
      expect(AnimistBLE.state.BLE_INIT_FAIL).toBe(7);
            
      expect(Object.keys(AnimistBLE.state).length).toBe(7);

   });

   describe('initialize', function(){

      var beaconId, init_params, promise;
      beforeEach(function(){

         beaconId = "4F7C5946-87BB-4C50-8051-D503CEBA2F19";
         init_params = {request: true};
      });

      it('should initialize $cordovaBluetoothLE', function(){

         spyOn(AnimistBLE, 'listen').and.callThrough();
         spyOn($ble, 'initialize').and.callThrough();
         promise = AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();
         $timeout.flush();

         expect($ble.initialize).toHaveBeenCalledWith(init_params);
         expect(promise.$$state.status).toEqual(1);
         expect(promise.$$state.value).toEqual(AnimistBLE.state.INITIALIZING);

      });

      it('should enable subsequent calls to listen() on successful BLE init', function(){

         spyOn(AnimistBLE, 'listen').and.callThrough();
         spyOn(AnimistBLE, 'openLink').and.callThrough();
         spyOn($ble, 'initialize').and.callThrough();

         // Initial call
         AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();
         $timeout.flush();

         // Subsequent call
         promise = AnimistBLE.listen(beaconId, 'proximityNear' );
         expect(promise.$$state.status).toEqual(1);
         expect(promise.$$state.value).toEqual(AnimistBLE.state.CONNECTING);
         
         expect(AnimistBLE.openLink).toHaveBeenCalled();

      });

      it('should disable subsequent calls to listen() on BLE init failure', function(){

         $ble.throwsError = true;
         spyOn(AnimistBLE, 'listen').and.callThrough();
         spyOn(AnimistBLE, 'openLink').and.callThrough();
         spyOn($ble, 'initialize').and.callThrough();

         // Initial call
         promise = AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();
         $timeout.flush()

         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value).toEqual(AnimistBLE.state.BLE_INIT_FAIL);
         

         // Subsequent call
         promise = AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();
         $timeout.flush()
         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value).toEqual(AnimistBLE.state.BLE_INIT_FAIL);
         
         expect(AnimistBLE.openLink).not.toHaveBeenCalled();

      });

   });

   // Listen (iOS): A gate-keeper for a Gatt Server connection to the Animist endpoint 
   // specified by parameter: beacon_uuid. Returns promise.
   describe('listen([beacon_uuid, proximityString ])', function(){

      var beaconId, promise;
      beforeEach(function(){

         beaconId = "4F7C5946-87BB-4C50-8051-D503CEBA2F19";

         // Pre-run initialize()
         spyOn(AnimistBLE, 'listen').and.callThrough();
         AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();
         $timeout.flush()

      });

      it('should verify beacon signal is animist', function(){
         
         // Fail case
         var badId = "jdslkjflkjf";

         promise = AnimistBLE.listen(badId, 'proximityNear' );
         $scope.$digest();

         expect(promise.$$state.status).toBe(2);
         expect(promise.$$state.value).toEqual(AnimistBLE.state.NOT_ANIMIST); 

         // Success case
         promise = AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();

         expect(promise.$$state.status).toBe(1);
         expect(promise.$$state.value).toEqual(AnimistBLE.state.CONNECTING); 

      });
      
      it('should check proximity and reject if unknown', function(){
      
         promise = AnimistBLE.listen(beaconId, 'proximityUnknown' );
         $scope.$digest();

         expect(promise.$$state.status).toBe(2);
         expect(promise.$$state.value).toEqual(AnimistBLE.state.PROXIMITY_UNKNOWN); 
      
      });

      it('should update state to "transacting" when link opens and resolve immediately on subsequent calls', function(){

         // Connecting . . .
         AnimistBLE.listen(beaconId, 'proximityNear');
         $scope.$digest();

         // Transacting . . .
         spyOn(AnimistBLE, 'openLink').and.callThrough();

         promise = AnimistBLE.listen(beaconId, 'proximityNear');
         $scope.$digest();
         expect(promise.$$state.status).toBe(1);
         expect(promise.$$state.value).toEqual(AnimistBLE.state.TRANSACTING);

         expect(AnimistBLE.openLink).not.toHaveBeenCalled();

      });

      it('should resolve immediately if a transaction has already been completed this session', function(){
         expect('test written').toBe(true);
      });

      it('should broadcast "Animist:bleFailure" if link fails', function(){
         expect('test written').toBe(true);
      });

      it('should end the session if link fails because no tx was found', function(){
         expect('test written').toBe(true);
      });

      it('should do a hard reset if link fails for connectivity/technical reasons', function(){
         expect('test written').toBe(true);
      });

   });

   // openLink(): A controller for GATT server connections - either app is attempting 
   // a 'virgin' connection, or it's already cached a tx from a (recent) one and 
   // is attempting to submit it.   
   describe('openLink(beacon_uuid )', function(){

      var service_uuid, ble_address, pin, expected_request, promise;

      beforeEach(function(){

         service_uuid = "4F7C5946-87BB-4C50-8051-D503CEBA2F19";
         ble_address = 'B70DCC59-4B65-C819-1C2C-D32B7FA0369A'; // From mocks: scanResult
         pin = "iciIKTtuadkwlzF3v3CElZNoXfLW5H0p"; // From mocks: pinResult

         AnimistBLE.initialize();

         spyOn(AnimistBLE, 'scan').and.callThrough();
         spyOn(AnimistBLE, 'connectAndDiscover').and.callThrough();
         spyOn(AnimistBLE, 'readPin').and.callThrough();
         spyOn(AnimistBLE, 'subscribeHasTx').and.callThrough();

      });

      // ----------------------------------
      // Case: Initial connection sequence
      // ----------------------------------

      it('should initiate endpoint connection & retrieve a tx if no tx is cached', function(){
         
         AnimistBLE.peripheral = {};
         $ble.emulateHasTx = true;

         promise = AnimistBLE.openLink(service_uuid, 'proximityNear');
         $timeout.flush();

         expect(AnimistBLE.scan).toHaveBeenCalledWith(service_uuid);
         expect(AnimistBLE.connectAndDiscover).toHaveBeenCalledWith(ble_address);
         expect(AnimistBLE.readPin).toHaveBeenCalled();
         expect(AnimistBLE.subscribeHasTx).toHaveBeenCalled();

         expect(AnimistBLE.peripheral.address).toEqual(ble_address);
         expect(AnimistBLE.peripheral.service).toEqual(service_uuid);
         expect(AnimistBLE.peripheral.tx).toEqual($ble.mockHasTxResult);
         expect(AnimistBLE.pin).toEqual(pin);

      });

      // Hard coded Animist characteristic uuid checks . . . .
      it('should readPin from characteristic: "C40C94B3-D9FF-45A0-9A37-032D72E423A9"', function(){

         AnimistBLE.peripheral = {};
         $ble.emulateHasTx = true;

         expected_request = {
            address: ble_address,
            service: service_uuid,
            characteristic: "C40C94B3-D9FF-45A0-9A37-032D72E423A9",
            timeout: 5000
         };

         spyOn($ble, 'read').and.callThrough();

         promise = AnimistBLE.openLink(service_uuid, 'proximityNear');
         $timeout.flush();

         expect($ble.read).toHaveBeenCalledWith(expected_request);

      });

      it('should subscribeHasTx to characteristic: "BFA15C55-ED8F-47B4-BD6A-31280E98C7BA"', function(){

         AnimistBLE.peripheral = {};
         $ble.emulateHasTx = true;

         expected_request = {
            address: ble_address,
            service: service_uuid,
            characteristic: "BFA15C55-ED8F-47B4-BD6A-31280E98C7BA",
            timeout: 5000,
            value : 'Im1lc3NhZ2Ui'
         };

         spyOn($ble, 'subscribe').and.callThrough();

         promise = AnimistBLE.openLink(service_uuid, 'proximityNear');
         $timeout.flush();

         expect($ble.subscribe).toHaveBeenCalledWith(expected_request);
      
      });


      it('should broadcast "Animist:receivedTx" when tx transmission completes', function(){

         AnimistBLE.peripheral = {};
         $ble.emulateHasTx = true;
         spyOn($scope, '$broadcast');

         promise = AnimistBLE.openLink(service_uuid, 'proximityNear');
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:receivedTx');
      });


      it('should have some tests about handling the receivedTx event', function(){
         expect('test written').toBe(true);
      });


      // -------------------------------------------
      // Case: Reconnection Attempts w/ a cached tx
      // -------------------------------------------

      it('should check cached txs for staleness and reset/resolve when old', function(){

         AnimistBLE.peripheral = {
            address: ble_address,
            service: service_uuid,
            tx: JSON.parse($ble.mockHasTxResult)
         };

         AnimistBLE.peripheral.tx.expires = (Date.now() - 10000000);
         spyOn(AnimistBLE, 'reset');

         promise = AnimistBLE.openLink(service_uuid );
         $scope.$digest();

         expect(promise.$$state.status).toEqual(1);
         expect(AnimistBLE.reset).toHaveBeenCalled();

      });

      it('should check cur. proximity against cached requirement & resolve if too far away)', function(){

         AnimistBLE.peripheral = {
            address: ble_address,
            service: service_uuid,
            tx: JSON.parse($ble.mockHasTxResult)
         };

         spyOn(AnimistBLE, 'connect').and.callThrough();
         AnimistBLE.peripheral.tx.expires = (Date.now() + 10000000);
         AnimistBLE.peripheral.tx.proximity = 'proximityNear';

         // Should fail: Far not near enough
         AnimistBLE.proximity = 'proximityFar';
         
         promise = AnimistBLE.openLink(service_uuid);
         $scope.$digest();

         expect(promise.$$state.status).toEqual(1);
         expect(AnimistBLE.connect).not.toHaveBeenCalled();

      });

      it('should connect and submitTx if cur. proximity meets cached tx requirements', function(){

         AnimistBLE.peripheral = {
            address: ble_address,
            service: service_uuid,
            tx: JSON.parse($ble.mockHasTxResult)
         };

         spyOn(AnimistBLE, 'connect').and.callThrough();
         spyOn(AnimistBLE, 'submitTx');

         AnimistBLE.peripheral.tx.expires = (Date.now() + 10000000);
         AnimistBLE.peripheral.tx.proximity = 'proximityNear';

         // Should succeed: Immediate closer than near
         AnimistBLE.proximity = 'proximityImmediate';
         promise = AnimistBLE.openLink(service_uuid);
         $scope.$digest();
         $timeout.flush();

         expect(AnimistBLE.connect).toHaveBeenCalledWith(AnimistBLE.peripheral.address);
         expect(AnimistBLE.submitTx).toHaveBeenCalledWith(AnimistBLE.peripheral.tx);

      });

      // ----------------------------
      // Error state tests
      // ----------------------------

      it('should reject on scan error', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsScan = true;

         promise = AnimistBLE.openLink(service_uuid);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);     

      });

      it('should reject on connect error', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsConnect = true;

         promise = AnimistBLE.openLink(service_uuid);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);     

      });

      it('should reject on discover error', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsDiscover = true;

         promise = AnimistBLE.openLink(service_uuid);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);   
      });


      it('should reject on read error', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsRead = true;

         promise = AnimistBLE.openLink(service_uuid);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);   
      
      });

      it('should reject on subscription error', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsSubscribe = true;

         promise = AnimistBLE.openLink(service_uuid);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);

      });

      it('should reject on write error', function(){


         AnimistBLE.peripheral = {};
         $ble.throwsWrite = true;
         $ble.emulateHasTx = true;

         promise = AnimistBLE.openLink(service_uuid);   
         $scope.$digest();  
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);
      });


      it('should reject w/ NO_TX_FOUND if peripheral cannot find tx', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsNOTX = true;
         $ble.emulateHasTx = true;

         promise = AnimistBLE.openLink(service_uuid);
         $scope.$digest();    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value.error).toEqual('NO_TX_FOUND');

      });

   });

   // submittx 
   //describe('')


   






      /*it('should reject on BLE connection attempt failure w/ message', function(){
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
      });*/

   //});

   /*

   // hasTx() Queries current endpoint to see if there are tx's about this event and
   // returns them to client. Tx's can require additional confirmations - for example
   // they might need to be signed by an application account and be passed to a 
   // a remote server for that purpose, or they might require a certain proximity reading.
   describe('hasTx()', function(){

      it('should subscribe to the txVerify characteristic', function(){
         expect('test written').toBe(true);
      });

      it('should reject if subscription fails or device disconnects w/message', function(){
         expect('test written').toBe(true);
      });

      it('should parse the subscription feed into an array of {requirements, tx} and resolve it', function(){
         expect('test written').toBe(true);
      });

      it('should resolve false if no tx data was found', function(){
         expect('test written').toBe(true);
      });

      it('should close the connection', function(){

      });
   });


   // authTx(): Sends a signed transaction to the endpoint
   describe('authTx()', function(){

      it('should subscribe to the authTx characteristic', function(){
         expect('test written').toBe(true);
      });

      it('should reject on subscription technical failure w/ message', function(){
         expect('test written').toBe(true);
      });

      it('should write the signed tx to the signedTx characteristic', function(){
         expect('test written').toBe(true);
      });

      it('should reject on signedTx writes technical failure w/ message', function(){
         expect('test written').toBe(true);
      });

      it('should receive/resolve the transaction hash', function(){
         expect('test written').toBe(true);
      });

      it('should reject if auth transaction hash is 0 or connection times out', function(){
         expect('test written').toBe(true);
      });

      it('should close the connection', function(){
         expect('test written').toBe(true);
      });


   });

   // Used in cases where the tx will be signed and remotely by an application server
   // that maintains its own keys and access to an ethereum node. The hex hash of
   // the auth transaction is returned so that the remote server can wait for it to 
   // confirm on the chain before advancing the contract state. 
   describe('authPresence()', function(){
      
      it('should subscribe to the authPresence characteristic', function(){
         expect('test written').toBe(true);
      });

      it('should reject on subscription technical failure w/ message', function(){
         expect('test written').toBe(true);
      });

      it('should write the authentication signal to the authPresence characteristic', function(){
         expect('test written').toBe(true);
      });

      it('should reject on signedAuth writes technical failure w/ message', function(){
         expect('test written').toBe(true);
      });

      it('should receive/resolve the auth transaction hash', function(){
         expect('test written').toBe(true);
      });

      it('should reject if auth transaction hash is 0 or connection times out', function(){
         expect('test written').toBe(true);
      });

      it('should close the connection', function(){
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
   });*/

});