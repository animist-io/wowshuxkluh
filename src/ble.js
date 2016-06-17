// TO DO:
// generateTx
// Peripheral authTx, signTx 
//(function(){

"use strict"
var ble_debug;

angular.module('animist')
  .service("AnimistBLE", AnimistBLE);

    function AnimistBLE($rootScope, $q, $cordovaBluetoothLE, AnimistAccount ){

        var user = null; // 
        var initialized = false;
        var midTransaction = false;  
        var completed = false;
        
        // Events 
        var events = {
            receivedTx: 'Animist:receivedTx',
            signedTxSuccess: 'Animist:signedTxSuccess',
            signedTxFailure: 'Animist:signedTxFailure',
            authTxSuccess: 'Animist:authTxSuccess',
            authTxSuccess: 'Animist:authTxFailure',
            unauthorizedTx: 'Animist:unauthorizedTx',
            bleFailure: 'Animist:bleFailure'
        };

        // Characteristic UUIDS
        var UUID = {
            pin : 'C40C94B3-D9FF-45A0-9A37-032D72E423A9',
            hasTx:  'BFA15C55-ED8F-47B4-BD6A-31280E98C7BA',
            authTx: '297E3B0A-F353-4531-9D44-3686CC8C4036',
            signTx : '3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06'
        };

        // Animist Beacon UUIDS (Keys) and corresponding Peripheral UUIDS (Vals)
        var endpointMap = {

            "4F7C5946-87BB-4C50-8051-D503CEBA2F19" : "05DEE885-E723-438F-B733-409E4DBFA694",
            "D4FB5D93-B1EF-42CE-8C08-CF11685714EB" : "9BD991F7-0CB9-4FA7-A075-B3AB1B9CFAC8", 
            "98983597-F322-4DC3-A36C-72052BF6D612" : "774D64CA-91C9-4C3A-8DA3-221D9CF755E7",
            "8960D5AB-3CFA-46E8-ADE2-26A3FB462053" : "33A93F3C-9CAA-4D39-942A-6659AD039232",
            "458735FA-E270-4746-B73E-E0C88EA6BEE0" : "01EC8B5B-B7DB-4D65-949C-81F4FD808A1A"
        };

        // These are common to whale-island and wowshuxkluh and 
        // are passed in ble write callbacks on success/failure
        // **** Do NOT change here w/out updating peripheral code *****
        var codes = {

           INVALID_JSON_IN_REQUEST:   0x02,
           NO_SIGNED_MSG_IN_REQUEST:  0x03,
           NO_TX_FOUND:               0x04,
           RESULT_SUCCESS:            0x00,
           EOF :                      'EOF' 
        };

        // Weightings for proximity comparison: 
        // If the proximity requirement is 'far' we interpret that as
        // 'at least far' so 'near' will meet the requirement.
        var proximityWeights = {
            'proximityImmediate' : 3,
            'proximityNear' : 2,
            'proximityFar' : 1
        };

        // Excluded proximity value: 
        var unknown = 'proximityUnknown';

        // -------------------------------------------------------------------------
        // ------------------------------- API -------------------------------------
        // -------------------------------------------------------------------------

        var self = this;

        self.peripheral = {}; // The animist endpoint client connects to.
        self.proximity; // Current proximity passed to us by AnimistBeacon via listen()
        
        // State values that can be tested against in the listen()
        // resolve/reject callbacks
        self.state = {
            PROXIMITY_UNKNOWN: 0,
            TRANSACTING: 1,
            NOT_ANIMIST: 3,
            CONNECTING: 4, 
            COMPLETED: 5,
            INITIALIZING: 6,
            BLE_INIT_FAIL: 7

        };

        // initialize(): Must be called before listen() can begin. Validates user
        // object and initializes $cordovaBLE
        self.initialize = function(){

            var where = 'AnimistBLE:initialize: ';
            var userError = 'invalid user: ';
            var d = $q.defer();
            
            // Check/Set user
            if (AnimistAccount.initialized) {
                user = AnimistAccount.user;

                // Initialize BLE: Note: success callback runs in unit tests only - implemented here
                // because notify can't be called ? Not sure. It's bullshit but the rest of the test suite
                // has to pass through this so necessary to fake. 
                $cordovaBluetoothLE.initialize({request: true}).then( 
                    function(success){ }, 
                    function(error)  { initialized = false; d.reject({where: where, error: error}) },
                    function(notify) { initialized = true; d.resolve() }
                );
            } else {
                d.reject({where: where, error: userError});
            }

            return d.promise;
        };

        // reset(): Called in the exit_region callback of AnimistBeacon OR when a 
        // connection times out - resets all the state variables and enables 
        // a virgin connection. BLE remains initialized though. . . 
        self.reset = function(){

            var where = "AnimistBLE:reset: ";

            $cordovaBluetoothLE.close({address: self.peripheral.address}).
                then().finally(function(result){

                    self.peripheral = {}; 
                    completed = false;
                    midTransaction = false;
                    logger(where, result); 
                }
            );
        };

        // listen(): This gets hit continuously in the Beacon capture callback and just 
        // 'gate keeps' the peripheral connection. Rejects if beaconId doesn't map to known 
        // animist signal or if the module failed to initalize. Resolves immediately if we 
        // are currently connecting/connected or the transaction is finished. Otherwise 
        // forwards to openLink() to begin/complete peripheral business. 
        self.listen = function(beaconId, proximity){

            var peripheral_uuid;
            var where = 'AnimistBLE:listen: ';
            var d = $q.defer();
            
            self.proximity = proximity;
            
            if (!initialized){
                self.initialize().then(
                    function(){d.resolve(self.state.INITIALIZING)},
                    function(){d.reject(self.state.BLE_INIT_FAIL)}
                );

            // Return immediately if we are already connected/connecting 
            } else if ( midTransaction ){
                d.resolve(self.state.TRANSACTING);

            // Verify device is meaningfully in range
            } else if ( self.proximity === unknown ){
                d.reject(self.state.PROXIMITY_UNKNOWN);

            // Verify beacon is Animist
            } else if ( !isAnimistSignal(beaconId)){
                d.reject(self.state.NOT_ANIMIST);

            // Connect if allowed & resolve immediately
            } else if ( !completed ){
                
                midTransaction = true;
                peripheral_uuid = endpointMap[beaconId];

                // Any connection errors below here propagates back to 
                // this handler which broadcasts bleFailure and ends the session. 
                self.openLink(peripheral_uuid).then(
                    null,
                    function(error){
                        logger(where, error);
                        $rootScope.$broadcast(events.bleFailure, {error: error});
                        self.endSession();
                    }
                );
                d.resolve(self.state.CONNECTING);

            // OR finished
            } else {
                d.resolve(self.state.COMPLETED);
            }

            return d.promise;
        }

        // -------------------------------------------------------------------------
        // ---------------------------- INTERNAL -----------------------------------
        // -------------------------------------------------------------------------

        // openLink(): Called by listen() . . . . 
        self.openLink = function( uuid ){

            var where = 'AnimistBLE:openLink: ';
            var d = $q.defer();
            
            // First peripheral connection or session timed-out.
            if (!wasConnected()){
                
                // Scan, discover and try to get tx
                self.scan(uuid).then(function(scan){
                    self.connectAndDiscover(scan.address).then(function(){
                            
                        // Peripheral vals from the scan
                        self.peripheral.address = scan.address;
                        self.peripheral.service = uuid;
                        
                        // Setup Subscriptions
                        self.readPin().then(function(){ 
                            self.subscribeHasTx().then(function(){

                                d.resolve();

                                // Waiting for the receivedTx event. 
                                // Listen() is kicking everything back
                                // while we are in mid-transaction.  
                            
                            }, function(e){ d.reject(e)}) 
                        }, function(e){ d.reject(e)}) 
                    }, function(e){ d.reject(e)}) 
                }, function(e){ d.reject(e)}); 

            // Cached tx but session is stale: Start again w/ a hard reset
            } else if (hasTimedOut()){
                self.reset();
                d.resolve();

            // Cached, session current and we might reconnect w/ right proximity: 
            // Check this, connect and submit cached tx
            } else if (proximityMatch(self.peripheral.tx )) {

                self.connect(self.peripheral.address).then(function(){  

                    self.submitTx(self.peripheral.tx);
                    
                    // Waiting for the txConfirm 
                    // events w/ their txHashes. SubmitTx 
                    // will manage closing everything down on
                    // success or failure.

                    d.resolve();
                    
                }, function(e){ d.reject(e)}); 
            
            // Cached but proximity is wrong: Stay closed, keep cycling.
            } else {
                d.resolve(self.peripheral);
            }   
            
            return d.promise;
        }

        self.submitTx = function(tx){
        
            var out = {};

            // Case: User can sign their own tx.
            // Broadcasts txHash of the signedTx or error post-write
            if (tx.authority === user.address) {

                out.id = tx.sessionId;
                /******* THIS NEEDS TO BE WRITTEN */
                out.tx = user.generateTx(tx);
                // ********************************

                self.writeTx(out, UUID.signTx).then(

                    function(txHash){ $rootScope.$broadcast( events.signedTxSuccess, {txHash: txHash} )}, 
                    function(error) { $rootScope.$broadcast( events.signedTxFailure, {error: error} )}

                ).finally(function(){ self.endSession()});

            // Case: Signing will be remote - ask endpoint to validate presence
            // Broadcasts txHash of the endpoint's authTx or error post-write
            } else if ( tx.authority === user.remoteAuthority){

                out.id = tx.sessionId;
                out.pin = user.sign(self.pin);

                self.writeTx(out, UUID.authTx).then(
                    
                    function(txHash){ $rootScope.$broadcast( events.authTxSuccess, {txHash: txHash} )}, 
                    function(error){  $rootScope.$broadcast( events.authTxFailure, {error: error} )}

                ).finally(function(){ self.endSession() });

            // Case: No one here is authorized (Bad api key etc . . .)
            // Broadcasts unauthorized error
            } else {
                $rootScope.$broadcast( events.unauthorizedTx );
                self.endSession();
            }
        };

        
        // ---------------------- Event Handlers -----------------------------

        $rootScope.$on(events.receivedTx, function(){
            
            if (self.peripheral.tx){
                
                proximityMatch(self.peripheral.tx) ? 
                    self.submitTx(self.peripheral.tx) : 
                    self.close();

            } else {
                self.endSession(); 
            }
        });

        // -------------- BLE Central Connect/Disconnect  ----------------------

        // @function scan( uuid ) 
        // @param uuid (String): Animist service uuid associated w/ the heard beacon uuid 
        // Resolves the BLE hardware address of the endpoint peripheral
        self.scan = function( uuid ){

            var where = 'AnimistBLE:scan: '
            var d = $q.defer();

            $cordovaBluetoothLE.startScan( { services: [uuid] }).then(null,
            
                // Scan failed
                function(error){  d.reject({where: where, error: error}) },
                // Scan succeeded
                function(scan){         

                    // Stop Scan on Success
                    if (scan.status === 'scanResult'){
                        $cordovaBluetoothLE.stopScan().then( 
                            function(){ d.resolve(scan)},
                            function(error){ d.reject({where: where, error: error}) }
                        );  
                    }   
                }
            );

            return d.promise;
        };

        // Initial connection
        self.connectAndDiscover = function( address ){

            var where = 'AnimistBLE:connectAndDiscover: '
            var d = $q.defer();

            // Connect 
            $cordovaBluetoothLE.connect({address: address, timeout: 5000}).then(

                null,
               
               // Connect failed: close per randDusing best practice
                function(error){
                    $cordovaBluetoothLE.close({address: address});
                    d.reject({where: where, error: error});
                },

                // Connected -> Discover
                function(connected){

                    $cordovaBluetoothLE.discover({address: address, timeout: 5000}).then(
                        // Discovered
                        function(device){ d.resolve(device) },
                        // Discover failed
                        function(error){
                            $cordovaBluetoothLE.close({address: address});
                            d.reject({where: where, error: error});
                        }
                    );
                }
            );
            return d.promise;
        };

        self.connect = function( address ){

            var where = 'AnimistBLE:connect: '
            var d = $q.defer();

            // Connect 
            $cordovaBluetoothLE.connect({address: address, timeout: 5000}).then(null,
               
                // Connect failed: close
                function(error){
                    $cordovaBluetoothLE.close({address: address});
                    d.reject({where: where, error: error});
                },

                // Connected
                function(connected){ d.resolve() }
            );

            return d.promise;
        };

        // close(): Called on its own when a transaction is first discovered but the 
        // the proximity requirement hasn't been met. Client will continue to ping us
        // w/ new proximity readings which we parse in openLink() to decide if we
        // should reconnect
        self.close = function(){
            var where = "AnimistBLE:close: ";
            var param = { address: self.peripheral.address };

            $cordovaBluetoothLE.close(param).then().finally(
                function(){ 
                    midTransaction = false; 
                    //logger(where, null); 
                }
            );
        };

        // endSession(): Called when transaction is completed OR no transaction 
        // was found. Stops any reconnection attempt while client is in current 
        // beacon region. 
        self.endSession = function(){
            completed = true;
            midTransaction = false;
            close();
        };

        // ----------------Characteristic Subscriptions/Reads/Writes -----------------------------
        
        self.writeTx = function(out, dest){
        
            var where = 'AnimistBLE:writeTx: ';
            var d = $q.defer();

            // Characteristic params
            var req = {
                address: self.peripheral.address,
                service: self.peripheral.service,
                characteristic: dest,
                timeout: 5000
            };

            out = encode(out);

            $cordovaBluetoothLE.subscribe(req).then(null, 
                // Subscribe failed     
                function(error){ d.reject({where: where, error: error})},
                // Subscribed/Updated
                function(sub){ 
                    
                    // Subscribed: write tx 
                    if (sub.status === 'subscribed'){

                        req.value = out;
                        $cordovaBluetoothLE.write(req).then(
                            function(success){}, 
                            function(error){ d.reject({where: where, error: error})}
                        );

                    // Notification handler: resolves txHash
                    } else {
                        d.resolve( decode(sub.value) );
                    };
                }
            ); 
            return d.promise;
        };

        self.subscribeHasTx = function(){
            
            var decoded, signedPin, msg = '';
            var where = 'AnimistBLE:subscribeHasTx: ';
            var d = $q.defer();
                
            // hasTx characteristic params
            var req = {
                address: self.peripheral.address,
                service: self.peripheral.service,
                characteristic: UUID.hasTx,
                timeout: 5000
            };

            // Attempt
            $cordovaBluetoothLE.subscribe(req).then(null, 
                
                // Subscribe failed     
                function(error){ d.reject({where: where, error: parseCode(error)})},
                // Subscribed/Updated
                function(sub){ 
                    
                    // Subscribed, resolve: 
                    if (sub.status === 'subscribed'){

                        signedPin = user.sign(self.pin);
                        req.value = encode(signedPin);

                        $cordovaBluetoothLE.write(req).then(
                            function(success){}, 
                            function(error){ d.reject({where: where, error: error})}
                        );

                    // Notification handler: broadcasts receivedTx event
                    } else {
    
                        decoded = decode(sub.value);
                        
                        // Case: mid-transmission
                        if (decoded != 'EOF'){

                            msg += decoded;

                        // Case: end of transmission
                        } else {
                            self.peripheral.tx = msg;
                            $rootScope.$broadcast( events.receivedTx );
                            //logger(where, msg);
                        }
                    };
                }
            );
            return d.promise;
        }

        self.readPin = function(){
            
            var decoded;
            var where = 'AnimistBLE:readPIN: ';
            var d = $q.defer();
            
            // Compose subscribe req to pin characteristic
            var req = {
                address: self.peripheral.address,
                service: self.peripheral.service,
                characteristic: UUID.pin,
                timeout: 5000
            };

            // Decode response and update pin value
            $cordovaBluetoothLE.read(req).then( 
                // Update pin
                function(result){ 
                    self.pin = decode(result.value); 
                    d.resolve()},
                
                // Subscribe failed     
                function(error){ 
                    d.reject({where: where, error: error})
                }
            );
            
            return d.promise;
        };

        // --------------------- Utilities --------------------------------

        function proximityMatch(tx){
            return ( tx && (proximityWeights[self.proximity] >= proximityWeights[tx.proximity]) );
        }

        function wasConnected(){
            return (Object.keys(self.peripheral).length != 0);
        }

        function hasTimedOut(){
            return (Date.now() > self.peripheral.tx.expires);
        }

        // isAnimistSignal: 
        function isAnimistSignal(uuid){
            return endpointMap.hasOwnProperty(uuid);
        }

        function encode(msg){
            msg = JSON.stringify(msg);
            msg = $cordovaBluetoothLE.stringToBytes(msg);
            return $cordovaBluetoothLE.bytesToEncodedString(msg);
        };

        function decode(msg){
            msg = $cordovaBluetoothLE.encodedStringToBytes(msg);
            return $cordovaBluetoothLE.bytesToString(msg);
        };

        function parseCode(hex){
            for( var prop in codes) {
                if( codes.hasOwnProperty( prop ) ) {
                    if( codes[ prop ] === hex )
                        return prop;
                }
            }
        }

        // Remote Meteor Debugging
        function logger(msg, obj){
            //(Meteor) ? 
            //    Meteor.call('ping', msg + ' ' + JSON.stringify(obj)) : 
                console.log(msg + '' + JSON.stringify(obj));
        }

        // Unit Test proxies;


    };

//})();