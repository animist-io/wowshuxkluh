"use strict"
var test_debug;

describe('AnimistBLE Service', function(){

   beforeEach(module('animist'));      // Animist
   beforeEach(module('animistMocks'));  // cordovaBluetoothBLE & cordovaBeacon
   beforeEach(module('ngCordovaMocks'));

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

   
         spyOn($ble, 'initialize').and.callThrough();
         promise = AnimistBLE.initialize();
         $timeout.flush();
   
         expect($ble.initialize).toHaveBeenCalledWith(init_params);
         expect(promise.$$state.status).toEqual(1);
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.INITIALIZED);

      });

      it('should enable subsequent calls to listen() if successful', function(){

         spyOn(AnimistBLE, 'initialize').and.callThrough();
         spyOn(AnimistBLE, 'listen').and.callThrough();
         spyOn(AnimistBLE, 'openLink').and.callThrough();
         spyOn($ble, 'initialize').and.callThrough();

         // Initial call
         AnimistBLE.initialize();
         AnimistBLE.listen(beaconId, 'proximityNear' );
         $timeout.flush();

         // Subsequent call
         promise = AnimistBLE.listen(beaconId, 'proximityNear' );
         $scope.$digest();
         expect(promise.$$state.status).toEqual(1);
         expect(promise.$$state.value).toEqual(AnimistBLE.stateMap.TRANSACTING);
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.TRANSACTING);
         
         expect(AnimistBLE.openLink).toHaveBeenCalled();

      });

      it('should disable subsequent calls to listen() if NOT successful', function(){

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
         
         // Simulate completed . . . 
         spyOn(AnimistBLE, 'openLink').and.callThrough();
         AnimistBLE.state = AnimistBLE.stateMap.COMPLETED;

         promise = AnimistBLE.listen(beaconId, 'proximityNear');
         $scope.$digest();
         expect(promise.$$state.status).toBe(1);
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.COMPLETED);

         expect(AnimistBLE.openLink).not.toHaveBeenCalled();

      });

      it('should broadcast "Animist:bleFailure" if connection fails and do a hard reset', function(){

         var expected_error = { where : 'AnimistBLE:scanConnectAndDiscover: ', error : { error : 'failed' } }
         
         // Trigger error
         $ble.throwsScan = true;

         spyOn($scope, '$broadcast');
         spyOn(AnimistBLE, 'reset');

         AnimistBLE.listen(beaconId, 'proximityNear');
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:bleFailure', expected_error );
         expect(AnimistBLE.reset).toHaveBeenCalled();
         
      });

      it('should broadcast "Animist:noTxFound" if endpoint does not find a tx and end the session', function(){

         var expected_error = { where : 'AnimistBLE:subscribeGetContract: ', error : 'NO_TX_FOUND' };

         // Trigger error
         $ble.throwsNOTX = true;
         $ble.emulateGetContract = true;

         spyOn($scope, '$broadcast');
         spyOn(AnimistBLE, 'endSession');

         AnimistBLE.listen(beaconId, 'proximityNear');
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

         spyOn(AnimistBLE, 'scanConnectAndDiscover').and.callThrough();
         spyOn(AnimistBLE, 'readPin').and.callThrough();
         spyOn(AnimistBLE, 'subscribeGetContract').and.callThrough();
         spyOn($scope, '$broadcast');

      });

      // ----------------------------------
      // Case: Initial connection sequence
      // ----------------------------------

      it('should initiate endpoint connection & retrieve a tx if no tx is cached', function(){
         
         AnimistBLE.peripheral = {};
         $ble.emulateGetContract = true;

         promise = AnimistBLE.openLink(beacon_id, 'proximityNear');
         $timeout.flush();

         expect(AnimistBLE.scanConnectAndDiscover).toHaveBeenCalledWith(service_uuid);
         expect(AnimistBLE.readPin).toHaveBeenCalled();
         expect(AnimistBLE.subscribeGetContract).toHaveBeenCalled();
         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:initiatedBLEConnection');

         expect(AnimistBLE.peripheral.address).toEqual(ble_address);
         expect(AnimistBLE.peripheral.service).toEqual(service_uuid);
         expect(AnimistBLE.peripheral.tx).toEqual($ble.mockGetContractResult);
         expect(AnimistBLE.pin).toEqual(pin);

      });

      // Hard coded Animist characteristic uuid checks . . . .
      it('should readPin from characteristic: "C40C94B3-D9FF-45A0-9A37-032D72E423A9"', function(){

         AnimistBLE.peripheral = {};
         $ble.emulateGetContract = true;

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

      it('should subscribeGetContract to characteristic: "BFA15C55-ED8F-47B4-BD6A-31280E98C7BA"', function(){

         AnimistBLE.peripheral = {};
         $ble.emulateGetContract = true;

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
         $ble.emulateGetContract = true;

         promise = AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:receivedTx');
      });

      // -------------------------------------------
      // Case: Reconnection Attempts w/ a cached tx
      // -------------------------------------------

      it('should check cached txs for staleness and reset/resolve when old', function(){

         AnimistBLE.peripheral = {
            address: ble_address,
            service: service_uuid,
            tx: JSON.parse($ble.mockGetContractResult)
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
            tx: JSON.parse($ble.mockGetContractResult)
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

         // Simulated listen() w/ correct proximity should succeed: 
         // This proves that loop is still open after the kickback.
         AnimistBLE.initialized = true;

         promise = AnimistBLE.listen(beacon_id, 'proximityNear');
         $scope.$digest();

         expect(AnimistBLE.connect).toHaveBeenCalled()
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.TRANSACTING);

      });

      it('should connect and submitTx if cur. proximity meets cached tx requirements', function(){

         AnimistBLE.peripheral = {
            address: ble_address,
            service: service_uuid,
            tx: JSON.parse($ble.mockGetContractResult)
         };

         spyOn(AnimistBLE, 'connect').and.callThrough();
         spyOn(AnimistBLE, 'submitTx');

         AnimistBLE.peripheral.tx.expires = (Date.now() + 10000000);
         AnimistBLE.peripheral.tx.proximity = 'proximityNear';

         // Should succeed: Immediate closer than near
         AnimistBLE.proximity = 'proximityImmediate';
         promise = AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect(AnimistBLE.connect).toHaveBeenCalledWith(AnimistBLE.peripheral.address);
         expect(AnimistBLE.submitTx).toHaveBeenCalledWith(AnimistBLE.peripheral.tx, undefined);

      });

      // --------------------------------------------------------------------------------------
      // $cordovaBluetoothLE errors: Verify these errors bubble back to openLink()
      // --------------------------------------------------------------------------------------

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
         $ble.emulateGetContract = true;

         promise = AnimistBLE.openLink(beacon_id);   
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);
      });


      it('should reject w/ NO_TX_FOUND if peripheral cannot find tx', function(){

         AnimistBLE.peripheral = {};
         $ble.throwsNOTX = true;
         $ble.emulateGetContract = true;

         promise = AnimistBLE.openLink(beacon_id);    
         $timeout.flush();

         expect(promise.$$state.status).toEqual(2);
         expect(promise.$$state.value.error).toEqual('NO_TX_FOUND');

      });

   });

   // submitTx(tx): A controller that manages final transaction writes and auth requests to 
   // the endpoint and wraps the session up on success/failure.
   describe('submitTx(tx)', function(){
      var beacon_id, service_uuid, ble_address, pin, expected_request, promise, 
          signers, customSignerSucceeds, customSignerFails;

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
         spyOn(AnimistBLE, 'reset');
         spyOn($scope, '$broadcast');

         AnimistBLE.peripheral = {
            address: ble_address,
            service: service_uuid,
            tx: JSON.parse($ble.mockGetContractResult)
         };

         // Proximity and timestamp valid
         AnimistBLE.peripheral.tx.expires = (Date.now() + 10000000);
         AnimistBLE.peripheral.tx.proximity = 'proximityNear';
         AnimistBLE.proximity = 'proximityNear';

         // Custom Signing function mock
         signers = {
            customSignerSucceeds: function(tx){
               var d = $q.defer();
               d.resolve('signed');
               return d.promise;
            },

            customSignerFails: function(tx){
               var d = $q.defer();
               d.reject('failed');
               return d.promise;
            }
         };
         
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
         $timeout.flush();

         expect(AnimistBLE.writeTx).toHaveBeenCalledWith(expected_out, signedTx_port_addr)

      });

      it('should broadcast signedTxSuccess & txHash data if user write is ok and then end session', function(){

         var expected_hash = {txHash: $ble.mockWriteTxResult}

         // User has authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.address;
         $ble.emulateWriteTx = true;

         promise = AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:signedTxSuccess', expected_hash);
         expect(AnimistBLE.endSession).toHaveBeenCalled();

      });

      it('should broadcast signedTxFailure if user write fails and then end session', function(){

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
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:signedTxFailure', expected_error);
         expect(AnimistBLE.reset).toHaveBeenCalled();
      });

      // -----------------------------------------------------------------------------------------------
      // Case: Remote sign, local submit. 
      // -----------------------------------------------------------------------------------------------
      it('should check if there is a customSigningFunction to submit remote auth locally', function(){

         // Remote authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;
         $ble.emulateWriteTx = true;
         spyOn(signers, 'customSignerSucceeds').and.callThrough();

         // Case: customSigningFunction undefined
         AnimistBLE.setCustomSignMethod(undefined);
         AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect(signers.customSignerSucceeds).not.toHaveBeenCalled();

         // Case: customSigningFunction exists
         AnimistBLE.setCustomSignMethod(signers.customSignerSucceeds);
         AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect(signers.customSignerSucceeds).toHaveBeenCalled();
      });

      it('should custom sign and write a tx to "3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06" on custom sign success', function(){

         var mock_tx, expected_out, signedTx_port_addr;

         // Hard coded signTx characteristic uuid
         signedTx_port_addr = '3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06';

         // Simulate call to custom signer
         signers.customSignerSucceeds(AnimistBLE.peripheral.tx).then(function(msg){ mock_tx = msg });
         $scope.$digest();

         var expected_out = {
            id: AnimistBLE.peripheral.tx.sessionId,
            tx: mock_tx
         };

         // Remote authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;
         $ble.emulateWriteTx = true;
         spyOn(signers, 'customSignerSucceeds').and.callThrough();

         AnimistBLE.setCustomSignMethod(signers.customSignerSucceeds);
         AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect(AnimistBLE.writeTx).toHaveBeenCalledWith(expected_out, signedTx_port_addr)

      });

      it('should broadcast "signedTxMethodFailure" and reset on custom sign failure', function(){

         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;
         $ble.emulateWriteTx = true;
         spyOn(signers, 'customSignerFails').and.callThrough();

         AnimistBLE.setCustomSignMethod(signers.customSignerFails);
         AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect(AnimistBLE.writeTx).not.toHaveBeenCalled();
         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:signedTxMethodFailure', {error: 'failed' });
         expect(AnimistBLE.endSession).toHaveBeenCalled();

      });

      it('should broadcast "signedTxSuccess" & txHash data if custom sign write is ok and then end session', function(){

         var expected_hash = {txHash: $ble.mockWriteTxResult}

         // Remote authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;

         $ble.emulateWriteTx = true;
         spyOn(signers, 'customSignerSucceeds').and.callThrough();

         AnimistBLE.setCustomSignMethod(signers.customSignerSucceeds);
         promise = AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:signedTxSuccess', expected_hash);
         expect(AnimistBLE.endSession).toHaveBeenCalled();

      });

      it('should broadcast "signedTxFailure" if user write fails and then reset', function(){

         var expected_error = { 
            error : { 
               where : 'AnimistBLE:writeTx: ', 
               error : { 
                  error : 'failed' 
               } 
            }
         }

         // User has authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;
         $ble.emulateWriteTx = true;
         $ble.throwsSubscribe = true;

         spyOn(signers, 'customSignerSucceeds').and.callThrough();

         AnimistBLE.setCustomSignMethod(signers.customSignerSucceeds);
         promise = AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:signedTxFailure', expected_error);
         expect(AnimistBLE.reset).toHaveBeenCalled();
      });


      // -----------------------------------------------------------------------------------------------
      // Case: Another authority will sign tx elsewhere. Only asking endpoint to confirm user was here.
      // e.g: authorize as a proximity oracle
      // -----------------------------------------------------------------------------------------------

      it('should sign/send pin to "297E3B0A-F353-4531-9D44-3686CC8C4036" if only requesting oracle auth.', function(){
         
         var expected_out = {
            id: AnimistBLE.peripheral.tx.sessionId,
            pin: AnimistAccount.user.sign(AnimistBLE.pin)
         };

         // Hard coded signTx characteristic uuid
         var authTx_port_addr = '297E3B0A-F353-4531-9D44-3686CC8C4036'

         // Remote agent has authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;

         promise = AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect(AnimistBLE.writeTx).toHaveBeenCalledWith(expected_out, authTx_port_addr)

      });

      it('should broadcast authTxSuccess & txHash data if oracle auth write is ok and then end session', function(){

         var expected_hash = {txHash: $ble.mockWriteTxResult}

         // Remote agent has authority
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;
         $ble.emulateWriteTx = true;

         promise = AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:authTxSuccess', expected_hash);
         expect(AnimistBLE.endSession).toHaveBeenCalled();

      });

      it('should broadcast authTxFailure if oracle auth write fails and then reset', function(){

         var expected_error = { 
            error : { 
               where : 'AnimistBLE:writeTx: ', 
               error : { 
                  error : 'failed' 
               } 
            }
         }

         // Remote agent has authority & subscription fails
         AnimistBLE.peripheral.tx.authority = AnimistAccount.user.remoteAuthority;
         $ble.emulateWriteTx = true;
         $ble.throwsSubscribe = true;

         promise = AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:authTxFailure', expected_error);
         expect(AnimistBLE.reset).toHaveBeenCalled();
      });


      // -----------------------------------------------------------------------------------------------
      // Case: Authority mismatch . . .
      // -----------------------------------------------------------------------------------------------
      it('should broadcast unauthorizedTx and end session if no authority matches', function(){

         // Bad Authority
         AnimistBLE.peripheral.tx.authority = "jsdklfj;lja";
         $ble.emulateWriteTx = true;

         promise = AnimistBLE.openLink(beacon_id);
         $timeout.flush();

         expect($scope.$broadcast).toHaveBeenCalledWith('Animist:unauthorizedTx');
         expect(AnimistBLE.endSession).toHaveBeenCalled();
      });

   });

   // $on('Animist:receivedTx'): Handles the response to a successful tx retrieval. Tx proximity
   // requirement is checked and if ok, tx is passed to submitTx for processing, otherwise BLE
   // closes the connection to conserve resources and allow other clients to connect to the peripheral.
   describe("$on(): Animist:receivedTx", function(){


      it('should submit the tx back to endpoint if tx was found and proximity req is met', function(){

         spyOn(AnimistBLE, 'submitTx');

         AnimistBLE.proximity = 'proximityNear';
         AnimistBLE.peripheral = { tx: { proximity: 'proximityNear'}};

         $scope.$broadcast('Animist:receivedTx');
         $scope.$digest();

         expect(AnimistBLE.submitTx).toHaveBeenCalledWith(AnimistBLE.peripheral.tx, undefined);

      });

      it('should close the connection if tx was found and proximity req is NOT met', function(){

         spyOn(AnimistBLE, 'submitTx');
         spyOn(AnimistBLE, 'close');

         AnimistBLE.proximity = 'proximityFar';
         AnimistBLE.peripheral = { tx: { proximity: 'proximityNear'}};

         $scope.$broadcast('Animist:receivedTx');
         $scope.$digest();

         expect(AnimistBLE.submitTx).not.toHaveBeenCalled();
         expect(AnimistBLE.close).toHaveBeenCalled();

      });

      it('should end the session if no tx was found', function(){

         spyOn(AnimistBLE, 'endSession');
         spyOn(AnimistBLE, 'submitTx');
   
         AnimistBLE.proximity = 'proximityFar';
         AnimistBLE.peripheral = { tx: null };

         $scope.$broadcast('Animist:receivedTx');
         $scope.$digest();

         expect(AnimistBLE.submitTx).not.toHaveBeenCalled();
         expect(AnimistBLE.endSession).toHaveBeenCalled();
      });

   });

   describe('close(), endSession(), reset()', function(){

      var default_peripheral, expected_params;

      beforeEach(function(){

         default_peripheral = { address: 'anAddress', otherKeys: 'otherkeys' };
         expected_params = { address: default_peripheral.address };
         spyOn($ble, 'close').and.callThrough();
      })

      it('should $ble.close and set state to "CACHED" on close()', function(){
         AnimistBLE.peripheral = default_peripheral;
         AnimistBLE.state = 'testing';

         AnimistBLE.close();
         $scope.$digest();

         expect($ble.close).toHaveBeenCalledWith(expected_params);
         expect(AnimistBLE.peripheral).toEqual(default_peripheral);
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.CACHED);

      });

      it('should $ble.close, wipe the peripheral & set state to "COMPLETED" on endSession()', function(){

         var expected_peripheral = {};

         AnimistBLE.peripheral = default_peripheral;
         AnimistBLE.state = 'testing';

         AnimistBLE.endSession();
         $scope.$digest();
         
         expect($ble.close).toHaveBeenCalledWith(expected_params);
         expect(AnimistBLE.peripheral).toEqual(expected_peripheral);
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.COMPLETED);

      });

      it('should $ble.close, wipe the peripheral model & set state to "INITIALIZED" on reset()', function(){

         var expected_peripheral = {};

         AnimistBLE.peripheral = default_peripheral;
         AnimistBLE.state = 'testing';

         AnimistBLE.reset();
         $scope.$digest();
         
         expect($ble.close).toHaveBeenCalledWith(expected_params);
         expect(AnimistBLE.peripheral).toEqual(expected_peripheral);
         expect(AnimistBLE.state).toEqual(AnimistBLE.stateMap.INITIALIZED);

      });
   })
  
});