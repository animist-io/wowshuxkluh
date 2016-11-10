describe('AnimistPgp', function(){

    beforeEach(module('animist'));          // Animist
    beforeEach(module('animistMocks'));     // Decryption methods, public key
    beforeEach(module('pgpKeystoreMocks')); // Keystore

    var $scope, $q, Core, pgp,  $timeout, mocks, promise, error;

    beforeEach(inject(function(_$rootScope_, _$q_, _$timeout_, _AnimistPgp_,
                              _AnimistBluetoothCore_, _AnimistConstants_, _mockPgp_ ){
     
        $scope = _$rootScope_;
        $q = _$q_;
        $timeout = _$timeout_;
    
        core = _AnimistBluetoothCore_;
        pgp = _AnimistPgp_;
        mocks = _mockPgp_;

        core.peripheral.publicKey = null;

    }));

    describe('encrypt(data)', function(){

        it('should encrypt the data', function(done){
           
            core.peripheral.publicKey = mocks.publicKey;

            pgp.encrypt('hello').then(function(encrypted){
                mocks.decrypt(encrypted).then(function(decrypted){
                    expect(decrypted).toEqual('hello');
                }).finally(done);
            })

        });

        it('should reject if client doesnt have the public key yet', function(){
            promise = pgp.encrypt('hello');
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
        });
    });

    describe('getPublicKeyFromMIT(keyId)', function(){

        it('should get a key', function(done){
            var header = 
                '-----BEGIN PGP PUBLIC KEY BLOCK-----\n' + 
                'Version: SKS 1.1.5\n' +
                'Comment: Hostname: pgp.mit.edu\n'

            /*pgp.getPublicKeyFromMIT(mocks.pgpKeyId).then(function(key){
                expect(key.includes(header)).toBe(true);
            }).finally(done);*/

            // This doesn't work on Travis bc its an http call?
            done();
        });  
    })


});