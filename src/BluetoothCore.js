angular.module('animist').service("AnimistBluetoothCore", AnimistBluetoothCore);

function AnimistBluetoothCore($rootScope, $q, $cordovaBluetoothLE, AnimistConstants ){

    var self = this;

    // ------------------------------ Public Vars --------------------------------------
    
    // Obj representing the animist endpoint we connect to.
    self.peripheral = {};

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

    // ------------------------------ Utilities --------------------------------------
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

    // -------------------------- Core Service Initialization  -------------------------
    // initialize(): Must be called before listen() can begin. Validates user
    // object then hardware inits via $cordovaBLE
    self.initialize = function(){

        var where = 'AnimistBLE:initialize: ';
        var d = $q.defer();
    
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
        
        return d.promise;
    };

    // -------------------------- Connection Opening Methods  -------------------------
    // 
    //  scanConnectAndDiscover(serviceUUID): Wraps a set of sequential calls to
    //  $cordovaBluetoothLE ::scan() ::connect() ::discover(). This is boiler plate
    //  necessary for an inital connection even if we know service uuid and 
    //  characteristics (on iOS at least.) Resolves MAC address of endpoint or rejects.
    //  Note: Scan, discover and connect all 'succeed' via the notify callback rather than 
    //  resolve.
    self.scanConnectAndDiscover = function(serviceUUID){

        var where = 'AnimistBluetoothCore:scanConnectAndDiscover: '
        var d = $q.defer();
        var openParams, closeParams;

        // Start Scanning . . .
        $cordovaBluetoothLE.startScan( { services: [serviceUUID] }).then(null,
        
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

    // connect(): AnimistBluetoothCore wrapper for $cordovaBluetoothLE:connect()
    // This is called when we have already connected during a session and
    // do not need to go through scan/connect/discover process to access
    // characteristics. Use cases are: when a proximity that was inadequate
    // meets the cached txs requirement & technical disconnections. 
    // (Successful connection declares via notify callback )
    self.connect = function( address ){

        var where = 'AnimistBluetoothCore:connect: '
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

    // ------------------ Connection Closing Methods -----------------------------
 
    // close(): Called on its own when a transaction is first discovered but the 
    // the proximity requirement hasn't been met. Closing frees up the endpoint 
    // for other clients and minimizes likelyhood of our connection timing out. 
    // AnimistBeacon will continue to ping us w/ new proximity 
    // readings; these get parsed in openLink() to determine if we should reconnect. 
    self.close = function(){
        var where = "AnimistBluetoothCore:close: ";
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

        var where = "AnimistBluetoothCore:reset: ";

        $cordovaBluetoothLE.close({address: self.peripheral.address}).
        then().finally(function(result){

            self.peripheral = {}; 
            self.state = self.stateMap.INITIALIZED;
        });          
    };

    // ----------------Characteristic Subscriptions/Reads/Writes -----------------------------
    
    /**
     * Reads data from server endpoint
     * @param  {String} dest : characteristic uuid of server endpoint
     * @return {Promise} Resolves success response 
     * @return {Promise} Rejects with error object
     */
    self.read = function(dest){

        var where = 'AnimistBluetoothCore:read: ' + dest;
        
        // Compose subscribe req to characteristic
        var req = {
            address: self.peripheral.address,
            service: self.peripheral.service,
            characteristic: dest,
            timeout: 5000
        }; 

        // Decode response and update pin value
        return $cordovaBluetoothLE.read( req )
            .then(function(res){  return decode(res.value) }) 
            .catch(function(err){ return $q.reject( { where: where, error: parseCode(err) } )})   
    }

    /**
     * Subscribes to characteristic, writes query or message to Animist node ("out") and resolves the response.
     * @method  write
     * @param  {(String|Object)} out : the query or message to encode and send
     * @param  {String} dest : characteristic uuid of server endpoint
     * @return {Promise} Resolves success response 
     * @return {Promise} Reject with error object
     */
    self.write = function(out, dest){
    
        var where = 'AnimistBluetoothCore:write: ' + dest;
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
                        function(error){ d.reject({where: where, error: parseCode(error) })}
                    );

                // Notification handler: resolves txHash
                } else {
                    d.resolve( decode(sub.value) );
                };
            }
        ); 
        return d.promise;
    };

    /**
     * Subscribes to characteristic, writes query or message to Animist node ("out") and resolves the response.
     * (This method used when the expected return data length exceeds maximum packet sizes. It waits until an EOF 
     * signal to resolve).
     * @method  write
     * @param  {(String|Object)} out : the query or message to encode and send
     * @param  {String} dest : characteristic uuid of server endpoint
     * @return {Promise} Resolves success response 
     * @return {Promise} Reject with error object
     */
    self.writeWithLongResponse = function(out, dest){

        var decoded, signedPin, msg = '';
        var where = 'AnimistBluetoothCore:writeWithLongResponse: ' + dest;
        var d = $q.defer();
            
        var req = {
            address: self.peripheral.address,
            service: self.peripheral.service,
            characteristic: dest,
            timeout: 5000
        };

        // Subscribe
        $cordovaBluetoothLE.subscribe(req).then(null, 

            function(error){ d.reject({where: where, error: error})},
            function(sub){ 

                // Subscribed: write to characteristic wait for notify response. 
                // Reject on NO TX FOUND or other error. 
                if (sub.status === 'subscribed'){

                    req.value = encode(out);

                    $cordovaBluetoothLE.write(req).then(
                        function(success){}, 
                        function(error){d.reject({where: where, error: parseCode(error) })}
                    );

                // Notification handler: Assembles transmission and
                // broadcasts receivedTx event when message is EOF
                } else {
                    decoded = decode(sub.value);
                    
                    (decoded != 'EOF')
                        ? msg += decoded
                        : d.resolve(msg)
                };
            }
        );
        return d.promise;
    }
}