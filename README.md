# wowshuxkluh

[![Build Status](https://travis-ci.org/animist-io/wowshuxkluh.svg?branch=master)](https://travis-ci.org/animist-io/wowshuxkluh) **Warning: under construction.** 

Wowshuxkluh will be an an Angular 1.x library for Ionic that lets mobile devices automatically (or intentionally) connect to Ethereum microcomputer clients over BluetoothLE and write transactions to the blockchain about their location. The project's goal is to:
+ Make proximity detection events transactionally available to smart-contracts in a way that provides a minimally competent location oracle for mobile. 
+ Provide an interface that lets mobile Dapps interact with [animist-io/whale-island](https://github.com/animist-io/whale-island) to deploy contracts and execute transactions securely.   

Use cases for such a system include:
+ Competitive races 
+ Any game where presence of the players together in the same space is a key component (ex: Assassins) 
+ Location dependent incentive/reward programs

Repo currently contains early drafts & tests of a BLE client, beacon detector and Ethereum account manager. 

Key design issues here include:

+ Ethereum account management on devices 
+ Secure local connection/auth between IOT Node and mobile device
+ Bundling various Ethereum javascript libraries for inclusion in an Ionic application.

Cordova dependencies

```
$ cordova plugin add cordova-plugin-bluetoothle                        // BluetoothLE
$ cordova plugin add cordova-plugin-background-mode-bluetooth-central  // iOS background mode perm.
$ cordova plugin add com.unarin.cordova.beacon                         // iBeacon
$ cordova plugin add https://github.com/shazron/KeychainPlugin.git     // iOS Keychain
```

## Testing
```
$ gulp test
```













