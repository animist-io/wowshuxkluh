"use strict"

/*--------------------------------------------------------------------------------------------------- 
SERVICE: AnimistBLE
Author: cgewecke June 2016

This service manages interactions between mobile clients and Animist IoT endpoints 
(at: animist-io/whale-island) over Bluetooth LE. Design overview below:

1. Endpoints broadcast a persistent beacon signal which will wake a mobile client up
   and activate AnimistBLE via the client's beacon capture callback. (See AnimistBeacon )

2. AnimistBLE matches the beacon uuid to a pre-determined endpoint service uuid and uses this
   to establish a BLE peripheral connection / read the endpoint's time-variant "pin".  

3. AnimistBLE signs the pin with the private key of the current AnimistAccount and writes this value to 
   the endpoint's 'getContract' characteristic. The endpoint extracts the public account address from the 
   pin message and searches its database of contracts for any that match the calling account. 
   (There should only be one).

4. The endpoint sends back an object consisting of contract code, a proximity requirement, a 
   sessionId, a session expiration date, and the address specified as the contracts
   'authority' e.g. the address the contract expects to sign the tx. 

5. At this point ( assuming contract requirements about proximity are met ) there are three possiblities:  

   a) The user is authorized to sign their own transaction: AnimistBLE transmits code signed w/ the user key,
      and receives the Ethereum transaction hash for the mined operation. 
    
   b) Someone other than the user (like the App provider) needs to sign the transaction - it gets sent 
      to the cloud and returns signed. AnimistBLE submits this to the endpoint and gets the hash. 

   c) Like b), but the signed transaction will get submitted off device at another Ethereum node. AnimistBLE 
      just asks the endpoint to write an authentication tx to the blockchain verifying the client's presence at 
      this location. (Also gets a hash).

For more on account details and client behavior re: contracts, see animist-io/wowshuxkluh/src/accounts.js
For more on endpoint behavior see animist-io/whale-island
For more on simple Animist contract patterns and contract generation tools, see animist-io/wallowa.
-----------------------------------------------------------------------------------------------------*/

angular.module('animist')
  .service("AnimistBLE", AnimistBLE);

function AnimistBLE($rootScope, $q, $cordovaBluetoothLE, AnimistAccount ){

    // Local ref to AnimistAccount user, set in initialize()
    var user = null; 
    
    // Events 
    var events = {
        initiatedBLE: 'Animist:initiatedBLEConnection',
        receivedTx: 'Animist:receivedTx',
        signedTxSuccess: 'Animist:signedTxSuccess',
        signedTxFailure: 'Animist:signedTxFailure',
        signedTxMethodFailure: 'Animist:signedTxMethodFailure',
        authTxSuccess: 'Animist:authTxSuccess',
        authTxFailure: 'Animist:authTxFailure',
        unauthorizedTx: 'Animist:unauthorizedTx',
        noTxFound: 'Animist:noTxFound',
        bleFailure: 'Animist:bleFailure'
    };

    // Endpoint characteristic UUIDS
    var UUID = {
        pin : 'C40C94B3-D9FF-45A0-9A37-032D72E423A9',
        getContract:  'BFA15C55-ED8F-47B4-BD6A-31280E98C7BA',
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
       NO_TX_ADDR_ERR:            0x05,
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

    // Method returning a promise which overrides default signing methods in submit tx.
    // Set via AnimistBLE.setCustomSignMethod()
    var customSignMethod = undefined;


    // ------------------------------ Utilities --------------------------------------

    // proximityMatch(): Is current proximity nearer or equal to required proximity?
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

    // isAnimistSignal: Is this beacon signal in our endpoint map? This is a check for bugs 
    // originating in AnimistBeacon where signal might be captured that this service doesn't 
    // know about . . .
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

    // -------------------------------------------------------------------------
    // ------------------------------- Public ----------------------------------
    // -------------------------------------------------------------------------

    var self = this;

    self.peripheral = {};  // Obj representing the animist endpoint we connect to.
    self.proximity;        // Current proximity passed to us by AnimistBeacon via listen()
 
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

    // setCustomSignMethod(fn):
    //
    // fn(tx) should accept a single tx object as a param: { code: '90909...', expires: '...', etc...} 
    // and return a promise that resolves a string representing the signed code. This allows the app to pass
    // the tx off the device for remote signing and return it for local submission. Keep in mind
    // that background run times on iOS can be capped at ~7 seconds if the app is actively
    // backgrounded on the device. (They are closer to 90 sec if the app gets launched from
    // death.) You can approximate your position in this time window by keeping track of the first 
    // "Animist:initiatedBLEConnection" event and comparing it with present time. Rejecting from this
    // method will endSession() e.g. client will not reconnect to peripheral while it is in the
    // current beacon region unless you explicitly call AnimistBLE.reset();
    self.setCustomSignMethod = function( fn ){
        customSignMethod = fn;
    }

    // listen(): 'Listening' to beacons in the Beacon capture callback and getting hit continously.
    // Gate keeps the endpoint connection. Rejects if beaconId doesn't map to known 
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

            // Any connection errors below bubble back up to this handler 
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
    // -------------------  Link and Tx Submission Mgmt ----------------------------------
    // -----------------------------------------------------------------------------------

    // openLink(): Called by listen(). 
    // a) Attempts to open a new connection if session is fresh & broadcasts initiatedBLE event, OR
    // b) closes the connection and resets if the session has timed out, OR 
    // c) reconnects if mobile client already got tx and has finally met proximity requirement, OR
    // d) does nothing if client has tx but still hasn't met a proximity requirement.
    self.openLink = function( beaconId ){

        var where = 'AnimistBLE:openLink: ';
        var d = $q.defer();
        var uuid = endpointMap[beaconId];
        
        // Case: First peripheral connection or session timed-out. Query endpoint
        // for relevant tx and wait. Broadcast "Animist:initiatedBLEConnection".
        if (!wasConnected()){
            
            // Scan, discover and try to get tx
            self.scanConnectAndDiscover(uuid).then(function(address){
  
                $rootScope.$broadcast(events.initiatedBLE);

                // MAC address from the scan, service from our endpointMap
                self.peripheral.address = address;
                self.peripheral.service = uuid;
                
                self.readPin().then(function(){ 
                    self.subscribeGetContract().then(function(){
                                
                        d.resolve();
                    
                    }, function(e){ d.reject(e)}) 
                }, function(e){ d.reject(e)}) 
            }, function(e){ d.reject(e)});  

        // Case: Cached tx but session is stale. This means user connected but never got close
        // enough to endpoint to meet the contract req. Start again w/ a hard reset.
        } else if (hasTimedOut()){

            self.reset();
            d.resolve();

        // Case: Cached, session current and we might reconnect w/ right proximity: 
        // Check this, connect and submit cached tx, then wait . . .
        } else if (proximityMatch(self.peripheral.tx )) {

            self.connect(self.peripheral.address).then(function(){  
                self.submitTx(self.peripheral.tx, customSignMethod );
                
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
    // Ends session on success & unauthorizedTx, resets on technical failure.
    // Broadcasts message specific to each of the above, including error.
    self.submitTx = function(tx, txMethod){
        
        var out = {};

        // Case: User can sign their own tx. Write tx & wait for response.
        // Broadcasts txHash of the signedTx or error
        if (tx.authority === user.address ) {

            out.tx = user.generateTx(tx.code, tx.state);
            out.id = tx.sessionId;

            self.writeTx(out, UUID.signTx).then(

                function(txHash){ 
                    $rootScope.$broadcast( events.signedTxSuccess, {txHash: txHash} ); 
                    self.endSession() }, 
                function(error) {
                     $rootScope.$broadcast( events.signedTxFailure, {error: error} ); 
                     self.reset() }
            );

        // Case: Signing remote (via txMethod) but submission local - Write tx & wait for response.
        // Broadcasts txHash of the signedTx or error.
        } else if ( txMethod != undefined && typeof txMethod === 'function'){

            txMethod(tx).then(function(signedCode){

                out.tx = signedCode;
                out.id = tx.sessionId;

                    self.writeTx(out, UUID.signTx).then(

                        function(txHash){ 
                            $rootScope.$broadcast( events.signedTxSuccess, {txHash: txHash} ); 
                            self.endSession() }, 
                        function(error) {
                            $rootScope.$broadcast( events.signedTxFailure, {error: error} ); 
                            self.reset() }
                    );

            }, function(error){
                $rootScope.$broadcast( events.signedTxMethodFailure, {error: error} ); 
                self.endSession();
            });


        // Case: Signing & submission will be remote - Write endpoint to validate presence & wait for response.
        // Broadcasts txHash of the endpoint's authTx or error.
        } else if ( tx.authority === user.remoteAuthority){

            out.id = tx.sessionId;
            out.pin = user.sign(self.pin);

            self.writeTx(out, UUID.authTx).then(
                
                function(txHash){ 
                    $rootScope.$broadcast( events.authTxSuccess, {txHash: txHash} ); 
                    self.endSession() },
                function(error){  
                    $rootScope.$broadcast( events.authTxFailure, {error: error} );
                    self.reset() }
            );

        // Case: No one here is authorized (Bad api key etc . . .)
        // Broadcasts unauthorized error
        } else {

            $rootScope.$broadcast( events.unauthorizedTx );
            self.endSession();
        }
    };

    
    // ------------------------- receivedTX Event  -----------------------------------

    // $on('Animist:receivedTx'): Responds to a successful tx retrieval. Event is 
    // fired from subscribeGetContract. Checks proximity req and passes to submitTx for processing if  
    // ok OR closes the the connection to conserve resources and allow other clients to connect 
    // to the endpoint. 
    $rootScope.$on(events.receivedTx, function(){
        
        if (self.peripheral.tx){
            
            proximityMatch(self.peripheral.tx) ? 
                self.submitTx(self.peripheral.tx, customSignMethod ) : 
                self.close();

        // A failsafe that doesn't get called in the current code (someone might call it someday). 
        // The 'no tx' case is handled by rejection from subscribeGetContract . . . session gets killed 
        // in the openLink error callback. 
        } else { 
            self.endSession(); 
        }
    });

    // -------------------- BLE Central Connect/Disconnect  ----------------------

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
        
            function(error){  d.reject({where: where, error: error}) },
            function(scan){         

                // Stop Scan on Success per randDusing best practice. 
                if (scan.status === 'scanResult'){
                    $cordovaBluetoothLE.stopScan().then(function(){ 
                        
                        
                        openParams = {address: scan.address, timeout: 5000};
                        closeParams = { address: scan.address };

                        // Connect : close on failure per randDusing best practice
                        $cordovaBluetoothLE.connect(openParams).then( null,
                           
                            function(error){
                                $cordovaBluetoothLE.close(closeParams);
                                d.reject({where: where, error: error});
                            },

                            // Connected -> Discover & resolve address
                            function(connected){
                                $cordovaBluetoothLE.discover(openParams).then(
                                    
                                    function(device){  
                                        d.resolve(scan.address) 
                                    },
                                    function(error){
                                        $cordovaBluetoothLE.close(closeParams);
                                        d.reject({where: where, error: error});
                                    }
                                );
                            }
                        );
                    // Stop scan failed
                    }, function(error){ d.reject({where: where, error: error}) });  
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
    // (Successful connection declares via notify callback )
    self.connect = function( address ){

        var where = 'AnimistBLE:connect: '
        var d = $q.defer();

        // Connect : Close on failure per rand dusing best practice
        $cordovaBluetoothLE.connect({address: address, timeout: 5000}).then(null,
           
            function(error){
                $cordovaBluetoothLE.close({address: address});
                d.reject({where: where, error: error});
            },

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
    // for / resolves the Ethereum tx hash of completed transaction. (Succesful subscription 
    // declares via notify callback)
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

        // Subscribe
        $cordovaBluetoothLE.subscribe(req).then(null,

            function(error){ d.reject({where: where, error: error})},
            
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

    // subscribeGetContract(): subscribes to GetContract characteristic, then signs the endpoint pin and
    // writes it back. Endpoint deciphers this and searches its db for qualifying contract code.
    // If contract is found it will respond RESULT_SUCCESS (0x00) to our write success callback and begin
    // transmitting packets to us in the subscription callback. We broadcast 'Animist:receivedTx' 
    // on success or reject through the write error callback on error.  
    self.subscribeGetContract = function(){
        
        var decoded, signedPin, msg = '';
        var where = 'AnimistBLE:subscribeGetContract: ';
        var d = $q.defer();
            
        var req = {
            address: self.peripheral.address,
            service: self.peripheral.service,
            characteristic: UUID.getContract,
            timeout: 5000
        };

        // Subscribe
        $cordovaBluetoothLE.subscribe(req).then(null, 

            function(error){ d.reject({where: where, error: error})},
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
                        d.resolve();
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
        $cordovaBluetoothLE.read(req).then(function(pin){ 
        
            self.pin = decode(pin.value); 
            d.resolve()
        
        }, function(error){ d.reject({where: where, error: error})});
        
        return d.promise;
    };



    // Remote Meteor Debugging
    function logger(msg, obj){
        //(Meteor) ? 
        //    Meteor.call('ping', msg + ' ' + JSON.stringify(obj)) : 
            console.log(msg + '' + JSON.stringify(obj));
    }

};

//})();