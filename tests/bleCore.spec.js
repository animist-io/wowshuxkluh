'use strict';
var test_debug;

describe('AnimistBluetoothCore', function () {
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

  // Public constants
  describe('Constants', function () {
    it('should define constants that expose the services state', function () {
      expect(Core.stateMap.PROXIMITY_UNKNOWN).toBe(0);
      expect(Core.stateMap.TRANSACTING).toBe(1);
      expect(Core.stateMap.NOT_ANIMIST).toBe(3);
      expect(Core.stateMap.CACHED).toBe(4);
      expect(Core.stateMap.COMPLETED).toBe(5);
      expect(Core.stateMap.NOT_INITIALIZED).toBe(6);
      expect(Core.stateMap.INITIALIZED).toBe(7);
      expect(Object.keys(Core.stateMap).length).toBe(7);
    });
  });

// Tests to make sure errors are thrown and propagate as promises.
  describe('Errors', function () {
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

    it('should reject on scan error', function () {
      Core.peripheral = {};
      $ble.throwsScan = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect(promise.$$state.status).toEqual(2);
    });

    it('should reject on connect error', function () {
      Core.peripheral = {};
      $ble.throwsConnect = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect(promise.$$state.status).toEqual(2);
    });

    it('should reject on discover error', function () {
      Core.peripheral = {};
      $ble.throwsDiscover = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect(promise.$$state.status).toEqual(2);
    });

    it('should reject on read error', function () {
      Core.peripheral = {};
      $ble.throwsRead = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect(promise.$$state.status).toEqual(2);
    });

    it('should reject on subscription error', function () {
      Core.peripheral = {};
      $ble.throwsSubscribe = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect(promise.$$state.status).toEqual(2);
    });

    it('should reject on write error', function () {
      Core.peripheral = {};
      $ble.throwsWrite = true;
      $ble.emulateGetContract = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect(promise.$$state.status).toEqual(2);
    });

    it('should reject w/ NO_TX_FOUND if peripheral cannot find tx', function () {
      Core.peripheral = {};
      $ble.throwsNOTX = true;
      $ble.emulateGetContract = true;

      promise = Auto.openLink(beacon_id);
      $timeout.flush();

      expect(promise.$$state.status).toEqual(2);
      expect(promise.$$state.value.error).toEqual('NO_TX_DB_ERR');
    });
  });

  // Initialization:
  describe('initialize()', function () {
    var beaconId, init_params, value, promise;
    beforeEach(function () {
      beaconId = '4F7C5946-87BB-4C50-8051-D503CEBA2F19';
      init_params = {request: true};
    });

    it('should initialize $cordovaBluetoothLE', function () {
      spyOn($ble, 'initialize').and.callThrough();
      promise = Core.initialize();
      $timeout.flush();

      expect($ble.initialize).toHaveBeenCalledWith(init_params);
      expect(promise.$$state.status).toEqual(1);
      expect(Core.state).toEqual(Core.stateMap.INITIALIZED);
    });

    it('should enable subsequent calls to listen() if successful', function () {
      spyOn(Core, 'initialize').and.callThrough();
      spyOn(Auto, 'listen').and.callThrough();
      spyOn(Auto, 'openLink').and.callThrough();
      spyOn($ble, 'initialize').and.callThrough();

      // Initial call
      Core.initialize();
      Auto.listen(beaconId, 'proximityNear');
      $timeout.flush();

      // Subsequent call
      value = Auto.listen(beaconId, 'proximityNear');
      $scope.$digest();
      expect(value).toEqual(Core.stateMap.TRANSACTING);
      expect(Core.state).toEqual(Core.stateMap.TRANSACTING);
      expect(Auto.openLink).toHaveBeenCalled();
    });

    it('should disable subsequent calls to listen() if NOT successful', function () {
      $ble.throwsError = true;
      spyOn(Auto, 'listen').and.callThrough();
      spyOn(Auto, 'openLink').and.callThrough();
      spyOn($ble, 'initialize').and.callThrough();

      // Initial call
      value = Auto.listen(beaconId, 'proximityNear');
      $scope.$digest();

      expect(value).toEqual(Core.stateMap.NOT_INITIALIZED);
      expect(Core.state).toEqual(Core.stateMap.NOT_INITIALIZED);

      // Subsequent call
      value = Auto.listen(beaconId, 'proximityNear');
      $scope.$digest();

      expect(value).toEqual(Core.stateMap.NOT_INITIALIZED);
      expect(Core.state).toEqual(Core.stateMap.NOT_INITIALIZED);
      expect(Auto.openLink).not.toHaveBeenCalled();
    });
  });

  describe('close(), endSession(), reset()', function () {
    var default_peripheral, expected_params;

    beforeEach(function () {
      default_peripheral = { address: 'anAddress', otherKeys: 'otherkeys' };
      expected_params = { address: default_peripheral.address };
      spyOn($ble, 'close').and.callThrough();
    });

    it('should $ble.close and set state to "CACHED" on close()', function () {
      Core.peripheral = default_peripheral;
      Core.state = 'testing';

      Core.close();
      $scope.$digest();

      expect($ble.close).toHaveBeenCalledWith(expected_params);
      expect(Core.peripheral).toEqual(default_peripheral);
      expect(Core.state).toEqual(Core.stateMap.CACHED);
    });

    it('should $ble.close, wipe the peripheral & set state to "COMPLETED" on endSession()', function () {
      var expected_peripheral = {};

      Core.peripheral = default_peripheral;
      Core.state = 'testing';

      Core.endSession();
      $scope.$digest();

      expect($ble.close).toHaveBeenCalledWith(expected_params);
      expect(Core.peripheral).toEqual(expected_peripheral);
      expect(Core.state).toEqual(Core.stateMap.COMPLETED);
    });

    it('should $ble.close, wipe the peripheral model & set state to "INITIALIZED" on reset()', function () {
      var expected_peripheral = {};

      Core.peripheral = default_peripheral;
      Core.state = 'testing';

      Core.reset();
      $scope.$digest();

      expect($ble.close).toHaveBeenCalledWith(expected_params);
      expect(Core.peripheral).toEqual(expected_peripheral);
      expect(Core.state).toEqual(Core.stateMap.INITIALIZED);
    });
  });
});
