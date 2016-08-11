describe('AnimistBluetoothAuto', function(){

    beforeEach(module('animist'));       // Animist
    beforeEach(module('animistMocks'));  // cordovaBluetoothBLE & cordovaBeacon
    beforeEach(module('ngCordovaMocks'));

    var $scope, $q, $ble, uuids, Auto, Core, API, Beacons, AnimistAccount, $timeout;

    beforeEach(inject(function(_$rootScope_, _$q_, _$cordovaBluetoothLE_, _$timeout_, 
                              _AnimistBluetoothCore_, _AnimistBluetoothAuto_, _AnimistBluetoothAPI_, 
                              _AnimistAccount_, _AnimistConstants_ ){
     
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

        AnimistAccount.sign = function(){ return 'message' };
        AnimistAccount.generateTx = function(tx){ return 'message'}
        AnimistAccount.address = '123';
        AnimistAccount.remoteAuthority = '567';
    }));

    describe('getPin', function(){

        it('should read the getPin uuid', function(){

        });

        it('should resolve the pin value on success', function(){

        });

        it('should reject with error object on failure', function(){

        });
    });
