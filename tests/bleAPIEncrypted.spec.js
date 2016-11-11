
// These tests rely on non-angular promises - setup has to be different.
describe('AnimistBluetoothAPI - Encrypted methods', function(){

    beforeEach(module('animist'));       // Animist
    beforeEach(module('animistMocks'));  // cordovaBluetoothBLE & cordovaBeacon
    beforeEach(module('ngCordovaMocks'));

    var $scope, $q, $timeout,  $ble, uuids, mockPgp, 
        Auto, Core, API, PGP, Beacons, AnimistAccount, Constants,
        promise, error;

    // Explicitly inject everything to avoid angular-mocks, so we can test non-angular promises.
    beforeEach(function(){
      
        var $injector = angular.injector(['ng', 'ngCordovaMocks', 'animist', 'animistMocks']);

        $scope = $injector.get('$rootScope');
        $ble = $injector.get('$cordovaBluetoothLE');
        $q = $injector.get('$q');
        $timeout = $injector.get('$timeout');

        AnimistAccount = $injector.get('AnimistAccount');
        Constants = $injector.get('AnimistConstants');
        Core = $injector.get('AnimistBluetoothCore');
        Auto = $injector.get('AnimistBluetoothAuto');
        API = $injector.get('AnimistBluetoothAPI');
        PGP = $injector.get('AnimistPgp');
        mockPgp = $injector.get('mockPgp');

        // Mock up animist accounts
        AnimistAccount.initialized = true;
        AnimistAccount.sign = function(){ return $ble.mockSignedMessage };
        AnimistAccount.generateTx = function(tx){ return 'message'}
        AnimistAccount.address = '123';
        AnimistAccount.remoteAuthority = '567';

        uuids = Constants.serverCharacteristicUUIDs;
    });

    describe('verifyPresence', function(){

        it('should subscribe to the verifyPresence uuid with an encrypted pin', function(done){
            
            spyOn(Core, 'write').and.returnValue($q.when('{}'));
            Core.peripheral.publicKey = mockPgp.publicKey;

            API.verifyPresence().then(function(){

                // Decrypt first arg of write call
                mockPgp.decrypt(Core.write.calls.argsFor(0)[0]).then(function(res){

                    // The mocked signed pin for tests is $ble.mockSignedMessage
                    expect(res).toEqual($ble.mockSignedMessage);
                    expect(Core.write.calls.argsFor(0)[1]).toEqual(uuids.verifyPresence);
                    done();
                });
            });
        });

        it('should resolve a transaction hash string on success', function(done){
            var expected = JSON.stringify($ble.mockTxHash);
            Core.peripheral.publicKey = mockPgp.publicKey;
            spyOn(Core, 'write').and.returnValue($q.when(expected));
            API.verifyPresence().then(function(res){
                expect(res).toEqual($ble.mockTxHash);
                done();
            });
        });

        it('should reject with error object / hex code on $ble failure', function(done){
            var expected = { where : 'AnimistBluetoothCore:write: ' + uuids.verifyPresence, error : 0x01 };
            Core.peripheral.publicKey = mockPgp.publicKey;
            spyOn(Core, 'write').and.returnValue($q.reject(expected));

            API.verifyPresence().catch(function(res){
                expect(res).toEqual(expected);
                done();
            });
        });

        it('should reject with error object if core.peripheral doesnt have the publicKey', function(done){

            API.verifyPresence().catch(function(res){
                expect(typeof res).toEqual('object');
                done();
            });
        });
    });

    describe('verifyPresenceAndSendTx', function(){

        it('should subscribe to the verifyPresenceAndSend uuid with an encrypted pin', function(done){
            
            spyOn(Core, 'write').and.returnValue($q.when('{}'));
            Core.peripheral.publicKey = mockPgp.publicKey;
            var expected = { pin: $ble.mockSignedMessage, tx: $ble.mockSignedTx };

            API.verifyPresenceAndSendTx($ble.mockSignedTx).then(function(){

                // Decrypt first arg of write call
                mockPgp.decrypt(Core.write.calls.argsFor(0)[0]).then(function(res){

                    // The mocked signed pin for tests is $ble.mockSignedMessage
                    var parsedRes = JSON.parse(res);
                    expect(parsedRes).toEqual(expected);
                    expect(Core.write.calls.argsFor(0)[1]).toEqual(uuids.verifyPresenceAndSendTx);
                    done();
                });
            });
        });

        it('should resolve a transaction hash string on success', function(done){
            
            var expected = JSON.stringify($ble.mockTxHash);
            Core.peripheral.publicKey = mockPgp.publicKey;
            spyOn(Core, 'write').and.returnValue($q.when(expected));
            API.verifyPresenceAndSendTx($ble.mockSignedTx).then(function(res){
                expect(res).toEqual($ble.mockTxHash);
                done();
            });

        });

        it('should reject with error object on failure', function(done){
            
            var expected = { where : 'AnimistBluetoothCore:write: ' + uuids.verifyPresenceAndSendTx, error : 0x01 };
            Core.peripheral.publicKey = mockPgp.publicKey;
            spyOn(Core, 'write').and.returnValue($q.reject(expected));

            API.verifyPresenceAndSendTx($ble.mockSignedTx).catch(function(res){
                expect(res).toEqual(expected);
                done();
            });
        });

        it('should reject with error object if core.peripheral doesnt have the publicKey', function(done){

            API.verifyPresenceAndSendTx($ble.mockSignedTx).catch(function(res){
                expect(typeof res).toEqual('object');
                done();
            });
        });
    });
});
