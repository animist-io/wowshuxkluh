var window_debug = window;

describe('AnimistBluetoothAPI', function(){

    beforeEach(module('animist'));       // Animist
    beforeEach(module('animistMocks'));  // cordovaBluetoothBLE & cordovaBeacon
    beforeEach(module('ngCordovaMocks'));

    var $scope, $q, $ble, uuids, Auto, Core, API, Beacons, AnimistAccount, $timeout, 
        promise, error;

    beforeEach(inject(function(_$rootScope_, _$q_, _$cordovaBluetoothLE_, _$timeout_, 
                              _AnimistBluetoothCore_, _AnimistBluetoothAuto_, _AnimistBluetoothAPI_, 
                              _AnimistAccount_, _AnimistConstants_ ){
     
        $scope = _$rootScope_;
        $ble = _$cordovaBluetoothLE_;
        $q = _$q_;
        $timeout = _$timeout_;
        uuids = _AnimistConstants_.serverCharacteristicUUIDs;

        Core = _AnimistBluetoothCore_;
        Auto = _AnimistBluetoothAuto_;
        API = _AnimistBluetoothAPI_;

        // AnimistAccount Mocks
        AnimistAccount = _AnimistAccount_;
        AnimistAccount.initialized = true;

        AnimistAccount.sign = function(){ return $ble.mockSignedMessage };
        AnimistAccount.generateTx = function(tx){ return 'message'}
        AnimistAccount.address = '123';
        AnimistAccount.remoteAuthority = '567';
    }));

    describe('getPin', function(){

        it('should read the getPin uuid', function(){
            spyOn(Core, 'read').and.callThrough();
            API.getPin();
            $scope.$digest();
            expect(Core.read).toHaveBeenCalledWith(uuids.getPin);
        });

        it('should resolve the pin value on success', function(){
            spyOn(Core, 'read').and.callThrough();
            promise = API.getPin();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockPin);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'read').and.callThrough();
            $ble.throwsRead = true;
            error = { where : 'AnimistBluetoothCore:read: ' + uuids.getPin, error : undefined };
            promise = API.getPin();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('getDeviceAccount', function(){

        it('should read the getDeviceAccount uuid', function(){
            spyOn(Core, 'read').and.callThrough();
            API.getDeviceAccount();
            $scope.$digest();
            expect(Core.read).toHaveBeenCalledWith(uuids.getDeviceAccount);
        });

        it('should resolve the account number on success', function(){
            spyOn(Core, 'read').and.callThrough();
            $ble.emulateGetDeviceAccount = true;
            promise = API.getDeviceAccount();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockAddress);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'read').and.callThrough();
            $ble.throwsRead = true;
            error = { where : 'AnimistBluetoothCore:read: ' + uuids.getDeviceAccount, error : undefined };
            promise = API.getDeviceAccount();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('getBlockNumber', function(){

        it('should read the getBlockNumber uuid', function(){
            spyOn(Core, 'read').and.callThrough();
            API.getBlockNumber();
            $scope.$digest();
            expect(Core.read).toHaveBeenCalledWith(uuids.getBlockNumber);
        });

        it('should resolve the blockNumber on success', function(){
            spyOn(Core, 'read').and.callThrough();
            $ble.emulateGetBlockNumber = true;
            promise = API.getBlockNumber();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockBlockNumber);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'read').and.callThrough();
            $ble.throwsRead = true;
            error = { where : 'AnimistBluetoothCore:read: ' + uuids.getBlockNumber, error : undefined };
            promise = API.getBlockNumber();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('getTxStatus', function(){

        it('should subscribe/write to the getTxStatus uuid', function(){
            spyOn(Core, 'write').and.callThrough();
            API.getTxStatus($ble.mockTxHash);
            $scope.$digest();
            expect(Core.write).toHaveBeenCalledWith($ble.mockTxHash, uuids.getTxStatus);
        });

        it('should resolve a transaction data object on success', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.emulateGetTxStatus = true;
            promise = API.getTxStatus($ble.mockTxHash);
            $timeout.flush();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockTxStatus);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'read').and.callThrough();
            $ble.throwsSubscribe = true;
            error = { where : 'AnimistBluetoothCore:write: ' + uuids.getTxStatus, error : 0x01 };
            promise = API.getTxStatus($ble.mockTxHash);
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('getAccountBalance', function(){

        it('should subscribe to the getAccountBalance uuid', function(){
            spyOn(Core, 'write').and.callThrough();
            API.getAccountBalance($ble.mockAddress);
            $scope.$digest();
            expect(Core.write).toHaveBeenCalledWith($ble.mockAddress, uuids.getAccountBalance);
        });

        it('should resolve a BigNumber object on success', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.emulateGetAccountBalance = true;
            promise = API.getAccountBalance($ble.mockAddress);
            $timeout.flush();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual(new ethUtil.BN($ble.mockAccountBalance));
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.throwsSubscribe = true;
            error = { where : 'AnimistBluetoothCore:write: ' + uuids.getAccountBalance, error : 0x01 };
            promise = API.getAccountBalance($ble.mockAddress);
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('callTx', function(){

        it('should subscribe to the callTx uuid with call data array', function(){
            spyOn(Core, 'write').and.callThrough();
            API.callTx($ble.mockCall);
            $scope.$digest();
            expect(Core.write).toHaveBeenCalledWith($ble.mockCall, uuids.callTx);
        });

        it('should resolve web3.eth.call result value on success', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.emulateCallTx = true;
            promise = API.callTx($ble.mockCall);
            $timeout.flush();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockCallResult);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.throwsSubscribe = true;
            error = { where : 'AnimistBluetoothCore:write: ' + uuids.callTx, error : 0x01 };
            promise = API.callTx($ble.mockCall);
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('getNewSessionId', function(){

        it('should subscribe to the getNewSessionId uuid with signed pin', function(){
            spyOn(Core, 'write').and.callThrough();
            API.getNewSessionId();
            $scope.$digest();
            expect(Core.write).toHaveBeenCalledWith($ble.mockSignedMessage, uuids.getNewSessionId);
        });

        it('should resolve a session data object on success', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.emulateGetNewSessionId = true;
            promise = API.getNewSessionId();
            $timeout.flush();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockSessionData);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.throwsSubscribe = true;
            error = { where : 'AnimistBluetoothCore:write: ' + uuids.getNewSessionId, error : 0x01 };
            promise = API.getNewSessionId();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('getPresenceReceipt', function(){

        it('should subscribe to the getPresenceReceipt uuid with signed pin', function(){
            spyOn(Core, 'write').and.callThrough();
            API.getPresenceReceipt();
            $scope.$digest();
            expect(Core.write).toHaveBeenCalledWith($ble.mockSignedMessage, uuids.getPresenceReceipt);
        });

        it('should resolve a presence receipt object on success', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.emulateGetPresenceReceipt = true;
            promise = API.getPresenceReceipt();
            $timeout.flush();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockPresenceReceipt);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.throwsSubscribe = true;
            error = { where : 'AnimistBluetoothCore:write: ' + uuids.getPresenceReceipt, error : 0x01 };
            promise = API.getPresenceReceipt();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('getVerifiedTxStatus', function(){

        it('should subscribe to the getVerifiedTxStatus uuid', function(){
            spyOn(Core, 'write').and.callThrough();
            API.getVerifiedTxStatus();
            $scope.$digest();
            expect(Core.write).toHaveBeenCalledWith($ble.mockSignedMessage, uuids.getVerifiedTxStatus);
        });

        it('should resolve a transaction hash string on success', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.emulateGetVerifiedTxStatus = true;
            promise = API.getVerifiedTxStatus();
            $timeout.flush();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockVerifiedTxStatus);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.throwsSubscribe = true;
            error = { where : 'AnimistBluetoothCore:write: ' + uuids.getVerifiedTxStatus, error : 0x01 };
            promise = API.getVerifiedTxStatus();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('getContract', function(){

        it('should subscribe to the getContract uuid', function(){
            spyOn(Core, 'writeWithLongResponse').and.callThrough();
            API.getContract();
            $scope.$digest();
            expect(Core.writeWithLongResponse).toHaveBeenCalledWith($ble.mockSignedMessage, uuids.getContract);
        });

        it('should resolve a contract data object on success', function(){
            spyOn(Core, 'writeWithLongResponse').and.callThrough();
            $ble.emulateGetContract = true;
            promise = API.getContract();
            $timeout.flush();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockGetContract);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'writeWithLongResponse').and.callThrough();
            $ble.throwsSubscribe = true;
            error = { where : 'AnimistBluetoothCore:writeWithLongResponse: ' + uuids.getContract, error : 0x01 };
            promise = API.getContract();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('authTx', function(){

        it('should subscribe to the authTx uuid', function(){
            spyOn(Core, 'write').and.callThrough();
            API.authTx();
            $scope.$digest();
            expect(Core.write).toHaveBeenCalledWith($ble.mockSignedMessage, uuids.authTx);
        });

        it('should resolve a transaction hash string on success', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.emulateTxHash = true;
            promise = API.authTx();
            $timeout.flush();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockTxHash);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.throwsSubscribe = true;
            error = { where : 'AnimistBluetoothCore:write: ' + uuids.authTx, error : 0x01 };
            promise = API.authTx();
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });

    describe('authAndSendTx', function(){

        it('should subscribe to the authAndSend uuid', function(){
            var expected = { pin: $ble.mockSignedMessage, tx: $ble.mockSignedTx };
            spyOn(Core, 'write').and.callThrough();
            API.authAndSendTx($ble.mockSignedTx);
            $scope.$digest();
            expect(Core.write).toHaveBeenCalledWith(expected, uuids.authAndSendTx);
        });

        it('should resolve a transaction hash string on success', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.emulateTxHash = true;
            promise = API.authAndSendTx($ble.mockSignedTx);
            $timeout.flush();
            expect(promise.$$state.status).toEqual(1);
            expect(promise.$$state.value).toEqual($ble.mockTxHash);
        });

        it('should reject with error object on failure', function(){
            spyOn(Core, 'write').and.callThrough();
            $ble.throwsSubscribe = true;
            error = { where : 'AnimistBluetoothCore:write: ' + uuids.authAndSendTx, error : 0x01 };
            promise = API.authAndSendTx($ble.mockSignedTx);
            $scope.$digest();
            expect(promise.$$state.status).toEqual(2);
            expect(promise.$$state.value).toEqual(error);
        });
    });
});



