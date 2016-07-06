var anim = angular.module('animist', [  
    //'ngCordova',
    //'ngCordovaBluetoothLE'
    //'pouchdb'
])

/*.run(run);

// Initialize the Animist Services
function run ($rootScope, AnimistBLE, AnimistBeacons, AnimistAccounts ) {

    AnimistAccounts.initialize().then( function(){
        AnimistBLE.initialize().then( function(){
            AnimistBeacons.initialize();
        });
    }); 
};*/


// Error logging utility
function errorType(where){

    this.where = where;
    this.error = null;
};

errorType.prototype.set = function(error){ this.error = error };
//errorType.prototype.toString = function(){return 'where: ' + this.where + ' error: ' + this.error };
           
