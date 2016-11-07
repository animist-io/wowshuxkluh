// Emulates responses from whale-island peripheral 
// and mocks the $cordovaBluetoothBLE plugin (which can only run on the device). 
//
// Per ngCordovaMocks pattern:
// setting 'throwsSomething' to true will run the rejection callback of 'something'
//      for a given test. 
// setting 'emulateGetContract' to true notifies w/ a successful subscription
//       and 5 notification packets ending in 'EOF', 
// setting emulateWriteTx to true notifies w/ a successful subscription and a 
//       single subsequent notice that mocks a txHash msg.

angular.module('animistMocks', [])

    .service('$cordovaBluetoothLE', function ($q, $rootScope, $timeout) {
        
        var self = this;

        // All purpose $cordovaBluetoothLE object error 
        var generic = {error: 'failed'};
        
        // Flag to trigger generic rejections
        self.throwsError = false;

        // Flags to trigger hardware layer errors
        self.throwsScan = false;
        self.throwsConnect = false;
        self.throwsDiscover = false;
        self.throwsRead = false;
        self.throwsWrite = false;
        self.throwsSubscribe = false;

        // Flags to trigger ble write callback errors
        self.throwsInvaidJSON = false;
        self.throwsNOMSG = false;
        self.throwsNOTX = false;

        // Flags to emulate different subscription results
        self.emulateGetContract = false;
        self.emulateWriteTx = false;
            
        // Encoding Utilities borrowed from $cordovaBluetoothLE & used by 
        // the mocks to encode and by AnimistBLE to encode/decode
        self.encodedStringToBytes = function(string) {
            var data = atob(string);
            var bytes = new Uint8Array(data.length);
            for (var i = 0; i < bytes.length; i++)
            {
              bytes[i] = data.charCodeAt(i);
            }
            return bytes;
        },

        self.bytesToEncodedString = function(bytes) {
            return btoa(String.fromCharCode.apply(null, bytes));
        },
        
        self.stringToBytes = function(string) {
            var bytes = new ArrayBuffer(string.length * 2);
            var bytesUint16 = new Uint16Array(bytes);
            for (var i = 0; i < string.length; i++) {
              bytesUint16[i] = string.charCodeAt(i);
            }
            return new Uint8Array(bytesUint16);
        },
        
        self.bytesToString = function(bytes) {
            return String.fromCharCode.apply(null, new Uint16Array(bytes));
        },

        self.encodeMock = function(val){
            return self.bytesToEncodedString(self.stringToBytes(val));
        };


        // Public Mock Data
        self.mockGetContractResult = "{\"code\":\"606060405261038180610013600061037c565b91905056\",\"proximity\":\"any\",\"state\":\"1\",\"authority\":\"5060f6b697a4e7b767863580a91a1f5e37c43c75\"}";
        self.mockGetContract = {"code": "606060405261038180610013600061037c565b91905056", "proximity": "any", "state": "1", "authority": "5060f6b697a4e7b767863580a91a1f5e37c43c75"};
        self.mockWriteTxResult = "f88d028609184e72a000832dc6c0947764b6a2728a";
        self.mockData = "0x606060405236156100cc576000357c010000000000000000000000000000000000000000000000000000000090048063109e94cf146100ce5780631865c57d14610107578063406e67091461012a57806359dc735c1461014f5780636e7b57881461018857806372f10ff4146101a957806376303289146101c15780637e14d2c1146101ee5780638526690a14610206578063a771fdc51461021e578063a9e966b714610241578063bbb82d8914610259578063c19d93fb1461027e578063e103aef5146102a1576100cc565b005b6100db60048050506102b0565b604051808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b61011460048050506102d6565b6040518082815260200191505060405180910390f35b61013760048050506102e8565b60405180821515815260200191505060405180910390f35b61015c6004805050610304565b604051808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b6101a76004808035906020019091908035906020019091905050610311565b005b6101bf6004808035906020019091905050610374565b005b6101ce6004805050610390565b604051808267ffffffffffffffff16815260200191505060405180910390f35b61020460048080359060200190919050506103aa565b005b61021c60048080359060200190919050506103cd565b005b61022b60048050506103fc565b6040518082815260200191505060405180910390f35b6102576004808035906020019091905050610429565b005b6102666004805050610437565b60405180821515815260200191505060405180910390f35b61028b600480505061044a565b6040518082815260200191505060405180910390f35b6102ae6004805050610453565b005b600060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600060016000505490506102e5565b90565b6000600260009054906101000a900460ff169050610301565b90565b600080905061030e565b90565b81600060006101000a81548173ffffffffffffffffffffffffffffffffffffffff0219169083021790555080600260016101000a81548167ffffffffffffffff0219169083021790555060016000818150548092919060010191905055505b5050565b80600260006101000a81548160ff021916908302179055505b50565b600260019054906101000a900467ffffffffffffffff1681565b80600260016101000a81548167ffffffffffffffff021916908302179055505b50565b80600060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908302179055505b50565b6000600260019054906101000a900467ffffffffffffffff1667ffffffffffffffff169050610426565b90565b806001600050819055505b50565b600260009054906101000a900460ff1681565b60016000505481565b6000600260006101000a81548160ff021916908302179055506000600260016101000a81548167ffffffffffffffff021916908302179055506000600060006101000a81548173ffffffffffffffffffffffffffffffffffffffff0219169083021790555060006001600050819055505b56";
        self.mockSignedTx = "f8848001832dc6c0941251e5657d6ba0e397a6889e031efa8b87a805b180a4a9e966b700000000000000000000000000000000000000000000000000000000000000021ba086298e9f8da3a86aec0b9af7ad113e97356120c2c3f76a47de35e7a47ba1c4c2a0562af5ac95e6403bdef824225ae55fcf0a2a37f517b3ac143e887a65729c5085";
        self.mockPin = "iciIKTtuadkwlzF3v3CElZNoXfLW5H0p";
        self.mockBlockNumber = 2247;
        self.mockAddress = '0x407d73d8a49eeb85d32cf465507dd71d507100c1';
        self.mockTxStatus =  {"blockNumber": 3,"gasUsed": 30234};
        
        self.mockSessionData = {"sessionId": "1q2w3e4r5t", "expires": 1234567890 };
        self.mockTxHash = "0x9fc76417374aa880d4449a1f7f31ec597f00b1f6f3dd2d66f4c9c6c445836d8b";
        self.mockAccountBalance = '3.33024461631390638913600059538215531811694532e+44';
        self.mockCallResult = "0x0000000000000000000000000000000000000000000000000000000000000015";
        self.mockCall = [self.mockAddress, self.mockData];
        self.mockVerifyPresenceAndSend = {pin: self.mockPin, tx: self.mockSignedTx};
        self.mockClientTxStatus = { verifyPresenceStatus: "success", verifyPresenceTxHash: self.mockTxHash, clientTxHash: self.mockTxHash }; 
        self.mockSignedMessage = '0xaaaaaaaaaaa';
        self.mockPresenceReceipt = {
            time: 1470937203535,
            signedTime: '0xb5c6621018641755a4a9957652fe54fac34aea5729009d49df288b3bcee83d346198607d7b54259808c5553c04ae74c450dec38ef6b305c4406ca620601e0d7d1b',
            signedAddress: '0x086addd03f0b0adff418a68ebad482ef8c84d57b49a0373bbab6262175c2899920b1c532458b4ba29125315510cbc20167d458781639f2e8b172464818f579391b' 
        };


        // Private Mock data
        var scanResult = { "status":"scanResult","advertisement":{"solicitedServiceUuids":[],"overflowServiceUuids":[],"localName":"Animist","isConnectable":true,"serviceData":{},"serviceUuids":["56D2E78E-FACE-44C4-A786-1763EA8E4302"]},"rssi":-35,"name":"User’s Mac mini","address":"B70DCC59-4B65-C819-1C2C-D32B7FA0369A"};
        var discoverResult = {"status":"discovered","services":[{"characteristics":[{"descriptors":[],"properties":{"read":true},"uuid":"2A29"},{"descriptors":[],"properties":{"read":true},"uuid":"2A24"}],"uuid":"180A"},{"characteristics":[{"descriptors":[{"uuid":"2902"}],"properties":{"write":true,"notify":true},"uuid":"8667556C-9A37-4C91-84ED-54EE27D90049"}],"uuid":"D0611E78-BBB4-4591-A5F8-487910AE4366"},{"characteristics":[{"descriptors":[],"properties":{"read":true},"uuid":"C40C94B3-D9FF-45A0-9A37-032D72E423A9"},{"descriptors":[{"uuid":"2902"}],"properties":{"write":true,"indicate":true},"uuid":"BFA15C55-ED8F-47B4-BD6A-31280E98C7BA"}],"uuid":"56D2E78E-FACE-44C4-A786-1763EA8E4302"}],"name":"User’s Mac mini","address":"B70DCC59-4B65-C819-1C2C-D32B7FA0369A"};
        var pinResult = "iciIKTtuadkwlzF3v3CElZNoXfLW5H0p";
        
        // Reads
        var pinResultRaw = self.encodeMock(JSON.stringify(self.mockPin));
        var blockNumberRaw = self.encodeMock(JSON.stringify(self.mockBlockNumber));
        var deviceAccountRaw = self.encodeMock(JSON.stringify(self.mockAddress));

        // Subscribe/writes
        var txStatusRaw = self.encodeMock(JSON.stringify(self.mockTxStatus));
        var newSessionIdRaw = self.encodeMock(JSON.stringify(self.mockSessionData));
        var txHashRaw = self.encodeMock(JSON.stringify(self.mockTxHash));
        var accountBalanceRaw = self.encodeMock(JSON.stringify(self.mockAccountBalance));
        var callResultRaw = self.encodeMock(JSON.stringify(self.mockCallResult));
        var presenceReceiptRaw = self.encodeMock(JSON.stringify(self.mockPresenceReceipt));
        var clientTxStatusRaw = self.encodeMock(JSON.stringify(self.mockClientTxStatus));
        
        var getContractRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock("{\"code\":\"606060405261038180610013600061037c565b")},
            {status: 'notify', value: self.encodeMock("91905056\",\"proximity\":\"any\",\"state\":\"1")},
            {status: 'notify', value: self.encodeMock("\",\"authority\":\"5060f6b697a4e7b767863580a91a1f5e37c43c75\"}")},
            {status: 'notify', value: self.encodeMock("EOF")}
        ];

        var writeTxRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock(self.mockWriteTxResult)}
        ];

        
        var txStatusRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock(JSON.stringify(self.mockTxStatus))}
        ];

        var newSessionIdRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock(JSON.stringify(self.mockSessionData))}
        ];

        var txHashRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock(JSON.stringify(self.mockTxHash))}
        ];

        var accountBalanceRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock(JSON.stringify(self.mockAccountBalance))}
        ];

        var callResultRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock(JSON.stringify(self.mockCallResult))}
        ];

        var presenceReceiptRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock(JSON.stringify(self.mockPresenceReceipt))}
        ];

        var clientTxStatusRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock(JSON.stringify(self.mockClientTxStatus))}
        ];

        // ------------------
        // ------ API ------- 
        // ------------------

        // Notifies: requires $timeout.flush() to return successfully
        self.initialize = function () {
            var defer = $q.defer();

            (self.throwsError) ? 
                defer.reject(generic):
                $timeout(function(){ defer.notify() },0);
    
            return defer.promise;
        };

        // Notifies: requires $timeout.flush() to return successfully
        self.startScan = function (params) {
            var defer = $q.defer();

            (self.throwsScan) ? 
                defer.reject(generic):
                $timeout(function(){ defer.notify(scanResult) },0);
    
            return defer.promise;
        };

        self.stopScan = function (params) {

            var defer = $q.defer();

            (self.throwsError) ? 
                defer.reject(generic):
                defer.resolve();
    
            return defer.promise;
        };

        // Notifies: requires $timeout.flush() to return successfully
        self.connect = function (params) {

            var defer = $q.defer();

            (self.throwsConnect) ? 
                defer.reject(generic):
                $timeout(function(){ defer.notify() },0);
    
            return defer.promise;
        };

        self.close = function (params) {

            var defer = $q.defer();

            (self.throwsError) ? 
                defer.reject(generic):
                defer.resolve(true);
    
            return defer.promise;
        };

        self.discover = function (params) {

            var defer = $q.defer();

            (self.throwsDiscover) ? 
                defer.reject(generic):
                defer.resolve(discoverResult);
    
            return defer.promise;
        };

        self.read = function(params){
            var defer = $q.defer();

            if(self.throwsRead) 
                defer.reject(generic)
            else if (self.emulateGetBlockNumber)
                defer.resolve({status: true, value: blockNumberRaw});
            else if (self.emulateGetDeviceAccount)
                defer.resolve({status: true, value: deviceAccountRaw});
            // This is stupid but default is to read pin.
            else defer.resolve({status: true, value: pinResultRaw});
            
            return defer.promise;
        };

        // Notifies: requires $timeout.flush() to return successfully
        self.subscribe = function(params){
            var defer = $q.defer();

            if (self.throwsSubscribe){
                defer.reject(0x01);
            } else if (self.emulateGetContract){

                angular.forEach(getContractRaw, function(packet){
                    $timeout(function(){ defer.notify(packet) },0);
                });
            } else if (self.emulateWriteTx){
                $timeout(function(){ 
                    defer.notify(writeTxRaw[0]);
                    defer.notify(writeTxRaw[1]);
                },0);
            } else if (self.emulateGetTxStatus){
                $timeout(function(){ 
                    defer.notify(txStatusRaw[0]);
                    defer.notify(txStatusRaw[1]);
                },0);  
            } else if (self.emulateGetAccountBalance){
                $timeout(function(){ 
                    defer.notify(accountBalanceRaw[0]);
                    defer.notify(accountBalanceRaw[1]);
                },0); 
            } else if (self.emulateCallTx){
                $timeout(function(){ 
                    defer.notify(callResultRaw[0]);
                    defer.notify(callResultRaw[1]);
                },0);  
            } else if (self.emulateGetNewSessionId){
                $timeout(function(){ 
                    defer.notify(newSessionIdRaw[0]);
                    defer.notify(newSessionIdRaw[1]);
                },0); 
            } else if (self.emulateGetPresenceReceipt){
                $timeout(function(){ 
                    defer.notify(presenceReceiptRaw[0]);
                    defer.notify(presenceReceiptRaw[1]);
                },0); 
            } else if (self.emulateGetClientTxStatus){
                $timeout(function(){ 
                    defer.notify(clientTxStatusRaw[0]);
                    defer.notify(clientTxStatusRaw[1]);
                },0);
            } else if (self.emulateTxHash){

                $timeout(function(){ 
                    defer.notify(txHashRaw[0]);
                    defer.notify(txHashRaw[1]);
                },0); 
            }   
                
            return defer.promise;
        };

        self.unsubscribe = function (params) {
            return $q.when(true);
        };

        self.write = function(params){

            var defer = $q.defer();

            if      (self.throwsWrite)      defer.reject(generic);
            else if (self.throwsNOTX)       defer.reject(0x04);
            else if (self.throwsInvaidJSON) defer.reject(0x02);
            else if (self.throwsNOMSG)      defer.reject(0x03);
            else                            defer.resolve(0x00);
    
            return defer.promise;
        }
    })


    // Mocks the $cordovaBeacon plugin (which can only run on the device). 
    //
    // Per ngCordovaMocks pattern:
    // setting 'throwsError' to true will run the rejection callback of any method
    //      invoked until the test terminates. 
    .service('$cordovaBeacon', function($q) {
        
        
        var self = this;
        self.throwsError = false;
        self.mockRegion = 'mock';
        
        self.createBeaconRegion = function(params){return self.mockRegion};
        self.startMonitoringForRegion = function(region){};
        self.startRangingBeaconsInRegion = function(region){};
        self.startAdvertising = function(region){};
        self.requestAlwaysAuthorization = function(){};
        
        self.getAuthorizationStatus = function(){
            var defer = $q.defer();

            (self.throwsError) ? 
                defer.reject():
                defer.resolve();
    
            return defer.promise;
        }
             
    });
