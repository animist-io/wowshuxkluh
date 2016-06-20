"use strict"

/*--------------------------------------------------------------------------------------------------- 
SERVICE: AnimistBLE
Author: cgewecke June 2016

This service manages communication between Animist accounts (AnimistAccount service in this 
repo and and Animist endpoints (at: animist-io/whale-island) over Bluetooth LE. Basic design 
as follows:

1. Animist endpoints broadcast a peristent beacon signal which wakes animist mobile clients up,
   triggering their beacon capture callback (that code is at AnimistBeacon). The callback
   calls AnimistBLE method: listen( beaconId, proximity ) 

2. AnimistBLE looks up the beacon uuid in an endpoint map and finds the service uuid for the 
   bluetooth peripheral associated with it. It then connects to the peripheral and reads its
   "pin" - a constantly changing string value which makes it slightly more difficult to spoof
   the endpoint by recording transaction data and having it delivered by proxy in some leisurely way. 

3. AnimistBLE signs the pin using eth-lightwallet utilities at AnimistAccount and writes this value to 
   the endpoint's 'hasTx' characteristic. The endpoint extracts the public account address from the 
   pin message and searches its database of extant contracts about itself for any that match  
   the calling account. (There should only be one).

4. The endpoint sends back an object consisting of contract code, a proximity requirement, a 
   sessionId, a session expiration date, and the address specified as the contracts
   'authority' e.g. the address the contract expects to sign the tx. 

5. At this point there are two possiblities: 
   a) The user can sign their own transaction. AnimistBLE signs and transmits. (This would be the 
      case in an app where you placed a wager on a race from A to B with someone. 
   
   b) The app requires someone else sign. AnimistBLE asks the endpoint to write a tx to the blockchain
      verifying it registered the clients presence at this location. (This would be the case in an 
      app that used Animist to offer some reward to app users based on their behavior. In other words
      the app developer is 'paying' and maintains its own Ethereum client in the cloud along with
      its own keys (which it doesn't want to give to the client).
   
   c) NOT IMPLEMENTED - a feature that allows client to send code to cloud to be signed and 
      returned to client who forwards it to the endpoint. One issue with this is the background run time
      allowed on iOS which defaults to ~6 seconds. There might be ways around this and it might not 
      be a problem on android. Another is whether there are security issues with having a signed
      transaction pass back to the client who not actually be 'your' client if you got decompiled etc.   
-----------------------------------------------------------------------------------------------------*/

angular.module('animist')
  .service("AnimistBLE", AnimistBLE);

    function AnimistBLE($rootScope, $q, $cordovaBluetoothLE, AnimistAccount ){

        // Local ref to AnimistAccount user, set in initalialize()
        var user = null; 
        
        // Events 
        var events = {
            receivedTx: 'Animist:receivedTx',
            signedTxSuccess: 'Animist:signedTxSuccess',
            signedTxFailure: 'Animist:signedTxFailure',
            authTxSuccess: 'Animist:authTxSuccess',
            authTxFailure: 'Animist:authTxFailure',
            unauthorizedTx: 'Animist:unauthorizedTx',
            noTxFound: 'Animist:noTxFound',
            bleFailure: 'Animist:bleFailure'
        };

        // Endpoint characteristic UUIDS
        var UUID = {
            pin : 'C40C94B3-D9FF-45A0-9A37-032D72E423A9',
            hasTx:  'BFA15C55-ED8F-47B4-BD6A-31280E98C7BA',
            authTx: '297E3B0A-F353-4531-9D44-3686CC8C4036',
            signTx : '3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06'
        };

        // Animist Beacon UUIDS (Keys) and corresponding endpoint service UUIDS (Vals)
        var endpointMap = {

            "4F7C5946-87BB-4C50-8051-D503CEBA2F19" : "05DEE885-E723-438F-B733-409E4DBFA694",
            "D4FB5D93-B1EF-42CE-8C08-CF11685714EB" : "9BD991F7-0CB9-4FA7-A075-B3AB1B9CFAC8", 
            "98983597-F322-4DC3-A36C-72052BF6D612" : "774D64CA-91C9-4C3A-8DA3-221D9CF755E7",
            "8960D5AB-3CFA-46E8-ADE2-26A3FB462053" : "33A93F3C-9CAA-4D39-942A-6659AD039232",
            "458735FA-E270-4746-B73E-E0C88EA6BEE0" : "01EC8B5B-B7DB-4D65-949C-81F4FD808A1A"
        };

        // These are common to whale-island and wowshuxkluh and 
        // are passed in $cordova ble 'write' callbacks on success/failure
        // **** Do NOT change here w/out updating whale-island code *****
        var codes = {

           INVALID_JSON_IN_REQUEST:   0x02,
           NO_SIGNED_MSG_IN_REQUEST:  0x03,
           NO_TX_FOUND:               0x04,
           RESULT_SUCCESS:            0x00,
           EOF :                      'EOF' 
        };

        // Weightings for proximity comparison: 
        // If the proximity requirement is 'far' we interpret that as
        // 'at least far' e.g. 'near' will meet the requirement.
        var proximityWeights = {
            'proximityImmediate' : 3,
            'proximityNear' : 2,
            'proximityFar' : 1,
        };

        // -------------------------------------------------------------------------
        // ------------------------------- API -------------------------------------
        // -------------------------------------------------------------------------

        var self = this;

        self.peripheral = {}; // Obj representing the animist endpoint client we connect to.
        self.proximity;       // Current proximity passed to us by AnimistBeacon via listen()
     
        // State values that can be tested against in the listen()
        // resolve/reject callbacks or referenced directly in Angular / reactive uis
        self.stateMap = {
            PROXIMITY_UNKNOWN: 0,
            TRANSACTING: 1,
            NOT_ANIMIST: 3,
            CACHED: 4, 
            COMPLETED: 5,
            NOT_INITIALIZED: 6,
            INITIALIZED: 7
        };

        // Initial state
        self.state = self.stateMap.NOT_INITIALIZED;

        // initialize(): Must be called before listen() can begin. Validates user
        // object then hardware inits via $cordovaBLE
        self.initialize = function(){

            var where = 'AnimistBLE:initialize: ';
            var userError = 'invalid user: ';
            var d = $q.defer();
            
            // Check/Set user
            if (AnimistAccount.initialized) {
                user = AnimistAccount.user;

                // $cordova initialize:  
                $cordovaBluetoothLE.initialize({request: true}).then( 
                    null, 
                    function(error)  { 
                        self.state = self.stateMap.NOT_INITIALIZED;
                        d.reject({where: where, error: error}) 
                    },
                    function(notify) { 
                        self.state = self.stateMap.INITIALIZED;
                        d.resolve(); 
                    }
                );
            } else {
                d.reject({where: where, error: userError});
            }

            return d.promise;
        };

        // listen(): Gets hit continuously in the Beacon capture callback and 
        // 'gate keeps' the endpoint connection. Rejects if beaconId doesn't map to known 
        // animist signal, proximity is unreadable, or if the module failed to initalize. 
        // Resolves immediately if we are currently connecting/connected or the transaction is 
        // finished. Otherwise forwards to openLink() to begin/complete endpoint transmission. 
        // If openLink() fails to find a tx, we broadcast that state and discontinue the session while
        // we're in range of the device. If openLink fails for technical reasons, we broadcast fail
        // and reset the connection enabling a new attempt.
        self.listen = function(beaconId, proximity){

            var NO_TX = 'NO_TX_FOUND';
            var where = 'AnimistBLE:listen: ';

            var d = $q.defer();
            
            var map = self.stateMap;
            var state = canOpenLink(beaconId, proximity);
            
            switch( state ){

                case map.TRANSACTING: 
                    d.resolve(self.state); 
                    break;

                case map.COMPLETED: 
                    d.resolve(self.state);
                    break;

                case map.NOT_INITIALIZED:
                    d.reject(self.state);
                    break;

                case map.NOT_ANIMIST:
                    d.reject(map.NOT_ANIMIST);
                    break;

                case map.PROXIMITY_UNKNOWN:
                    d.reject(map.PROXIMITY_UNKNOWN);
                    break;

                // Any connection errors below bubble back up to 
                // this handler which broadcasts either 
                // a) noTxFound and ends the session OR
                // b) bleFailure and resets BLE on hardware layer failure, 
                //    allowing the device to attempt fresh connection. 
                default:

                    self.state = map.TRANSACTING;
                    self.proximity = proximity;

                    self.openLink(beaconId).then( null, function(fail){
                            
                        if (fail.error === NO_TX){
                            $rootScope.$broadcast(events.noTxFound, fail);
                            self.endSession();
                        } else {
                            $rootScope.$broadcast(events.bleFailure, fail);
                            self.reset();   
                        }     
                    });
                    d.resolve(self.state);

            }
            return d.promise;

        }

        // -----------------------------------------------------------------------------------
        // --- Public for Karma Testing / Code below not part of public API, except reset()  
        // -----------------------------------------------------------------------------------

        // -----------------------------------------------------------------------------------
        // -------------------  Link and Tx Submission Controllers ---------------------------
        // -----------------------------------------------------------------------------------

        // openLink(): Called by listen(). 
        // a) Attempts to open a new connection if session is fresh, OR
        // b) closes the connection and resets if the session has timed out, OR 
        // c) reconnects if mobile client already got tx and has finally met proximity requirement, OR
        // d) does nothing if client has tx but still hasn't met a proximity requirement.
        self.openLink = function( beaconId ){

            var where = 'AnimistBLE:openLink: ';
            var d = $q.defer();
            var uuid = endpointMap[beaconId];
            
            // Case: First peripheral connection or session timed-out.
            if (!wasConnected()){
                
                // Scan, discover and try to get tx
                self.scanConnectAndDiscover(uuid).then(function(address){
                        
                    // Peripheral vals: 
                    // MAC address from the scan, service from our endpointMap
                    self.peripheral.address = address;
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
                }, function(e){ d.reject(e)});  

            // Case: Cached tx but session is stale. This means user connected but never got close
            // enough to endpoint to meet the contract req. Start again w/ a hard reset.
            } else if (hasTimedOut()){

                self.reset();
                d.resolve();

            // Case: Cached, session current and we might reconnect w/ right proximity: 
            // Check this, connect and submit cached tx
            } else if (proximityMatch(self.peripheral.tx )) {

                self.connect(self.peripheral.address).then(function(){  
                    self.submitTx(self.peripheral.tx);
                    
                    // Waiting for the txConfirm 
                    // event w/ its txHash. SubmitTx 
                    // will manage closing everything down on
                    // success or failure.

                    d.resolve();
                    
                }, function(e){ d.reject(e)}); 
            
            // Case: Cached but proximity is wrong: Stay closed, keep cycling.
            } else {
                self.state = self.stateMap.CACHED;
                d.resolve();
            }   
            
            return d.promise;
        }

        // submitTx(): Called by $on("Animist:receivedTx") or openLink();
        // 
        // a) writes signed tx to endpoint if user is authorized to do so, OR
        // b) writes a request to confirm users presence at this loc. if a remote authority 
        //      will manage submitting the rest of tx elsewhere, OR
        // c) does nothing if there is no authority match. 
        //
        // Ends session in all cases, including on error.
        // Broadcasts message specific to each of the above, including error.
        self.submitTx = function(tx){
            
            var out = {};

            // Case: User can sign their own tx. Write tx & wait for response.
            // Broadcasts txHash of the signedTx or error
            if (tx.authority === user.address) {

                out.id = tx.sessionId;
                /******* THIS NEEDS TO BE WRITTEN */
                out.tx = user.generateTx(tx);
                // ********************************

                self.writeTx(out, UUID.signTx).then(

                    function(txHash){ $rootScope.$broadcast( events.signedTxSuccess, {txHash: txHash} )}, 
                    function(error) { $rootScope.$broadcast( events.signedTxFailure, {error: error} )}

                ).finally(function(){ self.endSession()});

            // Case: Signing will be remote - Write endpoint to validate presence & wait for response.
            // Broadcasts txHash of the endpoint's authTx or error.
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

        // $on('Animist:receivedTx'): Responds to a successful tx retrieval. Event is 
        // fired from subscribeHasTx. Checks proximity req and passes to submitTx for processing if  
        // ok OR closes the the connection to conserve resources and allow other clients to connect 
        // to the endpoint. 
        $rootScope.$on(events.receivedTx, function(){
            
            if (self.peripheral.tx){
                
                proximityMatch(self.peripheral.tx) ? 
                    self.submitTx(self.peripheral.tx) : 
                    self.close();

            // A failsafe that doesn't get called in the current code (but someone might call it someday). 
            // The 'no tx' case is handled by rejection from subscribeHasTx . . . session gets killed 
            // in the openLink error callback. 
            } else {
                self.endSession(); 
            }
        });

        // -------------- BLE Central Connect/Disconnect  ----------------------

        //  scanConnectAndDiscover(uuid): Wraps a set of sequential calls to
        //  $cordovaBluetoothLE ::scan() ::connect() ::discover(). This is boiler plate
        //  necessary for an inital connection even if we know service uuid and 
        //  characteristics (on iOS at least.) Resolves MAC address of endpoint or rejects.
        //  Note: Scan, discover and connect all 'succeed' via the notify callback rather than 
        //  resolve.
        self.scanConnectAndDiscover = function(uuid){

            var where = 'AnimistBLE:scanConnectAndDiscover: '
            var d = $q.defer();
            var openParams, closeParams;

            // Start Scanning . . .
            $cordovaBluetoothLE.startScan( { services: [uuid] }).then(null,
            
                // Scan failed
                function(error){  d.reject({where: where, error: error}) },
                // Scan succeeded
                function(scan){         

                    // Stop Scan on Success per randDusing best practice. 
                    if (scan.status === 'scanResult'){
                        $cordovaBluetoothLE.stopScan().then(function(){ 
                            
                            // Connect 
                            openParams = {address: scan.address, timeout: 5000};
                            closeParams = { address: scan.address };

                            $cordovaBluetoothLE.connect(openParams).then(null,
                               
                               // Connect failed: close per randDusing best practice
                                function(error){
                                    $cordovaBluetoothLE.close(closeParams);
                                    d.reject({where: where, error: error});
                                },

                                // Connected -> Discover
                                function(connected){
                                    $cordovaBluetoothLE.discover(openParams).then(
                                        // Discovered: Resolve address
                                        function(device){  d.resolve(scan.address) },
                                        // Discover failed
                                        function(error){
                                            $cordovaBluetoothLE.close(closeParams);
                                            d.reject({where: where, error: error});
                                        }
                                    );
                                });
                            // Stop scan failed
                            }, function(error){ d.reject({where: where, error: error}) }
                             
                        );  
                    }   
                }
            );
            return d.promise;
        };

        // connect(): AnimistBLE wrapper for $cordovaBluetoothLE:connect()
        // This is called when we have already connected during a session and
        // do not need to go through scan/connect/discover process to access
        // characteristics. Use cases are: when a proximity that was inadequate
        // meets the cached txs requirement & technical disconnections. 
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
        // the proximity requirement hasn't been met. Closing frees up the endpoint 
        // for other clients and minimizes likelyhood of our connection timing out. 
        // AnimistBeacon will continue to ping us w/ new proximity 
        // readings; these get parsed in openLink() to determine if we should reconnect. 
        self.close = function(){
            var where = "AnimistBLE:close: ";
            var param = { address: self.peripheral.address };

            $cordovaBluetoothLE.close(param).then().finally( function(){ 
                    self.state = self.stateMap.CACHED;
                }
            );
        };

        // endSession(): Called when transaction is completed OR no transaction 
        // was found. Stops any reconnection attempt while client is in current 
        // beacon region. 
        self.endSession = function(){
            
            var param = { address: self.peripheral.address };

            $cordovaBluetoothLE.close(param).then().finally( function(){ 
                    self.peripheral = {}; 
                    self.state = self.stateMap.COMPLETED;
                }
            );
        };

        // reset(): Called in the exit_region callback of AnimistBeacon OR when a 
        // sessionId times out, or on connection error - resets all the state variables 
        // and enables a virgin connection. BLE remains initialized. OK if address DNE -
        // $BluetoothLE will handle that.
        self.reset = function(){

            var where = "AnimistBLE:reset: ";

            $cordovaBluetoothLE.close({address: self.peripheral.address}).
            then().finally(function(result){

                self.peripheral = {}; 
                self.state = self.stateMap.INITIALIZED;
            });          
        };

        // ----------------Characteristic Subscriptions/Reads/Writes -----------------------------
        
        // writeTx(out, dest): 'out' is a json object to be transmitted. 'dest' is either the signedTx
        // or authTx characteristic uuid. Subscribes to characteristic, writes out and waits 
        // for / resolves the Ethereum tx hash of completed transaction.
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
                    
                    // Subscribed: write tx to target, wait for txHash notice
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

        // subscribeHasTx(): subscribes to hasTx characteristic, then signs the endpoint pin and
        // writes it back. Endpoint deciphers this and searches its db for qualifying contract code.
        // If contract is found it will respond RESULT_SUCCESS (0x00) to our write success callback and begin
        // transmitting packets to us in the subscription callback. We broadcast 'Animist:receivedTx' 
        // on success or reject through the write error callback on error.  
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
                function(error){ d.reject({where: where, error: error})},
                // Subscribed/Updated
                function(sub){ 
    
                    // Subscribed: write signedPin to characteristic 
                    // and wait for notify response. Reject on NO TX FOUND
                    // or other error. 
                    if (sub.status === 'subscribed'){

                        signedPin = user.sign(self.pin);
                        req.value = encode(signedPin);

                        $cordovaBluetoothLE.write(req).then(
                            function(success){}, 
                            function(error){d.reject({where: where, error: parseCode(error)})}
                        );

                    // Notification handler: Assembles tx transmission and
                    // broadcasts receivedTx event when message is EOF
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

        // readPin: Reads the value of the pin characteristic. This updates constantly on the 
        // endpoint side and is used to verify that mobile client is present 'in time'. This
        // pin will get signed by the user and returned to endpoint for transaction search and
        // auth requests. 
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

        // proximityMatch(): Is current proximity equal or nearer than required proximity?
        function proximityMatch(tx){
            return ( tx && (proximityWeights[self.proximity] >= proximityWeights[tx.proximity]) );
        }

        // wasConnected(): Have we already generated a peripheral object during a recent connection?
        function wasConnected(){
            return (Object.keys(self.peripheral).length != 0);
        }

        // hasTimedOut(): Is now later than session timeout specified by endpoint when it returned tx?
        function hasTimedOut(){
            return (Date.now() > self.peripheral.tx.expires);
        }

        // canOpenLink(): Are we transacting or completed? Is beacon Animist? Is proximity real?
        // All preconditions to opening a link. 
        function canOpenLink( beaconId, proximity ){
            if (self.state === self.stateMap.TRANSACTING) return self.state; 
            if (self.state === self.stateMap.COMPLETED)   return self.state;
            if (!verifyIsAnimist(beaconId))               return self.stateMap.NOT_ANIMIST;
            if (!verifyProximity(proximity))              return self.stateMap.PROXIMITY_UNKNOWN;

            return self.state;
        }

        // isAnimistSignal: Is this beacon signal in our endpoint map? This is a failsafe for bugs 
        // originating in AnimistBeacon where signal might be captured (due to developer modification)
        // that this service doesn't know about . . .
        function verifyIsAnimist(uuid){
            return endpointMap.hasOwnProperty(uuid);
        };

        // verifyProximity(): Is the proximity string one of three valid iOS proximity strings?
        function verifyProximity(val){

            return ( val === 'proximityImmediate' || 
                     val === 'proximityNear' ||
                     val === 'proximityFar' );

        };

        // encode(): Prep string for transmission over BLE.
        function encode(msg){
            msg = JSON.stringify(msg);
            msg = $cordovaBluetoothLE.stringToBytes(msg);
            return $cordovaBluetoothLE.bytesToEncodedString(msg);
        };

        // decode(): Turn BLE transmission into string.
        function decode(msg){
            msg = $cordovaBluetoothLE.encodedStringToBytes(msg);
            return $cordovaBluetoothLE.bytesToString(msg);
        };

        // parseCode(): Reverse map hex error codes received from endpoint on write response
        // to human-readable strings (See var codes at top).
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

    };

//})();