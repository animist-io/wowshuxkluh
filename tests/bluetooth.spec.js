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
         address: '123',
         remoteAuthority: '567',
         sign: function(){ return 'message' },
         generateTx: function(tx){ return 'message'} 
      };

   }));

   // Public constants
   it('should define constants that expose the services state to the listen() callback', function(){
      
      expect(AnimistBLE.stateMap.PROXIMITY_UNKNOWN).toBe(0);
      expect(AnimistBLE.stateMap.TRANSACTING).toBe(1);
      expect(AnimistBLE.stateMap.NOT_ANIMIST).toBe(3);
      expect(AnimistBLE.stateMap.CACHED).toBe(4);
      expect(AnimistBLE.stateMap.COMPLETED).toBe(5);
      expect(AnimistBLE.stateMap.NOT_INITIALIZED).toBe(6);
      expect(AnimistBLE.stateMap.INITIALIZED).toBe(7);
            
      expect(Object.keys(AnimistBLE.stateMap).length).toBe(7);

   });


   // Initialization: 
   describe('initialize', function(){

      var beaconId, init_params, promise;
      beforeEach(function(){

         beaconId = "4F7C5946-87BB-4C50-8051-D503CEBA2F19";
         init_params = {request: true};
      });

      it('should initialize $cordovaBluetoothLE', function(){

         /*spyOn(AnimistBLE, 'listen').and.callThrough();
         spyOn($ble, 'initialize').and.callThrough();
         promise = AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();
         $timeout.flush();*/

         spyOn($ble, 'initialize').and.callThrough();
         promise = AnimistBLE.initialize();
         $scope.$digest();
         $timeout.flush();
         //$scope.$digest();
   
         expect($ble.initialize).toHaveBeenCalledWith(init_params);
         expect(promise.$$state.status).toEqual(1);
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.INITIALIZED);

      });

      it('should enable subsequent calls to listen() on successful BLE init', function(){

         spyOn(AnimistBLE, 'initialize').and.callThrough();
         spyOn(AnimistBLE, 'listen').and.callThrough();
         spyOn(AnimistBLE, 'openLink').and.callThrough();
         spyOn($ble, 'initialize').and.callThrough();

         // Initial call
         AnimistBLE.initialize();
         AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();
         $timeout.flush();

         // Subsequent call
         promise = AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();
         expect(promise.$$state.status).toEqual(1);
         expect(promise.$$state.value).toEqual(AnimistBLE.stateMap.TRANSACTING);
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.TRANSACTING);
         
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
   
         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value).toEqual(AnimistBLE.stateMap.NOT_INITIALIZED);
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.NOT_INITIALIZED);

         // Subsequent call
         promise = AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();

         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value).toEqual(AnimistBLE.stateMap.NOT_INITIALIZED);
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.NOT_INITIALIZED);

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
         spyOn(AnimistBLE, 'initialize').and.callThrough();
         spyOn(AnimistBLE, 'listen').and.callThrough();
         AnimistBLE.initialize();
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
         expect(promise.$$state.value).toEqual(AnimistBLE.stateMap.NOT_ANIMIST); 

         // Success case
         AnimistBLE.state = AnimistBLE.stateMap.INITIALIZED;
         promise = AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();

         expect(promise.$$state.status).toBe(1);
         expect(promise.$$state.value).toEqual(AnimistBLE.stateMap.TRANSACTING); 

      });
      
      it('should check proximity and reject if unknown', function(){
      
         promise = AnimistBLE.listen(beaconId, 'proximityUnknown' );
         $scope.$digest();

         expect(promise.$$state.status).toBe(2);
         expect(promise.$$state.value).toEqual(AnimistBLE.stateMap.PROXIMITY_UNKNOWN); 
      
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
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.TRANSACTING);

         expect(AnimistBLE.openLink).not.toHaveBeenCalled();

      });

      it('should resolve immediately if a transaction has already been completed this session', function(){
         
         expect('test written').toBe(true);

      });

      it('should broadcast "Animist:bleFailure" if link fails and do a hard reset', function(){

         var expected_error = { where : 'AnimistBLE:scan: ', error : { error : 'failed' } }
         
         // Trigger error
         $ble.throwsScan = true;

         spyOn($scope, '$broadcast');
         spyOn(AnimistBLE, 'reset');

         AnimistBLE.listen(beaconId, 'proximityNear');
         $scope.$digest();
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:bleFailure', expected_error );
         expect(AnimistBLE.reset).toHaveBeenCalled();
         
      });

      it('should broadcast "Animist:noTxFound" if no tx is found and end the session', function(){

         var expected_error = { where : 'AnimistBLE:subscribeHasTx: ', error : 'NO_TX_FOUND' };

         // Trigger error
         $ble.throwsNOTX = true;
         $ble.emulateHasTx = true;

         spyOn($scope, '$broadcast');
         spyOn(AnimistBLE, 'endSession');

         AnimistBLE.listen(beaconId, 'proximityNear');
         $scope.$digest();
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:noTxFound', expected_error);
         expect(AnimistBLE.endSession).toHaveBeenCalled();
      });


   });

   // openLink(): A controller for GATT server connections - either app is attempting 
   // a 'virgin' connection, or it's already cached a tx from a (recent) connection and 
   // is attempting to submit it.   
   describe('openLink(beacon_uuid )', function(){

      var beacon_id, service_uuid, ble_address, pin, expected_request, promise;

      beforeEach(function(){

         beacon_id = '4F7C5946-87BB-4C50-8051-D503CEBA2F19';
         service_uuid = "05DEE885-E723-438F-B733-409E4DBFA694";
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

         promise = AnimistBLE.openLink(beacon_id, 'proximityNear');
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

         promise = AnimistBLE.openLink(beacon_id, 'proximityNear');
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

         promise = AnimistBLE.openLink(beacon_id, 'proximityNear');
         $timeout.flush();

         expect($ble.subscribe).toHaveBeenCalledWith(expected_request);
      
      });


      it('should broadcast "Animist:receivedTx" when tx transmission completes', function(){

         AnimistBLE.peripheral = {};
         $ble.emulateHasTx = true;
         spyOn($scope, '$broadcast');

         promise = AnimistBLE.openLink(beacon_id);
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

      it('should resolve if cur. proximity wrong and listen loop should continue to cycle', function(){

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
         
         promise = AnimistBLE.openLink(beacon_id);
         $scope.$digest();

         expect(promise.$$state.status).not.toEqual(2); // Shouldn't reject
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.CACHED);
         expect(AnimistBLE.connect).not.toHaveBeenCalled();

         // Should succeed: This proves that loop is still open after the kickback.
         AnimistBLE.proximity = 'proximityNear';
         promise = AnimistBLE.openLink(beacon_id);
         $scope.$digest();

         expect(AnimistBLE.connect).toHaveBeenCalled()
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.TRANSACTING);

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
         promise = AnimistBLE.openLink(beacon_id);
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

         promise = AnimistBLE.openLink(beacon_id);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);     

      });

      it('should reject on connect error', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsConnect = true;

         promise = AnimistBLE.openLink(beacon_id);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);     

      });

      it('should reject on discover error', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsDiscover = true;

         promise = AnimistBLE.openLink(beacon_id);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);   
      });


      it('should reject on read error', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsRead = true;

         promise = AnimistBLE.openLink(beacon_id);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);   
      
      });

      it('should reject on subscription error', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsSubscribe = true;

         promise = AnimistBLE.openLink(beacon_id);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);

      });

      it('should reject on write error', function(){


         AnimistBLE.peripheral = {};
         $ble.throwsWrite = true;
         $ble.emulateHasTx = true;

         promise = AnimistBLE.openLink(beacon_id);   
         $scope.$digest();  
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);
      });


      it('should reject w/ NO_TX_FOUND if peripheral cannot find tx', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsNOTX = true;
         $ble.emulateHasTx = true;

         promise = AnimistBLE.openLink(beacon_id);
         $scope.$digest();    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value.error).toEqual('NO_TX_FOUND');

      });

   });

   // submitTx(tx): A controller that manages final transaction writes and auth requests to 
   // the endpoint and wraps the session up on success/failure.
   describe('submitTx(tx)', function(){
      var beacon_id, service_uuid, ble_address, pin, expected_request, promise;

      beforeEach(function(){

         beacon_id = "4F7C5946-87BB-4C50-8051-D503CEBA2F19";
         service_uuid = "05DEE885-E723-438F-B733-409E4DBFA694";
         ble_address = 'B70DCC59-4B65-C819-1C2C-D32B7FA0369A'; // From mocks: scanResult
         pin = "iciIKTtuadkwlzF3v3CElZNoXfLW5H0p"; // From mocks: pinResult

         AnimistBLE.initialize();

         spyOn(AnimistBLE, 'connect').and.callThrough();
         spyOn(AnimistBLE, 'submitTx').and.callThrough();
         spyOn(AnimistBLE, 'writeTx').and.callThrough();
         spyOn(AnimistBLE, 'endSession');
         spyOn($scope, '$broadcast');

         AnimistBLE.peripheral = {
            address: ble_address,
            service: service_uuid,
            tx: JSON.parse($ble.mockHasTxResult)
         };

         AnimistBLE.peripheral.tx.expires = (Date.now() + 10000000);
         AnimistBLE.peripheral.tx.proximity = 'proximityNear';
         AnimistBLE.proximity = 'proximityNear';

      });

      // ----------------------------------
      // Case: User signs their own tx
      // ----------------------------------

      it('should sign/write a tx to "3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06" if user has authority', function(){
         
         var expected_out = {
            id: AnimistBLE.peripheral.tx.sessionId,
            tx: AnimistAccount.user.generateTx(AnimistBLE.peripheral.tx)
         };

         // Hard coded signTx characteristic uuid
         var signedTx_port_addr = '3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06'

         // User has authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.address;

         promise = AnimistBLE.openLink(beacon_id);
         $scope.$digest();
         $timeout.flush();

         expect(AnimistBLE.writeTx).toHaveBeenCalledWith(expected_out, signedTx_port_addr)

      });

      it('should broadcast success & txHash data if user write is ok and then end session', function(){

         var expected_hash = {txHash: $ble.mockWriteTxResult}

         // User has authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.address;
         $ble.emulateWriteTx = true;

         promise = AnimistBLE.openLink(beacon_id);
         $scope.$digest();
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:signedTxSuccess', expected_hash);
         expect(AnimistBLE.endSession).toHaveBeenCalled();

      });

      it('should broadcast failure if user write fails and then end session', function(){

         var expected_error = { 
            error : { 
               where : 'AnimistBLE:writeTx: ', 
               error : { 
                  error : 'failed' 
               } 
            }
         }

         // User has authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.address;
         $ble.emulateWriteTx = true;
         $ble.throwsSubscribe = true;

         promise = AnimistBLE.openLink(beacon_id);
         $scope.$digest();
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:signedTxFailure', expected_error);
         expect(AnimistBLE.endSession).toHaveBeenCalled();
      });

      // -----------------------------------------------------------------------------------------------
      // Case: Another authority will sign tx elsewhere. Only asking endpoint to confirm user was here.
      // -----------------------------------------------------------------------------------------------

      it('should sign/send pin to "297E3B0A-F353-4531-9D44-3686CC8C4036" if only requesting oracle auth.', function(){
         
         var expected_out = {
            id: AnimistBLE.peripheral.tx.sessionId,
            pin: AnimistAccount.user.sign(AnimistBLE.pin)
         };

         // Hard coded signTx characteristic uuid
         var authTx_port_addr = '297E3B0A-F353-4531-9D44-3686CC8C4036'

         // User has authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;

         promise = AnimistBLE.openLink(beacon_id);
         $scope.$digest();
         $timeout.flush();

         expect(AnimistBLE.writeTx).toHaveBeenCalledWith(expected_out, authTx_port_addr)

      });

      it('should broadcast success & txHash data if oracle auth write is ok and then end session', function(){

         var expected_hash = {txHash: $ble.mockWriteTxResult}

         // Someone else has authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;
         $ble.emulateWriteTx = true;

         promise = AnimistBLE.openLink(beacon_id);
         $scope.$digest();
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:authTxSuccess', expected_hash);
         expect(AnimistBLE.endSession).toHaveBeenCalled();

      });

      it('should broadcast failure if oracle auth write fails and then end session', function(){

         var expected_error = { 
            error : { 
               where : 'AnimistBLE:writeTx: ', 
               error : { 
                  error : 'failed' 
               } 
            }
         }

         // Someone else has authority / subscription fails
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;
         $ble.emulateWriteTx = true;
         $ble.throwsSubscribe = true;

         promise = AnimistBLE.openLink(beacon_id);
         $scope.$digest();
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:authTxFailure', expected_error);
         expect(AnimistBLE.endSession).toHaveBeenCalled();
      });


      // -----------------------------------------------------------------------------------------------
      // Case: Authority mismatch . . .
      // -----------------------------------------------------------------------------------------------
      it('should broadcast unauthorizedTx failure and end session if no authority matches', function(){

         // Bad Authority
         AnimistBLE.peripheral.tx.authority = "jsdklfj;lja";
         $ble.emulateWriteTx = true;

         promise = AnimistBLE.openLink(beacon_id);
         $scope.$digest();
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:unauthorizedTx');
         expect(AnimistBLE.endSession).toHaveBeenCalled();
      });

   });

   // $on('Animist:receivedTx'): Handles the response to a successful tx retrieval. Tx proximity
   // requirement is checked and if ok, tx is passed to submitTx for processing, otherwise BLE
   // closes the connection to conserve resources and allow other clients to connect to the peripheral.
   describe("$on(): Animist:receivedTx", function(){

   })

   
});