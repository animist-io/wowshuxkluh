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
        NOT_INITIALIZED: 'Cannot encrypt - no public key for node',
        ENCRYPTION_LAYER_FAILED: 'openpgp threw an error'
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
        var where = 'AnimistPgp:encrypt'

        if (!core.peripheral.publicKey){
            return $q.reject({where: where, error: codes.NOT_INITIALIZED});
        } 

        try {      
            options = {
                data: data,
                publicKeys: npm.openpgp.key.readArmored(core.peripheral.publicKey).keys[0],
            };
            return $q.when(npm.openpgp.encrypt(options), function(cipher){
                return cipher.data
            });

        } catch (err) {
            $q.reject({where: where, error: codes.ENCRYPTION_LAYER_FAILED});
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
        return $q.when(hkp.lookup({ keyId: keyId }));
    }
}    



