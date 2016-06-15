"use strict"

describe('Service: AnimistBeacons', function () {
    
    beforeEach(module('animist'));      // Animist
    beforeEach(module('animstMocks'));  // cordovaBluetoothBLE & cordovaBeacon

    var $scope, $q, $cordovaBeacon, Beacons, BLE;

    beforeEach(inject(function(_$rootScope_, _$q_, _$cordovaBeacon_, _AnimistBeacons_, AnimistBLE ){
        
        $scope = _$rootScope_;
        $cordovaBeacon = _$cordovaBeacon_;
        $q = _$q_;
    
        Beacons = _AnimistBeacons_;
        BLE = _AnimistBLE_; 
    }));

    it('should initialize with the "initialized" flag equal to false', function(){
        expect(Beacons.initialized).toEqual(false);    
    });

    describe('initialize()', function(){

        it('should return immediately if service has already initialized', function(){

            spyOn($cordovaBeacon, 'requestAlwaysAuthorization');

            Beacons.initialized = true;
            Beacons.initialize();
            
            expect($cordovaBeacon.requestAlwaysAuthorization).not.toHaveBeenCalled();

            Beacons.initialized = false;
            Beacons.initialize();
            
            expect($cordovaBeacon.requestAlwaysAuthorization).toHaveBeenCalled();

        });

        it('should set up the region definitions correctly', function(){

            spyOn($cordovaBeacon, 'createBeaconRegion');
            Beacons.initialize();

            expect($cordovaBeacon.createBeaconRegion).
                toHaveBeenCalledWith('r_' + 0, "4F7C5946-87BB-4C50-8051-D503CEBA2F19", null, null, true)
            
        })

        it('should start monitoring each of the regions', function(){

            spyOn($cordovaBeacon, 'startMonitoringForRegion')
            Beacons.initialize();
            angular.forEach(Beacons.regions, function(region){
                expect($cordovaBeacon.startMonitoringForRegion).toHaveBeenCalledWith(region);
            })

        })

        it('should start ranging beacons in each region', function(){
            spyOn($cordovaBeacon, 'startRangingBeaconsInRegion')
            Beacons.initialize();
            angular.forEach(Beacons.regions, function(region){
                expect($cordovaBeacon.startRangingBeaconsInRegion).toHaveBeenCalledWith(region);
            })
        });

        it('should begin advertising as the user', function(){
            var profile = Mock.user.profile;
            
            spyOn($cordovaBeacon, 'createBeaconRegion').and.callThrough();
            spyOn($cordovaBeacon, 'startAdvertising');

            Beacons.initialize();

            expect($cordovaBeacon.createBeaconRegion).toHaveBeenCalledWith(
                profile.beaconName,
                profile.appId,
                parseInt(profile.major),
                parseInt(profile.minor),
                true
            );

            expect($cordovaBeacon.startAdvertising).toHaveBeenCalledWith(mockRegion);

        });

        it('should set init. flag to true and resolve if user authorized beacon use', function(){
            var q;

            spyOn($cordovaBeacon, 'getAuthorizationStatus').and.callThrough();
            defer.resolve();
            
            q = Beacons.initialize();
            $scope.$digest();

            expect(Beacons.initialized).toBe(true);
            expect(q.promise.$$state.status).toBe(1);

        })

        it('should mop up local storage, set init. flag to false, and reject if user forbids beacon use', function(){
            var q;

            spyOn($cordovaBeacon, 'getAuthorizationStatus').and.callThrough();
            defer.reject();
            $window.localStorage['pl_newInstall'] = true;
    
            q = Beacons.initialize();
            $scope.$digest();

            expect(Beacons.initialized).toBe(false);
            expect(q.promise.$$state.status).toBe(2);
            expect(q.promise.$$state.value).toBe('AUTH_REQUIRED');
            expect($window.localStorage['pl_newInstall']).toBe(undefined);

        })
    });

    describe('$on(): $cordovaBeacon:didRangeBeaconsInRegion', function(){

        var mock_storage_id, mock_beacons;

        beforeEach(function(){

            mock_storage_id = 'ZZZZZZZZ';
            mock_beacons = {
                beacons: [{
                    major: 1000,
                    minor: 1001,
                    uuid: 'AAAAAAA',
                    proximity: 'proximityNear'
                }]
            };

            $window.localStorage['pl_id'] = mock_storage_id;

            Beacons.initialize();
            $scope.$digest();
            
        })
        it('should call Meteor.newConnection with user & beacon data', function(){

            var expected_pkg = {
                transmitter: "1000_1001_AAAAAAA",
                receiver: 'ZZZZZZZZ',
                proximity: 'proximityNear'
            };

            spyOn(Meteor, 'call');
            $scope.$broadcast('$cordovaBeacon:didRangeBeaconsInRegion', mock_beacons);
            $scope.$digest();
            expect(Meteor.call).toHaveBeenCalledWith('newConnection', expected_pkg)

        })

    });

    describe('$on(): $cordovaBeacon:didExitRegion', function(){

        var mock_storage_id, mock_beacons;

        beforeEach(function(){

            mock_storage_id = 'ZZZZZZZZ';
            mock_beacons = { region: { uuid: 'AAAAAAA' }};
            $window.localStorage['pl_id'] = mock_storage_id;

            Beacons.initialize();
            $scope.$digest();
            
        })

        it('should call Meteor.disconnect', function(){
            var expected_pkg = {
                transmitter: 'AAAAAAA',
                receiver: 'ZZZZZZZZ'
            }

            spyOn(Meteor, 'call');
            $scope.$broadcast('$cordovaBeacon:didExitRegion', mock_beacons);
            $scope.$digest();
            expect(Meteor.call).toHaveBeenCalledWith('disconnect', expected_pkg)
        });

    })
});