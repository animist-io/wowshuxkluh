//(function(){

angular.module('animistMocks', [])

    // Emulates responses from whale-island peripheral 
    // and mocks the $cordovaBluetoothBLE plugin (which can only run on the device). 
    //
    // Per ngCordovaMocks pattern:
    // setting 'throwsError' to true will run the rejection callback of any method
    //      invoked until the test terminates. 
    // setting 'emulateHasTx' to true notifies w/ a successful subscription
    //       and 5 notification packets ending in 'EOF', 
    // setting emulateWriteTx to true notifies w/ a successful subscription and a 
    //       single subsequent notice that mocks a txHash msg.

    .service('$cordovaBluetoothLE', function ($q) {
        
        var self = this;

        // All purpose $cordovaBluetoothLE object error 
        var generic = {error: 'failed'};
        
        // Flag to trigger generic rejections
        self.throwsError = false;

        // Flags to trigger specific write callback errors
        self.throwsInvaidJSON = false;
        self.throwsNOMSG = false;
        self.throwsNOTX = false;

        // Flags to emulate different subscription results
        self.emulateHasTx = false;
        self.emulateWriteTx = false;
            
        // Encoding Utilities stolen from $cordovaBluetoothLE & used by 
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


        // Mock data
        var scanResult = { "status":"scanResult","advertisement":{"solicitedServiceUuids":[],"overflowServiceUuids":[],"localName":"Animist","isConnectable":true,"serviceData":{},"serviceUuids":["56D2E78E-FACE-44C4-A786-1763EA8E4302"]},"rssi":-35,"name":"User’s Mac mini","address":"B70DCC59-4B65-C819-1C2C-D32B7FA0369A"};
        var discoverResult = {"status":"discovered","services":[{"characteristics":[{"descriptors":[],"properties":{"read":true},"uuid":"2A29"},{"descriptors":[],"properties":{"read":true},"uuid":"2A24"}],"uuid":"180A"},{"characteristics":[{"descriptors":[{"uuid":"2902"}],"properties":{"write":true,"notify":true},"uuid":"8667556C-9A37-4C91-84ED-54EE27D90049"}],"uuid":"D0611E78-BBB4-4591-A5F8-487910AE4366"},{"characteristics":[{"descriptors":[],"properties":{"read":true},"uuid":"C40C94B3-D9FF-45A0-9A37-032D72E423A9"},{"descriptors":[{"uuid":"2902"}],"properties":{"write":true,"indicate":true},"uuid":"BFA15C55-ED8F-47B4-BD6A-31280E98C7BA"}],"uuid":"56D2E78E-FACE-44C4-A786-1763EA8E4302"}],"name":"User’s Mac mini","address":"B70DCC59-4B65-C819-1C2C-D32B7FA0369A"};

        var pinResult = "iciIKTtuadkwlzF3v3CElZNoXfLW5H0p";
        var pinResultRaw = self.encodeMock(pinResult);

        var hasTx ="{\"code\":\"606060405261038180610013600061037c565b91905056\",\"proximity\":\"any\",\"authority\":\"5060f6b697a4e7b767863580a91a1f5e37c43c75\"}";
        var hasTxRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock("{\"code\":\"606060405261038180610013600061037c565b")},
            {status: 'notify', value: self.encodeMock("91905056\",\"proximity\":\"any")},
            {status: 'notify', value: self.encodeMock("\",\"authority\":\"5060f6b697a4e7b767863580a91a1f5e37c43c75\"}")},
            {status: 'notify', value: self.encodeMock("EOF")}
        ];

        var writeTx = "f88d028609184e72a000832dc6c0947764b6a2728a";
        var writeTxRaw = [
            {status: 'subscribed', value: 0},
            {status: 'notify', value: self.encodeMock(writeTx)}
        ];

        

        // API 
        self.initialize = function () {
            var defer = $q.defer();

            (self.throwsError) ? 
                defer.reject(generic):
                defer.resolve();
    
            return defer.promise;
        };

        self.startScan = function (params) {
            var defer = $q.defer();

            (self.throwsError) ? 
                defer.reject(generic):
                defer.resolve(scanResult);
    
            return defer.promise;
        };

        self.stopScan = function (params) {

            var defer = $q.defer();

            (self.throwsError) ? 
                defer.reject(generic):
                defer.resolve();
    
            return defer.promise;
        };

        self.connect = function (params) {

            var defer = $q.defer();

            (self.throwsError) ? 
                defer.reject(generic):
                defer.resolve(true);
    
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

            (self.throwsError) ? 
                defer.reject(generic):
                defer.resolve(discoverResult);
    
            return defer.promise;
        };

        self.read = function(params){
            var defer = $q.defer();

            (self.throwsError) ? 
                defer.reject(generic):
                defer.resolve(pinResultRaw);
    
            return defer.promise;
        };

        self.subscribe = function(params){
            var defer = $q.defer();

            if (self.throwsError){
                defer.reject(generic);
            } else if (self.emulateHasTx){
                angular.forEach(hasTxRaw, function(packet){
                    defer.notify(packet);
                });
                defer.resolve();

            } else if (self.emulateWriteTx){
                defer.notify(writeTxRaw[0]);
                defer.notify(writeTxRaw[1]);
                defer.resolve();
            }    
                
            return defer.promise;
        };

        self.write = function(params){

            var defer = $q.defer();

            if      (self.throwsError)      defer.reject(generic)
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


// End closure
//})();