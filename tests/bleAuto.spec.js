'use strict';
var test_debug;

describe('AnimistBluetoothAuto', function () {
  beforeEach(module('animist'));       // Animist
  beforeEach(module('animistMocks'));  // cordovaBluetoothBLE & cordovaBeacon
  beforeEach(module('ngCordovaMocks'));

  var $scope, $q, $ble, uuids, Auto, Core, API, Beacons, AnimistAccount, $timeout;

  beforeEach(inject(function (_$rootScope_, _$q_, _$cordovaBluetoothLE_, _$timeout_,
                              _AnimistBluetoothCore_, _AnimistBluetoothAuto_, _AnimistBluetoothAPI_,
                              _AnimistAccount_, _AnimistConstants_) {
    $scope = _$rootScope_;
    $ble = _$cordovaBluetoothLE_;
    $q = _$q_;
    $timeout = _$timeout_;
    uuids = _AnimistConstants_.serverCharacteristicUUIDs;

    Core = _AnimistBluetoothCore_;
    Auto = _AnimistBluetoothAuto_;
    API = _AnimistBluetoothAPI_;

      // AnimistAccount Mocks
    AnimistAccount = _AnimistAccount_;
    AnimistAccount.initialized = true;

    AnimistAccount.sign = function () { return 'message'; };
    AnimistAccount.generateTx = function (tx) { return 'message'; };
    AnimistAccount.address = '123';
    AnimistAccount.remoteAuthority = '567';
  }));

  // Listen (iOS): A gate-keeper for a Gatt Server connection to the Animist endpoint
  // specified by parameter: beacon_uuid. Returns promise.
  describe('listen([beacon_uuid, proximityString ])', function () {
    var beaconId, value, promise;
    beforeEach(function () {
      beaconId = '4F7C5946-87BB-4C50-8051-D503CEBA2F19';

      // Pre-run initialize()
      spyOn(Core, 'initialize').and.callThrough();
      spyOn(Auto, 'listen').and.callThrough();
      Core.initialize();
      Auto.listen(beaconId, 'proximityNear');
      $timeout.flush();
    });

    it('should verify beacon signal is animist', function () {
      // Fail case
      var badId = 'jdslkjflkjf';

      value = Auto.listen(badId, 'proximityNear');
      $scope.$digest();

      expect(value).toEqual(Core.stateMap.NOT_ANIMIST);

      // Success case
      Core.state = Core.stateMap.INITIALIZED;
      value = Auto.listen(beaconId, 'proximityNear');
      $scope.$digest();

      expect(value).toEqual(Core.stateMap.TRANSACTING);
    });

    it('should check proximity and reject if unknown', function () {
      value = Auto.listen(beaconId, 'proximityUnknown');
      $scope.$digest();

      expect(value).toEqual(Core.stateMap.PROXIMITY_UNKNOWN);
    });

    it('should update state to "transacting" when link opens and resolve immediately on subsequent calls', function () {
      // Connecting . . .
      Auto.listen(beaconId, 'proximityNear');
      $scope.$digest();

      // Transacting . . .
      spyOn(Auto, 'openLink').and.callThrough();

      Auto.listen(beaconId, 'proximityNear');
      $scope.$digest();

      expect(Core.state).toEqual(Core.stateMap.TRANSACTING);
      expect(Auto.openLink).not.toHaveBeenCalled();
    });

    it('should resolve immediately if a transaction has already been completed this session', function () {
      // Simulate completed . . .
      spyOn(Auto, 'openLink').and.callThrough();
      Core.state = Core.stateMap.COMPLETED;

      Auto.listen(beaconId, 'proximityNear');
      $scope.$digest();

      expect(Core.state).toEqual(Core.stateMap.COMPLETED);
      expect(Auto.openLink).not.toHaveBeenCalled();
    });

    it('should broadcast "Animist:bleFailure" if connection fails and do a hard reset', function () {
      var expected_error = { where: 'AnimistBluetoothCore:scanConnectAndDiscover: ', error: { error: 'failed' } };

      // Trigger error
      $ble.throwsScan = true;

      spyOn($scope, '$broadcast');
      spyOn(Core, 'reset');

      Auto.listen(beaconId, 'proximityNear');
      $timeout.flush();

      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:bleFailure', expected_error);
      expect(Core.reset).toHaveBeenCalled();
    });

    it('should broadcast "Animist:noTxFound" if endpoint does not find a tx and end the session', function () {
      var expected_error = {
        where: 'AnimistBluetoothCore:writeWithLongResponse: ' + uuids.getContract,
        error: 'NO_TX_DB_ERR'
      };

      // Trigger error
      $ble.throwsNOTX = true;
      $ble.emulateGetContract = true;

      spyOn($scope, '$broadcast');
      spyOn(Core, 'endSession');

      Auto.listen(beaconId, 'proximityNear');
      $timeout.flush();

      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:noTxFound', expected_error);
      expect(Core.endSession).toHaveBeenCalled();
    });
  });

  // openLink(): A controller for GATT server connections - either app is attempting
  // a 'virgin' connection, or it's already cached a tx from a (recent) connection and
  // is attempting to submit it.
  describe('openLink(beacon_uuid )', function () {
    var beacon_id, service_uuid, ble_address, pin, expected_request, promise;

    beforeEach(function () {
      beacon_id = '4F7C5946-87BB-4C50-8051-D503CEBA2F19';
      service_uuid = '05DEE885-E723-438F-B733-409E4DBFA694';
      ble_address = 'B70DCC59-4B65-C819-1C2C-D32B7FA0369A'; // From mocks: scanResult
      pin = 'iciIKTtuadkwlzF3v3CElZNoXfLW5H0p'; // From mocks: pinResult

      Core.initialize();

      spyOn(Core, 'scanConnectAndDiscover').and.callThrough();
      spyOn(API, 'getPin').and.callThrough();
      spyOn(API, 'getContract').and.callThrough();
      spyOn($scope, '$broadcast');
    });

    // ----------------------------------
    // Case: Initial connection sequence
    // ----------------------------------
    it('should initiate endpoint connection & retrieve a tx if no tx is cached', function () {
      Core.peripheral = {};
      $ble.emulateGetContract = true;

      promise = Auto.openLink(beacon_id, 'proximityNear');
      $timeout.flush();

      expect(Core.scanConnectAndDiscover).toHaveBeenCalledWith(service_uuid);
      expect(API.getPin).toHaveBeenCalled();
      expect(API.getContract).toHaveBeenCalled();
      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:initiatedBLEConnection');

      expect(Core.peripheral.address).toEqual(ble_address);
      expect(Core.peripheral.service).toEqual(service_uuid);
      expect(Core.peripheral.tx).toEqual($ble.mockGetContract);
      expect(Core.peripheral.pin).toEqual(pin);
    });

    // Hard coded Animist characteristic uuid checks . . . .
    it('should getPin from characteristic: "C40C94B3-D9FF-45A0-9A37-032D72E423A9"', function () {
      Core.peripheral = {};
      $ble.emulateGetContract = true;

      expected_request = {
        address: ble_address,
        service: service_uuid,
        characteristic: 'C40C94B3-D9FF-45A0-9A37-032D72E423A9',
        timeout: 5000
      };

      spyOn($ble, 'read').and.callThrough();

      promise = Auto.openLink(beacon_id, 'proximityNear');
      $timeout.flush();

      expect($ble.read).toHaveBeenCalledWith(expected_request);
    });

    it('should subscribeGetContract to characteristic: "BFA15C55-ED8F-47B4-BD6A-31280E98C7BA"', function () {
      Core.peripheral = {};
      $ble.emulateGetContract = true;

      expected_request = {
        address: ble_address,
        service: service_uuid,
        characteristic: 'BFA15C55-ED8F-47B4-BD6A-31280E98C7BA',
        timeout: 5000,
        value: 'Im1lc3NhZ2Ui'
      };

      spyOn($ble, 'subscribe').and.callThrough();

      promise = Auto.openLink(beacon_id, 'proximityNear');
      $timeout.flush();

      expect($ble.subscribe).toHaveBeenCalledWith(expected_request);
    });

    it('should broadcast "Animist:receivedTx" when tx transmission completes', function () {
      Core.peripheral = {};
      $ble.emulateGetContract = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:receivedTx');
    });

    // -------------------------------------------
    // Case: Reconnection Attempts w/ a cached tx
    // -------------------------------------------
    it('should resolve if cur. proximity wrong and listen loop should continue to cycle', function () {
      Core.peripheral = {
        address: ble_address,
        service: service_uuid,
        tx: JSON.parse($ble.mockGetContractResult)
      };

      spyOn(Core, 'connect').and.callThrough();
      Core.peripheral.tx.expires = (Date.now() + 10000000);
      Core.peripheral.tx.proximity = 'proximityNear';

      // Should fail: Far not near enough
      Core.proximity = 'proximityFar';

      promise = Auto.openLink(beacon_id);
      $scope.$digest();

      expect(promise.$$state.status).not.toEqual(2); // Shouldn't reject
      expect(Core.state).toEqual(Core.stateMap.CACHED);
      expect(Core.connect).not.toHaveBeenCalled();

      // Simulated listen() w/ correct proximity should succeed:
      // This proves that loop is still open after the kickback.
      Core.initialized = true;

      promise = Auto.listen(beacon_id, 'proximityNear');
      $scope.$digest();

      expect(Core.connect).toHaveBeenCalled();
      expect(Core.state).toEqual(Core.stateMap.TRANSACTING);
    });

    it('should connect and sendTx if cur. proximity meets cached tx requirements', function () {
      Core.peripheral = {
        address: ble_address,
        service: service_uuid,
        tx: JSON.parse($ble.mockGetContractResult)
      };

      spyOn(Core, 'connect').and.callThrough();
      spyOn(Auto, 'autoSendTx');

      Core.peripheral.tx.expires = (Date.now() + 10000000);
      Core.peripheral.tx.proximity = 'proximityNear';

      // Should succeed: Immediate closer than near
      Core.proximity = 'proximityImmediate';
      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect(Core.connect).toHaveBeenCalledWith(Core.peripheral.address);
      expect(Auto.autoSendTx).toHaveBeenCalledWith(Core.peripheral.tx, undefined);
    });
  });

   // autoSendTx(tx): A controller that manages final transaction writes and auth requests to
   // the endpoint and wraps the session up on success/failure.
  describe('autoSendTx(tx)', function () {
    var beacon_id, service_uuid, ble_address, pin, expected_request, promise,
      signers, customSignerSucceeds, customSignerFails;

    beforeEach(function () {
      beacon_id = '4F7C5946-87BB-4C50-8051-D503CEBA2F19';
      service_uuid = '05DEE885-E723-438F-B733-409E4DBFA694';
      ble_address = 'B70DCC59-4B65-C819-1C2C-D32B7FA0369A'; // From mocks: scanResult
      pin = 'iciIKTtuadkwlzF3v3CElZNoXfLW5H0p'; // From mocks: pinResult

      Core.initialize();

      spyOn(Core, 'connect').and.callThrough();
      spyOn(Auto, 'autoSendTx').and.callThrough();
      spyOn(Core, 'write').and.callThrough();
      spyOn(Core, 'endSession');
      spyOn(Core, 'reset');
      spyOn($scope, '$broadcast');

      Core.peripheral = {
        address: ble_address,
        service: service_uuid,
        tx: JSON.parse($ble.mockGetContractResult)
      };

      // Proximity and timestamp valid
      Core.peripheral.tx.expires = (Date.now() + 10000000);
      Core.peripheral.tx.proximity = 'proximityNear';
      Core.proximity = 'proximityNear';

      // Custom Signing function mock
      signers = {
        customSignerSucceeds: function (tx) {
          var d = $q.defer();
          d.resolve('signed');
          return d.promise;
        },

        customSignerFails: function (tx) {
          var d = $q.defer();
          d.reject('failed');
          return d.promise;
        }
      };
    });

    // ----------------------------------
    // Case: User signs their own tx
    // ----------------------------------
    it('should sign/write a tx to "3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06" if user has authority', function () {
      var expected_out = {
        id: Core.peripheral.tx.sessionId,
        tx: AnimistAccount.generateTx(Core.peripheral.tx)
      };

      // Hard coded sendTx characteristic uuid
      var sendTx_port_addr = '3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06';

      // User has authority
      Core.peripheral.tx.authority = AnimistAccount.address;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect(Core.write).toHaveBeenCalledWith(expected_out, sendTx_port_addr);
    });

    it('should broadcast sendTxSuccess & txHash data if user write is ok and then end session', function () {
      var expected_hash = {txHash: $ble.mockWriteTxResult};

      // User has authority
      Core.peripheral.tx.authority = AnimistAccount.address;
      $ble.emulateWriteTx = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:sendTxSuccess', expected_hash);
      expect(Core.endSession).toHaveBeenCalled();
    });

    it('should broadcast sendTxFailure if user write fails and then end session', function () {
      var expected_error = {
        error: {
          where: 'AnimistBluetoothCore:write: ' + uuids.sendTx,
          error: 0x01
        }
      };

      // User has authority
      Core.peripheral.tx.authority = AnimistAccount.address;
      $ble.emulateWriteTx = true;
      $ble.throwsSubscribe = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:sendTxFailure', expected_error);
      expect(Core.reset).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------------------------------
    // Case: Remote sign, local submit.
    // -----------------------------------------------------------------------------------------------
    it('should check if there is a customSigningFunction to submit remote auth locally', function () {
      // Remote authority
      Core.peripheral.tx.authority = AnimistAccount.remoteAuthority;
      $ble.emulateWriteTx = true;
      spyOn(signers, 'customSignerSucceeds').and.callThrough();

      // Case: customSigningFunction undefined
      Auto.setCustomSignMethod(undefined);
      Auto.openLink(beacon_id);
      $timeout.flush();

      expect(signers.customSignerSucceeds).not.toHaveBeenCalled();

      // Case: customSigningFunction exists
      Auto.setCustomSignMethod(signers.customSignerSucceeds);
      Auto.openLink(beacon_id);
      $timeout.flush();

      expect(signers.customSignerSucceeds).toHaveBeenCalled();
    });

    it('should custom sign and write a tx to "3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06" on custom sign success', function () {
      var mock_tx, expected_out, sendTx_port_addr;

      // Hard coded sendTx characteristic uuid
      sendTx_port_addr = '3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06';

      // Simulate call to custom signer
      signers.customSignerSucceeds(Core.peripheral.tx).then(function (msg) { mock_tx = msg; });
      $scope.$digest();

      var expected_out = {
        id: Core.peripheral.tx.sessionId,
        tx: mock_tx
      };

      // Remote authority
      Core.peripheral.tx.authority = AnimistAccount.remoteAuthority;
      $ble.emulateWriteTx = true;
      spyOn(signers, 'customSignerSucceeds').and.callThrough();

      Auto.setCustomSignMethod(signers.customSignerSucceeds);
      Auto.openLink(beacon_id);
      $timeout.flush();

      expect(Core.write).toHaveBeenCalledWith(expected_out, sendTx_port_addr);
    });

    it('should broadcast "sendTxMethodFailure" and reset on custom sign failure', function () {
      Core.peripheral.tx.authority = AnimistAccount.remoteAuthority;
      $ble.emulateWriteTx = true;
      spyOn(signers, 'customSignerFails').and.callThrough();

      Auto.setCustomSignMethod(signers.customSignerFails);
      Auto.openLink(beacon_id);
      $timeout.flush();

      expect(Core.write).not.toHaveBeenCalled();
      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:sendTxMethodFailure', {error: 'failed' });
      expect(Core.endSession).toHaveBeenCalled();
    });

    it('should broadcast "sendTxSuccess" & txHash data if custom sign write is ok and then end session', function () {
      var expected_hash = {txHash: $ble.mockWriteTxResult};

      // Remote authority
      Core.peripheral.tx.authority = AnimistAccount.remoteAuthority;

      $ble.emulateWriteTx = true;
      spyOn(signers, 'customSignerSucceeds').and.callThrough();

      Auto.setCustomSignMethod(signers.customSignerSucceeds);
      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:sendTxSuccess', expected_hash);
      expect(Core.endSession).toHaveBeenCalled();
    });

    it('should broadcast "sendTxFailure" if user write fails and then reset', function () {
      var expected_error = {
        error: {
          where: 'AnimistBluetoothCore:write: ' + uuids.sendTx,
          error: 0x01
        }
      };

      // User has authority
      Core.peripheral.tx.authority = AnimistAccount.remoteAuthority;
      $ble.emulateWriteTx = true;
      $ble.throwsSubscribe = true;

      spyOn(signers, 'customSignerSucceeds').and.callThrough();

      Auto.setCustomSignMethod(signers.customSignerSucceeds);
      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:sendTxFailure', expected_error);
      expect(Core.reset).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------------------------------
    // Case: Another authority will sign tx elsewhere. Only asking endpoint to confirm user was here.
    // e.g: authorize as a proximity oracle
    // -----------------------------------------------------------------------------------------------
    it('should sign/send pin to "297E3B0A-F353-4531-9D44-3686CC8C4036" if only requesting oracle auth.', function () {
      var expected_out = {
        id: Core.peripheral.tx.sessionId,
        pin: AnimistAccount.sign(Core.peripheral.pin)
      };

      // Hard coded sendTx characteristic uuid
      var verifyPresence_port_addr = '297E3B0A-F353-4531-9D44-3686CC8C4036';

      // Remote agent has authority
      Core.peripheral.tx.authority = AnimistAccount.remoteAuthority;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect(Core.write).toHaveBeenCalledWith(expected_out, verifyPresence_port_addr);
    });

    it('should broadcast verifyPresenceSuccess & txHash data if oracle auth write is ok and then end session', function () {
      var expected_hash = {txHash: $ble.mockWriteTxResult};

      // Remote agent has authority
      Core.peripheral.tx.authority = AnimistAccount.remoteAuthority;
      $ble.emulateWriteTx = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:verifyPresenceSuccess', expected_hash);
      expect(Core.endSession).toHaveBeenCalled();
    });

    it('should broadcast verifyPresenceFailure if oracle auth write fails and then reset', function () {
      var expected_error = {
        error: {
          where: 'AnimistBluetoothCore:write: ' + uuids.verifyPresence,
          error: 0x01
        }
      };

      // Remote agent has authority & subscription fails
      Core.peripheral.tx.authority = AnimistAccount.remoteAuthority;
      $ble.emulateWriteTx = true;
      $ble.throwsSubscribe = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:verifyPresenceFailure', expected_error);
      expect(Core.reset).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------------------------------
    // Case: Authority mismatch . . .
    // -----------------------------------------------------------------------------------------------
    it('should broadcast unauthorizedTx and end session if no authority matches', function () {
      // Bad Authority
      Core.peripheral.tx.authority = 'jsdklfj;lja';
      $ble.emulateWriteTx = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect($scope.$broadcast).toHaveBeenCalledWith('Animist:unauthorizedTx');
      expect(Core.endSession).toHaveBeenCalled();
    });
  });

  // $on('Animist:receivedTx'): Handles the response to a successful tx retrieval. Tx proximity
  // requirement is checked and if ok, tx is passed to sendTx for processing, otherwise BLE
  // closes the connection to conserve resources and allow other clients to connect to the peripheral.
  describe('$on(): Animist:receivedTx', function () {
    it('should submit the tx back to endpoint if tx was found and proximity req is met', function () {
      spyOn(Auto, 'autoSendTx');

      Core.proximity = 'proximityNear';
      Core.peripheral = { tx: { proximity: 'proximityNear'}};

      $scope.$broadcast('Animist:receivedTx');
      $scope.$digest();

      expect(Auto.autoSendTx).toHaveBeenCalledWith(Core.peripheral.tx, undefined);
    });

    it('should close the connection if tx was found and proximity req is NOT met', function () {
      spyOn(Auto, 'autoSendTx');
      spyOn(Core, 'close');

      Core.proximity = 'proximityFar';
      Core.peripheral = { tx: { proximity: 'proximityNear'}};

      $scope.$broadcast('Animist:receivedTx');
      $scope.$digest();

      expect(Auto.autoSendTx).not.toHaveBeenCalled();
      expect(Core.close).toHaveBeenCalled();
    });

    it('should end the session if no tx was found', function () {
      spyOn(Core, 'endSession');
      spyOn(Auto, 'autoSendTx');

      Core.proximity = 'proximityFar';
      Core.peripheral = { tx: null };

      $scope.$broadcast('Animist:receivedTx');
      $scope.$digest();

      expect(Auto.autoSendTx).not.toHaveBeenCalled();
      expect(Core.endSession).toHaveBeenCalled();
    });
  });
});
