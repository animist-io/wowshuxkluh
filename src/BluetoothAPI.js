angular.module('animist').service("AnimistBluetoothAPI", AnimistBluetoothAPI);

function AnimistBluetoothAPI($rootScope, $q, AnimistAccount, AnimistConstants, AnimistBluetoothCore ){

    var self = this;
    var UUID = AnimistConstants.serverCharacteristicUUIDs;
    var events = AnimistConstants.events;
    var user = AnimistAccount;
    var core = AnimistBluetoothCore;

    // ------------------------------ Public (non-pin) Server Endpoints  ----------------------------
     
    /**
     * Reads the value of the pin characteristic. This updates every ~30sec and a client
     * signed copy of it is required to access some of the server's endpoints. It's used 
     * to help verify client is present 'in time'.
     * @method  getPin 
     * @return {Promise} Resolves string: 32 character alpha-numeric pin
     * @return {Promise} Rejects with error object
     */
    self.getPin = function(){ 
        return core.read(UUID.getPin)
            .then( function(res){ return core.peripheral.pin = JSON.parse(res) })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * Gets Animist node's public account address (and caches it in core.peripheral). 
     * This address identifies the node in IPFS and is the account used to execute Animist 
     * contract API methods on client's behalf. 
     * @method  getDeviceAccount
     * @return {Promise} Resolves string: Hex prefixed address 
     * @return {Promise} Rejects with error object
     */
    self.getDeviceAccount = function(){
        return core.read(UUID.getDeviceAccount)
            .then( function(res){ return core.peripheral.deviceAccount = res })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * Gets current blockNumber (and caches it in core.peripheral). 
     * @return {Promise} Resolves string: web3.eth.blockNumber
     * @return {Promise} Rejects with error object
     */
    self.getBlockNumber = function(){
        return core.read(UUID.getBlockNumber)
            .then( function(res){ return core.peripheral.blockNumber = parseInt(res) })
            .catch( function(err){ return $q.reject(err) });
    } 

    /**
     * Gets small subset of web3 data about a transaction. Useful for determining if 
     * a transaction has been mined yet. (blockNumber will be null if tx is pending.) 
     * @method  getTxStatus 
     * @param  {String} txHash : hex prefixed transaction hash.
     * @return {Promise} Resolves obj.: { blockNumber: "150..1", nonce: "77", gas: "314..3" } OR null
     * @return {Promise} Rejects with error object
     */
    self.getTxStatus = function(txHash){
        return core.write(txHash, UUID.getTxStatus)
            .then( function(res){ return res })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * @method  getAccountBalance 
     * @param  {String} address : hex prefixed account address
     * @return {Promise} Resolves BigNumber
     * @return {Promise} Rejects with error object
     */
    self.getAccountBalance = function(address){
        return core.write(address, UUID.getAccountBalance)
            .then( function(res){ return new BigNumber(res) })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * Equivalent to making a web.eth.call for unsigned public constant methods.
     * Useful for retrieving data from a contract 'synchronously'.
     * @method  callTx 
     * @param  {Object} tx {to: '0x929...ae', data: '0xae45...af'}
     * @return {Promise} Resolves string: result of web3.eth.call(tx). ('0x' on fail)
     * @return {Promise} Rejects with error object
     */
    self.callTx = function(tx){
        return core.write(tx, UUID.callTx)
            .then( function(res){ return res })
            .catch( function(err){ return $q.reject(err) });
    }

    // ------------------------------------ PIN-Access Server Endpoints  --------------------------------
    /**
     * Gets a new sessionId (linked to caller account) from server. This id required to use the 
     * sendTx endpoint.
     * @method  getNewSessionId 
     * @return {Promise} Resolves obj. { sessionId: "a34..4q', expires: '435...01', account: '0x78ef..a' } OR null.
     * @return {Promise} Rejects with error object
     */
    self.getNewSessionId = function(){

        var d = $q.defer();
        
        self.getPin().then(function(pin){
            pin = user.sign(pin);
            core.write(pin, UUID.getNewSessionId)
                .then(function(res){ d.resolve(res) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    /**
     * Returns data that can be used to authenticate client's proximity to the animist node. 
     * Response includes a timestamp, the timestamp signed by the device account, and the caller's 
     * address signed by the device account (using web3.sign). This method is useful
     * if you wish implement your own presence verification strategy in contract code and
     * can run an ethereum light-client on your client's device, or have a server that can 
     * independently validate this data.
     * @method  getPresenceReceipt 
     * @return {Promise} Resolves obj. {time: '1453...9', signedTime: '0xaf..9e', signedAddress: '0x32...ae'} OR null.
       @return {Promise} Rejects with error object
    */
    self.getPresenceReceipt = function(){
        var d = $q.defer();
        
        self.getPin().then(function(pin){
            pin = user.sign(pin);
            core.write(pin, UUID.getPresenceReceipt)
                .then(function(res){ d.resolve(res) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    /**
     * Gets the hash of a transaction submitted by an atomic authAndSend request. 
     * Hash is available once the authTx has been mined and caller's transaction has been 
     * published to chain. Also returns authStatus data which may be 'pending' or 'failed' 
     * if authTx is unmined or ran out of gas.
     * @method getVerifiedTxHash 
     * @return {Promise} Resolves object {authStatus: "success", authTxHash: "0x7d..3", verifiedTxHash: "0x32..e" } OR null.
     * @return {Promise} Rejects with error object
     */
    self.getVerifiedTxHash = function(){

        var d = $q.defer();
        
        self.getPin().then(function(pin){
            pin = user.sign(pin);
            core.write(pin, UUID.getVerifiedTxHash)
                .then(function(res){ d.resolve(res) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    /**
     * Retrieves contract code from animist device. This will be available if the contract
     * broadcast an event to the node when it was deployed, specifying the callers account
     * as a contract participant. Because   
     * @method  getContract 
     * @return {Promise} Resolves object: {code: '0xa34..f', sessionId: 'a4tf..x', expires: '1543..0'} OR null
     * @return {Promise} Rejects with error object.
     */
    self.getContract = function(){

        var d = $q.defer();
        
        self.getPin().then(function(pin){
            
            pin = user.sign(pin);
            core.writeWithLongResponse(pin, UUID.getContract)
                .then(function(res){ 
                    core.peripheral.tx = res;
                    $rootScope.$broadcast( events.receivedTx );
                    d.resolve(res) 
                })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    /**
     * Authenticates client's proximity to animist node by invoking their contract's "verifyPresence" 
     * method with the device account. Returns transaction hash.
     * @method  authTx 
     * @return {Promise} Resolves string: transaction hash OR null.
     * @return {Promise} Rejects with error object
     */
    self.authTx = function(){
        var d = $q.defer();
        
        self.getPin().then(function(pin){
            pin = user.sign(pin);
            core.write(pin, UUID.authTx)
                .then(function(res){ d.resolve(res) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    /**
     * Authenticates client's proximity to animist node by invoking their contract's "verifyPresence" 
     * method with the device account. Waits for auth to be mined and sends clients raw transaction. 
     * This method provides a way of authenticating and sending a transaction in a single step.        
     * @method  authAndSendTx 
     * @param  {String} rawTx : transaction signed by the user. 
     * @return {Promise} Resolves string: authTx hash OR null.
     * @return {Promise} Rejects with error object
     */
    self.authAndSendTx = function(rawTx){
        var d = $q.defer();
        
        self.getPin().then(function(pin){
            pin = user.sign(pin);
            core.write({pin: pin, tx: rawTx}, UUID.authAndSendTx)
                .then(function(res){ d.resolve(res) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }
}