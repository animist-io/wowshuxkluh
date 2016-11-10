/**
 * @ngdoc service
 * @module  animist
 * @name  animist.service:AnimistPgp
 * @description  Methods to fetch a node's pgp key and encrypt transmissions.
 */
angular.module('animist').service("AnimistPgp", AnimistPgp);

function AnimistPgp($rootScope, $q, AnimistBluetoothCore ){

    var self = this;
    var here = 'AnimistPgp: ';

    // Locals
    var core = AnimistBluetoothCore;

    // Errors
    var codes = {
        NOT_INITIALIZED: here + 'Cannot encrypt - no public key for node',
    }

    /**
     * @ngdoc method
     * @methodOf animist.service.AnimistPgp
     * @description  Encrypts a plaintext message with whale-island's public key.
     * @name  animist.service:AnimistPgp.encrypt
     * @param  {String} data      plain text
     * @param  {String} publicKey `-----BEGIN PGP PUBLIC KEY BLOCK ... END PGP PUBLIC KEY BLOCK-----`
     * @return {Promise} Resolves an encrypted string or rejects.        
     */
    self.encrypt = function(data){
        var options;
    
        if (!core.peripheral.publicKey){
            return $q.reject(codes.NOT_INITIALIZED);
        } 
            
        try {      
            options = {
                data: data,
                publicKeys: npm.openpgp.key.readArmored(core.peripheral.publicKey).keys[0],
            };
            return npm.openpgp.encrypt(options).then(function(cipher){ 
                return cipher.data
            }); 

        } catch (err) {
            return $q.reject();
        }    
    }

    /**
     * @ngdoc method
     * @methodOf animist.service.AnimistPgp
     * @description  Returns pgp key associated with `keyId` at `https://pgp.mit.edu`
     * @name  animist.service:AnimistPgp.encrypt 
     * @param  {String} keyId 
     * @return {Promise} Resolves string key or rejects w/ error
    */
    self.getPublicKeyFromMIT = function(keyId){
        var hkp = new npm.openpgp.HKP('https://pgp.mit.edu');
        var d = $q.defer();
        
        hkp.lookup({ keyId: keyId })
            .then(function(key){
                d.resolve(key);
                $rootScope.$apply();
            })
            .catch(function(err){
                d.reject(err);
                $rootScope.$apply();
            })

        return d.promise;
        
    }
}    



