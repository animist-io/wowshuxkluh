angular.module('animist').service("AnimistBluetoothAuto", AnimistBluetoothAuto);

function AnimistBluetoothAuto($rootScope, $q, AnimistBluetoothCore, AnimistBluetoothAPI, AnimistAccount, AnimistConstants ){

    var self = this;
    var user = AnimistAccount;
    var core = AnimistBluetoothCore;
    var api = AnimistBluetoothAPI;

    var events = AnimistConstants.events;
    var UUID = AnimistConstants.serverCharacteristicUUIDs;
    var endpointMap = AnimistConstants.serverServiceUUIDs;

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


    //  ***** NOT SURE WHERE TO PUT THIS *****
    // $on('Animist:receivedTx'): Responds to a successful tx retrieval. Event is 
    // fired from subscribeGetContract. Checks proximity req and passes to autoSendTx for processing if  
    // ok OR closes the the connection to conserve resources and allow other clients to connect 
    // to the endpoint. 
    $rootScope.$on(events.receivedTx, function(){
        
        if (core.peripheral.tx){
            
            proximityMatch(core.peripheral.tx) ? 
                self.autoSendTx(core.peripheral.tx, customSignMethod ) : 
                core.close();

        // A failsafe that doesn't get called in the current code (someone might call it someday). 
        // The 'no tx' case is handled by rejection from subscribeGetContract . . . session gets killed 
        // in the openLink error callback. 
        } else { 
            core.endSession(); 
        }
    });

    // ------------------------------ Utilities --------------------------------------

    
    // proximityMatch(): Is current proximity nearer or equal to required proximity?
    function proximityMatch(tx){
        return ( tx && (proximityWeights[core.proximity] >= proximityWeights[tx.proximity]) );
    }

    // wasConnected(): Have we already generated a peripheral object during a recent connection?
    function wasConnected(){
        return (Object.keys(core.peripheral).length != 0);
    }

    // canOpenLink(): Are we transacting or completed? Is beacon Animist? Is proximity real?
    // All preconditions to opening a link. 
    function canOpenLink( beaconId, proximity ){
        if (core.state === core.stateMap.TRANSACTING) return core.state; 
        if (core.state === core.stateMap.COMPLETED)   return core.state;
        if (!verifyIsAnimist(beaconId))               return core.stateMap.NOT_ANIMIST;
        if (!verifyProximity(proximity))              return core.stateMap.PROXIMITY_UNKNOWN;

        return core.state;
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

    // -------------------------------------------------------------------------
    // ------------------------------- Public ----------------------------------
    // -------------------------------------------------------------------------
     
    // setCustomSignMethod(fn):
    //
    // The custom signing method should accept a single tx object as a param: { code: '90909...', etc...} 
    // and return a promise that resolves a raw transaction string. This facility allows the app to pass
    // the tx off the device for remote signing and return it for local submission. 
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
        
        var map = core.stateMap;
        var state = canOpenLink(beaconId, proximity);
        
        switch( state ){

            case map.TRANSACTING:       return state; 
            case map.COMPLETED:         return state;
            case map.NOT_INITIALIZED:   return state;
            case map.NOT_ANIMIST:       return map.NOT_ANIMIST;
            case map.PROXIMITY_UNKNOWN: return map.PROXIMITY_UNKNOWN;

            // Any connection errors below bubble back up to this handler 
            default:

                core.state = map.TRANSACTING;
                core.proximity = proximity;

                self.openLink(beaconId).then( null, function(fail){
                        
                    if (fail.error === NO_TX){
                        $rootScope.$broadcast(events.noTxFound, fail);
                        core.endSession();
                    } else {
                        $rootScope.$broadcast(events.bleFailure, fail);
                        core.reset();   
                    }     
                });
                return core.state;
        }
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

        var where = 'AnimistBluetoothAuto:openLink: ';
        var uuid = endpointMap[beaconId];
        
        // Case: First peripheral connection or session timed-out. Query endpoint
        // for relevant tx and wait. Broadcast "Animist:initiatedBLEConnection".
        if (!wasConnected()){
            
            // Scan, discover and try to get tx
            return core.scanConnectAndDiscover(uuid)
                .then(function(address){
  
                    $rootScope.$broadcast(events.initiatedBLE);

                    // MAC address from the scan, service from our endpointMap
                    core.peripheral.address = address;
                    core.peripheral.service = uuid;
                    
                    return api.getContract();
                })
                .catch(function(e){ return $q.reject(e) });  
    
        // Case: Cached, and we might reconnect w/ right proximity: 
        // Check this, connect and submit cached tx, then wait . . .
        } else if (proximityMatch(core.peripheral.tx )) {

            return core.connect(core.peripheral.address)
                .then(function(){ return $q.when( self.autoSendTx(core.peripheral.tx, customSignMethod )) })
                .catch(function(e){ return $q.reject(e)})
           
        
        // Case: Cached but proximity is wrong: Stay closed, keep cycling.
        } else {
            core.state = core.stateMap.CACHED;
            return $q.when(true);
        }   
    }

    // autoSendTx(): Called by $on("Animist:receivedTx") or openLink();
    // 
    // a) writes signed tx to endpoint if user is authorized to do so, OR
    // b) writes a request to confirm users presence at this loc. if a remote authority 
    //      will manage submitting the rest of tx elsewhere, OR
    // c) does nothing if there is no authority match. 
    //
    // Ends session on success & unauthorizedTx, resets on technical failure.
    // Broadcasts message specific to each of the above, including error.
    self.autoSendTx = function(tx, txMethod){
        
        var out = {};

        // Case: User can sign their own tx. Write tx & wait for response.
        // Broadcasts txHash of the autoSendTx or error
        if (tx.authority === user.address ) {

            out.tx = user.generateTx(tx.code, tx.state);
            out.id = tx.sessionId;

            core.write(out, UUID.sendTx).then(

                function(txHash){ 
                    $rootScope.$broadcast( events.sendTxSuccess, {txHash: txHash} ); 
                    core.endSession() }, 
                function(error) {
                     $rootScope.$broadcast( events.sendTxFailure, {error: error} ); 
                     core.reset() }
            );

        // Case: Signing remote (via txMethod) but submission local - Write tx & wait for response.
        // Broadcasts txHash of the sendTx or error.
        } else if ( txMethod != undefined && typeof txMethod === 'function'){

            txMethod(tx).then(function(signedCode){

                out.tx = signedCode;
                out.id = tx.sessionId;

                    core.write(out, UUID.sendTx).then(

                        function(txHash){ 
                            $rootScope.$broadcast( events.sendTxSuccess, {txHash: txHash} ); 
                            core.endSession() }, 
                        function(error) {
                            $rootScope.$broadcast( events.sendTxFailure, {error: error} ); 
                            core.reset() }
                    );

            }, function(error){
                $rootScope.$broadcast( events.sendTxMethodFailure, {error: error} ); 
                core.endSession();
            });


        // Case: Signing & submission will be remote - Write endpoint to validate presence & wait for response.
        // Broadcasts txHash of the endpoint's verifyPresence transaction or error.
        } else if ( tx.authority === user.remoteAuthority){

            out.id = tx.sessionId;
            out.pin = user.sign(core.peripheral.pin);

            core.write(out, UUID.verifyPresence).then(
                
                function(txHash){ 
                    $rootScope.$broadcast( events.verifyPresenceSuccess, {txHash: txHash} ); 
                    core.endSession() },
                function(error){  
                    $rootScope.$broadcast( events.verifyPresenceFailure, {error: error} );
                    core.reset() }
            );

        // Case: No one here is authorized (Bad api key etc . . .)
        // Broadcasts unauthorized error
        } else {

            $rootScope.$broadcast( events.unauthorizedTx );
            core.endSession();
        }
    };
};