"use strict"

angular.module('animist').service("AnimistBeacons", AnimistBeacons);

    function AnimistBeacons($rootScope, $q, $cordovaBeacon, AnimistBluetoothCore, AnimistBluetoothAuto ){

        var self = this;
        var lock = false;
        var regions = [];
        var core = AnimistBluetoothCore;
        var auto = AnimistBluetoothAuto;

        // The set of uuids to monitor for
        var uuids = [
            "4F7C5946-87BB-4C50-8051-D503CEBA2F19" 
            //"D4FB5D93-B1EF-42CE-8C08-CF11685714EB", //2
            //"98983597-F322-4DC3-A36C-72052BF6D612", //3
            //"8960D5AB-3CFA-46E8-ADE2-26A3FB462053", //4
            //"458735FA-E270-4746-B73E-E0C88EA6BEE0", //5
        ];

        // ------------------------  Logger Utility --------------------------
        var logger = function(msg, obj){
            //Meteor.call('ping', msg + ' ' + JSON.stringify(obj));
        }

        // ------------------------  Public ---------------------------------
        
        self.initialized = false;
       
        /**
         * Registers app to listen for Animist beacons in background mode on iOS. 
         * @method initialize() 
         * @return {promise} Resolves on success, rejects if user does not authorize.
         */
        self.initialize = function(){
            
            var d = $q.defer();
            var where = "AnimistBeacons:initialize";
           
            // Return if initialized. Also beacons cannot run in browser + output is annoying in XCode.
            if (self.initialized  ) { d.resolve(); return d; }

            // Init region array. Set device to wake app up when killed/backgrounded
            setUpRegions();
            $cordovaBeacon.requestAlwaysAuthorization();

            // Monitor all uuids
            angular.forEach(regions, function(region){
                $cordovaBeacon.startMonitoringForRegion(region);
            });

            // Range for all regions
            angular.forEach(regions, function(region){
                $cordovaBeacon.startRangingBeaconsInRegion(region);
            });

            // Register handlers
            $rootScope.$on("$cordovaBeacon:didExitRegion", function(event, result){
                onExit(result);
            });
            $rootScope.$on("$cordovaBeacon:didRangeBeaconsInRegion", function(event, result){
                onCapture(result);
            });
            
            // Check authorization before resolving. 
            $cordovaBeacon.getAuthorizationStatus().then(
                function(status){ self.initialized = true; d.resolve()}, 
                function(error){  self.initialized = false; d.reject()}
            );
            
            return d;
        };


        // setUpRegions(): initialize an array beaconRegion obj of all our possible uuid vals
        function setUpRegions(){
            for (var i = 0; i < uuids.length; i++){
                regions.push( $cordovaBeacon.createBeaconRegion('r_' + i, uuids[i], null, null, true));
            }
        };

        /** 
         * Called when monitoring exits a region. 'Resets' AnimistBLE, making it possible to 
         * open a new server connection with an endpoint. 
         * @method onExit
         * @param { Object } A beacon object which specifies the region uuid but not major/minor.
        */
        function onExit(result){

            (result.region) 
                ? core.reset()
                : null;
            
            //Meteor.call('disconnect', pkg);
        };

        /** 
         * Called when ranging detects a beacon. Passes beacon uuid and proximity to AnimistBLE
         * (When in range of beacon, this callback gets hit ~500ms - i.e. frequently) 
         * @method onCapture
         * @param { Array } Array of beacon objects which specify the region uuid & their major/minor.
        */
        function onCapture(result){

            var beacons = result.beacons

            var where = "AnimistBeacons:onCapture";
            var scan_result, transmitter, proximity, beacon;

            // THIS IS GIBBERISH
            if (beacons.length && !lock ){

                lock = true;
                
                angular.forEach(beacons, function(beacon){
                    auto.listen(beacon.uuid, beacon.proximity);
                    lock = false;
                });
            };
        };
    };
