"use strict"
var debug;

describe('AnimistBeacons Service', function () {
    
    beforeEach(module('animist'));      // Animist
    beforeEach(module('animistMocks'));  // cordovaBluetoothBLE & cordovaBeacon

    var $scope, $q, $cordovaBeacon, Beacons, AnimistBLE, AnimistAccount, d;

    beforeEach(inject(function(_$rootScope_, _$q_, _$cordovaBeacon_, _AnimistBeacons_, _AnimistBLE_ ){
        
        $scope = _$rootScope_;
        $cordovaBeacon = _$cordovaBeacon_;
        $q = _$q_;
    
        Beacons = _AnimistBeacons_;
        debug = $cordovaBeacon;
        AnimistBLE = _AnimistBLE_; 

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


        it('should set init. flag to true and resolve if user authorized beacon use', function(){
            var q;

            spyOn($cordovaBeacon, 'getAuthorizationStatus').and.callThrough();
            
            q = Beacons.initialize();
            $scope.$digest();

            expect(Beacons.initialized).toBe(true);
            expect(q.promise.$$state.status).toBe(1);

        })

        it('should set init. flag to false, and reject if user forbids background beacon use', function(){
            var q;


            spyOn($cordovaBeacon, 'getAuthorizationStatus').and.callThrough();
            $cordovaBeacon.throwsError = true;

            q = Beacons.initialize();
            $scope.$digest();

            expect(Beacons.initialized).toBe(false);
            expect(q.promise.$$state.status).toBe(2);
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

            Beacons.initialize();
            $scope.$digest();
            
        })
        it('should call AnimistBLE.listen w/ beacon id & proximity', function(){

            var expected_uuid = 'AAAAAAA';
            var expected_proximity = 'proximityNear';

            spyOn(AnimistBLE, 'listen').and.callThrough();
            $scope.$broadcast('$cordovaBeacon:didRangeBeaconsInRegion', mock_beacons);
            
            $scope.$digest();
            expect(AnimistBLE.listen).toHaveBeenCalledWith(expected_uuid, expected_proximity);
        })

    });

    describe('$on(): $cordovaBeacon:didExitRegion', function(){

        var mock_storage_id, mock_beacons;

        beforeEach(function(){

            mock_beacons = { region: { uuid: 'AAAAAAA' }};
    
            Beacons.initialize();
            $scope.$digest();
            
        })

        it('should reset the AnimistBLE connection', function(){
            var expected_pkg = {
                transmitter: 'AAAAAAA',
                receiver: 'ZZZZZZZZ'
            }

            spyOn(AnimistBLE, 'reset');
            $scope.$broadcast('$cordovaBeacon:didExitRegion', mock_beacons);
            $scope.$digest();
            expect(AnimistBLE.reset).toHaveBeenCalled();
        });

    });
});