// @service: Beacons
// Handlers for initializing, transmitting and receiving of beacon signals
//(function(){

"use strict"

angular.module('animist')
  .service("AnimistBeacons", AnimistBeacons);

    function AnimistBeacons($rootScope, $q, $cordovaBeacon, AnimistBLE ){

        var self = this;
        var lock = false;
        var regions = [];

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
       
        // @function initialize() 
        // Sets up beaconing in app. This method resolves on the Nearby tab, so it may
        // have already run as user navigates around. Rejects if user does not authorize.
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

            // Initialize BLE
            /*AnimistAccount.init().then(
                function(user){}, 
                function(error){ logger(where, error)}
            );*/
            
            // Check authorization before resolving. Remove newInstall key 
            // from local storage so that a pw/login will redirect to the settings
            // page.
            $cordovaBeacon.getAuthorizationStatus().then(
                function(status){ self.initialized = true; d.resolve()}, 
                function(error){  self.initialized = false; d.reject()}
            );
            
            return d;
        };

        // ------------------------  Private ---------------------------------
        // setUpRegions(): initialize an array beaconRegion obj of all our possible uuid vals
        function setUpRegions(){
            for (var i = 0; i < uuids.length; i++){
                regions.push( $cordovaBeacon.createBeaconRegion('r_' + i, uuids[i], null, null, true));
            }
        };


        // @function: onExit
        // @param: result (this only contains uuid, not major/minor)
        // Called when monitoring exits a region. Pulls app identifier from local storage and
        // attempts to remove any connections where this app is the receiver and the transmitter
        // has the uuid specified by 'result'.   
        function onExit(result){

            var beacon = result.region;
            
            if (beacon){

                AnimistBLE.reset();
                //Meteor.call('disconnect', pkg);

            } else {
                //MSLog("@beacon:disconnect. Error: receiver - " + receiver);
            }
           
        };

        // @function: onCapture
        // @param: result (result.beacons is an array)
        // Called when ranging detects a beacon. Pulls app identifier from local storage and
        // attempts to create a connection record in the meteor DB.  
        function onCapture(result){

            var beacons = result.beacons

            var where = "AnimistBeacons:onCapture";
            var scan_result, transmitter, proximity, beacon;

            if (beacons.length && !lock ){

                lock = true;
                
                angular.forEach(beacons, function(beacon){

                    AnimistBLE.listen(beacon.uuid, beacon.proximity).then(
                        function(success){lock = false; logger(where, success)},
                        function(error){lock = false; logger(where, error)}
                    );
                })
            };
        };
    };

//})()