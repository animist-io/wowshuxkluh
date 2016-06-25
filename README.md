# wowshuxkluh

[![Build Status](https://travis-ci.org/animist-io/wowshuxkluh.svg?branch=master)](https://travis-ci.org/animist-io/wowshuxkluh)

(This repo is in under construction and not currently usable. Earliest drafts/tests for a BLE server client, beacon detector and Ethereum account manager have been written. Project focus is shifting to animist-io/whale-island to flesh out the server itself. We'll cycle back here to finish up when that's complete. 
(Updated late June, 2016))

Wowshuxkluh will be an an Angular 1.x library for Ionic.js that lets mobile devices automatically (or intentionally) connect to Ethereum IoT nodes over BluetoothLE and write transactions to the blockchain about their location. The initial goal is to make presence in space and time transactionally available to Ethereum contracts in a way that is relatively hard to spoof. Later work will focus on making any IoT/mobile functionality (barcode scans, NFC, sensor data ) available. 

Use cases for such a system include:
+ Wagered races from one location to another, 
+ Any game where presence of the players together in a location is a key component (ex: Assassins) 
+ Rewards systems for repeatedly visiting locations or moving through space along specified routes 
+ COD delivery agreements. 

Key issues here include:

+ iBeacon signal management
+ Ethereum account management on devices 
+ Secure local connection/auth between IOT Node and mobile device
+ Bundling for inclusion in an Ionic application

Cordova dependencies

```
$ cordova plugin add cordova-plugin-bluetoothle                   // BluetoothLE
$ cordova plugin add com.unarin.cordova.beacon                    // iBeacon
cordova plugin add https://github.com/shazron/KeychainPlugin.git  // iOS Keychain
```













