"use strict"

angular.module('animist').service("AnimistBLE", AnimistBLE);

function AnimistBLE($rootScope, $q, $cordovaBluetoothLE, AnimistAccount, AnimistConstants ){

    // Local ref to AnimistAccount user, set in initialize()
    var user = null; 
    
    // Platform Data and Module Constants 
    var events = AnimistConstants.events;
    var UUID = AnimistConstants.serverCharacteristicUUIDs;
    var endpointMap = AnimistConstants.serverServiceUUIDs;
    var codes = AnimistConstants.serverHexCodes;

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

        var NO_TX = 'NO_TX_DB_ERR';
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
                
                self.getPin().then(function(){ 
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
                self.sendTx(self.peripheral.tx, customSignMethod );
                
                d.resolve();

            }, function(e){ d.reject(e)}); 
        
        // Case: Cached but proximity is wrong: Stay closed, keep cycling.
        } else {
            self.state = self.stateMap.CACHED;
            d.resolve();
        }   
        
        return d.promise;
    }

    // sendTx(): Called by $on("Animist:receivedTx") or openLink();
    // 
    // a) writes signed tx to endpoint if user is authorized to do so, OR
    // b) writes a request to confirm users presence at this loc. if a remote authority 
    //      will manage submitting the rest of tx elsewhere, OR
    // c) does nothing if there is no authority match. 
    //
    // Ends session on success & unauthorizedTx, resets on technical failure.
    // Broadcasts message specific to each of the above, including error.
    self.sendTx = function(tx, txMethod){
        
        var out = {};

        // Case: User can sign their own tx. Write tx & wait for response.
        // Broadcasts txHash of the sendTx or error
        if (tx.authority === user.address ) {

            out.tx = user.generateTx(tx.code, tx.state);
            out.id = tx.sessionId;

            self.write(out, UUID.sendTx).then(

                function(txHash){ 
                    $rootScope.$broadcast( events.sendTxSuccess, {txHash: txHash} ); 
                    self.endSession() }, 
                function(error) {
                     $rootScope.$broadcast( events.sendTxFailure, {error: error} ); 
                     self.reset() }
            );

        // Case: Signing remote (via txMethod) but submission local - Write tx & wait for response.
        // Broadcasts txHash of the sendTx or error.
        } else if ( txMethod != undefined && typeof txMethod === 'function'){

            txMethod(tx).then(function(signedCode){

                out.tx = signedCode;
                out.id = tx.sessionId;

                    self.write(out, UUID.sendTx).then(

                        function(txHash){ 
                            $rootScope.$broadcast( events.sendTxSuccess, {txHash: txHash} ); 
                            self.endSession() }, 
                        function(error) {
                            $rootScope.$broadcast( events.sendTxFailure, {error: error} ); 
                            self.reset() }
                    );

            }, function(error){
                $rootScope.$broadcast( events.sendTxMethodFailure, {error: error} ); 
                self.endSession();
            });


        // Case: Signing & submission will be remote - Write endpoint to validate presence & wait for response.
        // Broadcasts txHash of the endpoint's authTx or error.
        } else if ( tx.authority === user.remoteAuthority){

            out.id = tx.sessionId;
            out.pin = user.sign(self.peripheral.pin);

            self.write(out, UUID.authTx).then(
                
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

    // -------------------- Public (non-pin) Server Endpoints  ----------------------------
    
    // getPin: Reads the value of the pin characteristic. This updates constantly on the 
    // endpoint side and is used to verify that mobile client is present 'in time'. This
    // pin will get signed by the user and returned to endpoint for transaction search and
    // auth requests. 
    
    /**
     * Reads the value of the pin characteristic. This updates every ~30sec and a client
     * signed copy of it is required to access some of the server's endpoints. It's used 
     * to help verify client is present 'in time'.
     * @method  getPin 
     * @return {String} 32 character alpha-numeric pin
     */
    self.getPin = function(){ 
        return self.read(UUID.getPin)
            .then( function(res){ return self.peripheral.pin = res })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * Gets Animist node's public account address (and caches it in self.peripheral). 
     * This address identifies the node in IPFS and is the account used to execute Animist 
     * contract API methods on client's behalf. 
     * @method  getDeviceAccount
     * @return {String} Hex prefixed address string
     */
    self.getDeviceAccount = function(){
        return self.read(UUID.getDeviceAccount)
            .then( function(res){ return self.peripheral.deviceAccount = res })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * Gets current blockNumber (and caches it in self.peripheral). 
     * @return {Number} web3.eth.blockNumber
     */
    self.getBlockNumber = function(){
        return self.read(UUID.getBlockNumber)
            .then( function(res){ return self.peripheral.blockNumber = parseInt(res) })
            .catch( function(err){ return $q.reject(err) });
    } 

    /**
     * Gets small subset of web3 data about a transaction. Useful for determining if 
     * a transaction has been mined yet. (blockNumber will be null if tx is pending.) 
     * @method  getTxStatus 
     * @param  {String} txHash : hex prefixed transaction hash.
     * @return {Object} { blockNumber: "150..1", nonce: "77", gas: "314..3" }
     * @return {String} 'null'
     */
    self.getTxStatus = function(txHash){
        return self.write(txHash, UUID.getTxStatus)
            .then( function(res){ return res })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * @method  getAccountBalance 
     * @param  {String} address : hex prefixed account address
     * @return {BigNumber} TO DO . . . . ethereumjs-util. . . .
     */
    self.getAccountBalance = function(address){
        return self.write(address, UUID.getAccountBalance)
            .then( function(res){ return res })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * Equivalent to making a web.eth.call for unsigned public constant methods.
     * Useful for retrieving data from a contract 'synchronously'.
     * @method  callTx 
     * @param  {Object} tx {to: '0x929...ae', code: '0xae45...af'}
     * @return {Value} web3.eth.call(tx)
     */
    self.callTx = function(tx){
        return self.write(tx, UUID.callTx)
            .then( function(res){ return res })
            .catch( function(err){ return $q.reject(err) });
    }

    // -------------------- PIN-Access Server Endpoints  --------------------------------
    
    self.getNewSessionId = function(){

        var d = $q.defer();
        
        self.getPin().then(function(pin){
            self.write(pin, UUID.getNewSessionId)
                .then(function(res){ d.resolve(res) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    self.getPresenceReceipt = function(){}
    self.getVerifiedTxHash = function(){}



    // ------------------------- receivedTX Event  -----------------------------------

    // $on('Animist:receivedTx'): Responds to a successful tx retrieval. Event is 
    // fired from subscribeGetContract. Checks proximity req and passes to sendTx for processing if  
    // ok OR closes the the connection to conserve resources and allow other clients to connect 
    // to the endpoint. 
    $rootScope.$on(events.receivedTx, function(){
        
        if (self.peripheral.tx){
            
            proximityMatch(self.peripheral.tx) ? 
                self.sendTx(self.peripheral.tx, customSignMethod ) : 
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
    
    // write(out, dest): 'out' is a json object to be transmitted. 'dest' is either the sendTx
    // or authTx characteristic uuid. Subscribes to characteristic, writes out and waits 
    // for / resolves the Ethereum tx hash of completed transaction. (Succesful subscription 
    // declares via notify callback)
    self.write = function(out, dest){
    
        var where = 'AnimistBLE:write: ';
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

                    signedPin = user.sign(self.peripheral.pin);
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


    self.read = function(uuid){

        var where = 'AnimistBLE:read: ' + uuid;
        
        // Compose subscribe req to characteristic
        var req = {
            address: self.peripheral.address,
            service: self.peripheral.service,
            characteristic: uuid,
            timeout: 5000
        }; 

        // Decode response and update pin value
        return $cordovaBluetoothLE.read( req )
            .then(function(res){  return decode(res.value) }) 
            .catch(function(err){ return $q.reject( {where: where, error: err} )})   
    }

    
    // Remote Meteor Debugging
    function logger(msg, obj){
        //(Meteor) ? 
        //    Meteor.call('ping', msg + ' ' + JSON.stringify(obj)) : 
            console.log(msg + '' + JSON.stringify(obj));
    }

};

//})();