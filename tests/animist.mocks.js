(function(){

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

    .factory('$cordovaBluetoothLE', ['$q', function ($q) {
        
        var throwsError = false;
        var emulateHasTx = false;
        var emulateWriteTx = false;

        return {

            // Boolean flag to trigger rejections
            throwsError: throwsError,
            errorUnsupported: { error: "unsupported", message: "Operation unsupported"},

            // Boolean flags to emulate different subscription results
            emulateHasTx: emulateHasTx;
            emulateWriteTx: emulateWriteTx;

            // Mock data
            scanResult: { "status":"scanResult","advertisement":{"solicitedServiceUuids":[],"overflowServiceUuids":[],"localName":"Animist","isConnectable":true,"serviceData":{},"serviceUuids":["56D2E78E-FACE-44C4-A786-1763EA8E4302"]},"rssi":-35,"name":"User’s Mac mini","address":"B70DCC59-4B65-C819-1C2C-D32B7FA0369A"},
            discoverResult: {"status":"discovered","services":[{"characteristics":[{"descriptors":[],"properties":{"read":true},"uuid":"2A29"},{"descriptors":[],"properties":{"read":true},"uuid":"2A24"}],"uuid":"180A"},{"characteristics":[{"descriptors":[{"uuid":"2902"}],"properties":{"write":true,"notify":true},"uuid":"8667556C-9A37-4C91-84ED-54EE27D90049"}],"uuid":"D0611E78-BBB4-4591-A5F8-487910AE4366"},{"characteristics":[{"descriptors":[],"properties":{"read":true},"uuid":"C40C94B3-D9FF-45A0-9A37-032D72E423A9"},{"descriptors":[{"uuid":"2902"}],"properties":{"write":true,"indicate":true},"uuid":"BFA15C55-ED8F-47B4-BD6A-31280E98C7BA"}],"uuid":"56D2E78E-FACE-44C4-A786-1763EA8E4302"}],"name":"User’s Mac mini","address":"B70DCC59-4B65-C819-1C2C-D32B7FA0369A"},

            pinResult: "iciIKTtuadkwlzF3v3CElZNoXfLW5H0p",
            pinResultRaw: this.encode(this.pinResult),

            hasTx: "{\"code\":\"606060405261038180610013600061037c565b91905056\",\"proximity\":\"any\",\"authority\":\"5060f6b697a4e7b767863580a91a1f5e37c43c75\"}",
            hasTxRaw: [
                {status: 'subscribed', value: 0},
                {status: 'notify', value: this.encode("{\"code\":\"606060405261038180610013600061037c565b")},
                {status: 'notify', value: this.encode("91905056\",\"proximity\":\"any")},
                {status: 'notify', value: this.encode(\",\"authority\":\"5060f6b697a4e7b767863580a91a1f5e37c43c75\"}")},
                {status: 'notify', value: this.encode("EOF")}
            ],

            writeTx: "f88d028609184e72a000832dc6c0947764b6a2728a",
            writeTxRaw: [
                {status: 'subscribed', value: 0},
                {status: 'notify', value: this.encode(this.writeTx)},
            ],

            subscribeHasTx: {"status":"subscribed","characteristic":"BFA15C55-ED8F-47B4-BD6A-31280E98C7BA","name":"User’s Mac mini","service":"56D2E78E-FACE-44C4-A786-1763EA8E4302","address":"B70DCC59-4B65-C819-1C2C-D32B7FA0369A"},

            encodedStringToBytes: function(string) {
                var data = atob(string);
                var bytes = new Uint8Array(data.length);
                for (var i = 0; i < bytes.length; i++)
                {
                  bytes[i] = data.charCodeAt(i);
                }
                return bytes;
            },

            bytesToEncodedString: function(bytes) {
                return btoa(String.fromCharCode.apply(null, bytes));
            },
            
            stringToBytes: function(string) {
                var bytes = new ArrayBuffer(string.length * 2);
                var bytesUint16 = new Uint16Array(bytes);
                for (var i = 0; i < string.length; i++) {
                  bytesUint16[i] = string.charCodeAt(i);
                }
                return new Uint8Array(bytesUint16);
            },
            
            bytesToString: function(bytes) {
                return String.fromCharCode.apply(null, new Uint16Array(bytes));
            },

            encode: function(val){
                return this.bytesToEncodedString(this.stringToBytes(val));
            }

            initialize: function () {
                var defer = $q.defer();

                (this.throwsError) ? 
                    defer.reject(errorUnsupported):
                    defer.resolve();
        
                return defer.promise;
            },

            startScan: function (params) {
                var defer = $q.defer();

                (this.throwsError) ? 
                    defer.reject(errorUnsupported):
                    defer.resolve(scanResult);
        
                return defer.promise;
            },

            stopScan: function (params) {

                var defer = $q.defer();

                (this.throwsError) ? 
                    defer.reject(errorUnsupported):
                    defer.resolve();
        
                return defer.promise;
            }

            connect: function (params) {

                var defer = $q.defer();

                (this.throwsError) ? 
                    defer.reject(errorUnsupported):
                    defer.resolve(true);
        
                return defer.promise;
            },

            close: function (params) {

                var defer = $q.defer();

                (this.throwsError) ? 
                    defer.reject(errorUnsupported):
                    defer.resolve(true);
        
                return defer.promise;
            },

            discover: function (params) {

                var defer = $q.defer();

                (this.throwsError) ? 
                    defer.reject(errorUnsupported):
                    defer.resolve(discoverResult);
        
                return defer.promise;
            },

            read: function(params){
                var defer = $q.defer();

                (this.throwsError) ? 
                    defer.reject(errorUnsupported):
                    defer.resolve(pinResultRaw);
        
                return defer.promise;
            },

            subscribe: function(params){
                var defer = $q.defer();

                if (this.throwsError){
                    defer.reject(errorUnsupported):
                } else if (this.emulateHasTx){
                    angular.forEach(hasTxRaw, function(packet){
                        defer.notify(packet);
                    });
                    defer.resolve();

                } else if (this.emulateWriteTx){
                    defer.notify(writeTxRaw[0]);
                    defer.notify(writeTxRaw[1]);
                    defer.resolve();
                }    
                    
                return defer.promise;
            }, 

            write: function(params){

                var defer = $q.defer();

                (this.throwsError) ? 
                    defer.reject(errorUnsupported):
                    defer.resolve();
        
                return defer.promise;
            }
        };
    }]);


    // Mocks the $cordovaBeacon plugin (which can only run on the device). 
    //
    // Per ngCordovaMocks pattern:
    // setting 'throwsError' to true will run the rejection callback of any method
    //      invoked until the test terminates. 
    .factory('$cordovaBeacon', ['$q', function ($q) {
        
        var throwsError = false;

        return {
            
            throwsError: throwsError,
            mockRegion: 'mock',

            createBeaconRegion: function(params){return this.mockRegion},
            startMonitoringForRegion: function(region){},
            startRangingBeaconsInRegion: function(region){},
            startAdvertising: function(region){},
            requestAlwaysAuthorization: function(){},
            
            getAuthorizationStatus: function(){
                var defer = $q.defer();

                (this.throwsError) ? 
                    defer.reject():
                    defer.resolve();
        
                return defer.promise;
            }
        }     
    }]);


// End closure
})();