var api_debug;

angular.module('animist').service("AnimistBluetoothAPI", AnimistBluetoothAPI);

/**
 * @ngdoc service
 * @module  animist
 * @name  animist.service:AnimistBlueToothAPI
 * @description  Methods to access whale-island Bluetooth LE endpoints
 */
function AnimistBluetoothAPI($rootScope, $q, AnimistAccount, AnimistConstants, AnimistBluetoothCore ){

    var self = this;
    var UUID = AnimistConstants.serverCharacteristicUUIDs;
    var events = AnimistConstants.events;
    var user = AnimistAccount;
    var core = AnimistBluetoothCore;
    var ethUtil = ethereumjs.util;

    // ------------------------------ Public (non-pin) Server Endpoints  ----------------------------
     
    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description  Reads the value of the pin characteristic. This updates every ~30sec and a client
     *               signed copy of it is required to access some of the server's endpoints. It's used 
     *               to help verify client is present 'in time'.
     * @name  animist.service:AnimistBluetoothAPI.getPin 
     * @returns {Promise} Resolves string: 32 character alpha-numeric pin, rejects w/ error object
     */
    self.getPin = function(){ 
        return core.read(UUID.getPin)
            .then( function(res){ return core.peripheral.pin = JSON.parse(res) })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description  Reads a PGP keyID that can be used to feth the node's public PGP key from
     *               `https://pgp.mit.edu.'  Encryption is required to write to several of 
     *               whale-island's endpoints including `verifyPresence`, verifyPresenceAndSendTx`, `sendTx`, and 
     *              `readWithConfirmation`
     * @name  animist.service:AnimistBluetoothAPI.getPgpKeyId
     * @returns {Promise} Resolves string: a PGP keyID. Rejects w/ error object
     */
    self.getPgpKeyId = function(){ 
        return core.read(UUID.getPgpKeyId)
            .then( function(res){ return core.peripheral.pgpKeyId = JSON.parse(res) })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description  Gets Animist node's public account address (and caches it in core.peripheral). 
     *               This address identifies the node in IPFS and is the account used to execute Animist 
     *               contract API methods on client's behalf. 
     * @name  animist.service:AnimistBluetoothAPI.getDeviceAccount
     * @return {Promise} Resolves string: Hex prefixed address, rejects with error object 
     */
    self.getDeviceAccount = function(){
        return core.read(UUID.getDeviceAccount)
            .then( function(res){ return core.peripheral.deviceAccount = JSON.parse(res) })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description  Gets current blockNumber (and caches it in core.peripheral).
     * @name  animist.service:AnimistBluetoothAPI.getBlockNumber 
     * @return {Promise} Resolves string: web3.eth.blockNumber, rejects with error object
     */
    self.getBlockNumber = function(){
        return core.read(UUID.getBlockNumber)
            .then( function(res){ return core.peripheral.blockNumber = parseInt(JSON.parse(res)) })
            .catch( function(err){ return $q.reject(err) });
    } 

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description     Gets small subset of web3 data about a transaction. Useful for determining if 
     *                  a transaction has been mined yet. (blockNumber will be null if tx is pending.) 
     * @name  animist.service:AnimistBluetoothAPI.getTxStatus 
     * @param  {String} txHash : hex prefixed transaction hash.
     * @return {Promise} Resolves obj: `{ blockNumber: "150..1", nonce: "77", gas: "314..3" }` OR null.
     *                   Rejects w/ error obj.
     */
    self.getTxStatus = function(txHash){
        return core.write(txHash, UUID.getTxStatus)
            .then( function(res){ return JSON.parse(res) })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description Retrieves account balance of `address` in wei (as a BigNumber object).
     * @name  animist.service:AnimistBluetoothAPI.getAccountBalance 
     * @param  {String} address : hex prefixed account address
     * @return {Promise} Resolves BigNumber, rejects with error object
     */
    self.getAccountBalance = function(address){
        return core.write(address, UUID.getAccountBalance)
            .then( function(res){ return new ethUtil.BN(JSON.parse(res)) })
            .catch( function(err){ return $q.reject(err) });
    }

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description  Equivalent to making a web.eth.call for unsigned public constant methods.
     *               Useful for retrieving data from a contract 'synchronously'.
     * @name  animist.service:AnimistBluetoothAPI.callTx 
     * @param  {Object} tx `{to: '0x929...ae', data: '0xae45...af'}`
     * @return {Promise} Resolves string: result of web3.eth.call(tx). ('0x' on fail). Rejects with error object
     */
    self.callTx = function(tx){
        return core.write(tx, UUID.callTx)
            .then( function(res){ return JSON.parse(res) })
            .catch( function(err){ return $q.reject(err) });
    }

    // ------------------------------------ PIN-Access Server Endpoints  --------------------------------
    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description   Gets a new sessionId (linked to caller account) from server. This id required to use the 
     *                sendTx endpoint.
     * @name  animist.service:AnimistBluetoothAPI.getNewSessionId 
     * @return {Promise} Resolves obj: `{ sessionId: "a34..4q', expires: '435...01', account: '0x78ef..a' }` OR null.
     *                   Rejects with error object.
     */
    self.getNewSessionId = function(){

        var d = $q.defer();
        
        self.getPin().then(function(pin){
            pin = user.sign(pin);
            core.write(pin, UUID.getNewSessionId)
                .then(function(res){ d.resolve( JSON.parse(res) ) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description  Returns data that can be used to authenticate client's proximity to the animist node. 
     *               Response includes a timestamp, the timestamp signed by the device account, and the caller's 
     *               address signed by the device account (using web3.sign). This method is useful
     *               if you wish implement your own presence verification strategy in contract code and
     *               can run an ethereum light-client on your client's device, or have a server that can 
     *               independently validate this data.
     * @name  animist.service:AnimistBluetoothAPI.getPresenceReceipt 
     * @return {Promise} Resolves obj: `{time: '1453...9', signedTime: '0xaf..9e', signedAddress: '0x32...ae'}` OR null.
                         Rejects with error object
    */
    self.getPresenceReceipt = function(){
        var d = $q.defer();
        
        self.getPin().then(function(pin){
            pin = user.sign(pin);
            core.write(pin, UUID.getPresenceReceipt)
                .then(function(res){ d.resolve( JSON.parse(res) ) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description  Gets the hash of a transaction submitted by an atomic verifyPresenceAndSendTx request. 
     *               Hash is available once the authTx has been mined and caller's transaction has been 
     *               published to chain. Also returns verifPresenceStatus data which may be 'pending' or 'failed' 
     *               if verifyPresence is unmined or ran out of gas.
     * @name  animist.service:AnimistBluetoothAPI.getClientTxStatus 
     * @return {Promise} Resolves obj or rejects with error.
     * @example `{verifyPresenceStatus: "success", verifyPresenceTxHash: "0x7d..3", clientTxHash: "0x32..e" }` OR null.
     */
    self.getClientTxStatus = function(){

        var d = $q.defer();
        
        self.getPin().then(function(pin){
            pin = user.sign(pin);
            core.write(pin, UUID.getClientTxStatus)
                .then(function(res){ d.resolve( JSON.parse(res) ) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description  Retrieves contract code from animist device. This will be available if the contract
     *               broadcast an event to the node when it was deployed (or afterwards), specifying the callers account
     *               as a contract participant. 
     * @name  animist.service:AnimistBluetoothAPI.getContract 
     * @return {Promise} Resolves obj: `{code: '0xa34..f', sessionId: 'a4tf..x', expires: '1543..0'}` OR null
     *                   Rejects with error object.
     */
    self.getContract = function(){

        var d = $q.defer();
        
        self.getPin().then(function(pin){
            
            pin = user.sign(pin);
            core.writeWithLongResponse(pin, UUID.getContract)
                .then(function(res){ 
                    core.peripheral.tx = JSON.parse(res);
                    $rootScope.$broadcast( events.receivedTx );
                    d.resolve(JSON.parse(res) ) 
                })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description  Authenticates client's proximity to animist node by invoking their contract's "verifyPresence" 
     *               method with the device account. Returns transaction hash.
     * @name  animist.service:AnimistBluetoothAPI.verifyPresence 
     * @return {Promise} Resolves string: transaction hash OR null, rejects with error object
     */
    self.verifyPresence = function(){
        var d = $q.defer();
        
        self.getPin().then(function(pin){
            pin = user.sign(pin);
            core.write(pin, UUID.verifyPresence)
                .then(function(res){ d.resolve( JSON.parse(res) ) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }

    /**
     * @ngdoc method
     * @methodOf animist.service:AnimistBluetoothAPI
     * @description  Authenticates client's proximity to animist node by invoking their contract's "verifyPresence" 
     *               method with the device account. Waits for presence verification to be mined and sends client's 
     *               raw transaction.  This method provides a way of authenticating client's proximity to the node
     *               and sending a transaction in a single step.        
     * @name  animist.service:AnimistBluetoothAPI.verifyPresenceAndSendTx 
     * @param  {String} rawTx : transaction signed by the user. 
     * @return {Promise} Resolves string: authTx hash OR null, rejects with error object
     */
    self.verifyPresenceAndSendTx = function(rawTx){
        var d = $q.defer();
        
        self.getPin().then(function(pin){
            pin = user.sign(pin);
            core.write({pin: pin, tx: rawTx}, UUID.verifyPresenceAndSendTx)
                .then(function(res){ d.resolve( JSON.parse(res) ) })
                .catch(function(err){ d.reject(err) })

        }).catch(function(err){ d.reject(err)})

        return d.promise;
    }
}