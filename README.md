# wowshuxkluh

[![Build Status](https://travis-ci.org/animist-io/wowshuxkluh.svg?branch=master)](https://travis-ci.org/animist-io/wowshuxkluh)

(This repo is in the earliest stage of development. Initial TDD work is being done.)

Wowshuxkluh will be an an Angular 1.x library for Ionic.js that manages the connection between mobile devices and Animist IOT nodes. The goal is to enable Ethereum contracts to execute conditionally on the basis of authenticable iBeacon proximity events triggered by a mobile client. 

Key issues here include:

+ iBeacon signal management
+ Ethereum account management on devices 
+ Secure local connection/auth between IOT Node and mobile device
+ Bundling for inclusion in an Ionic application

Cordova dependencies

```
// BluetoothLE
$ cordova plugin add cordova-plugin-bluetoothle
// iBeacon
$ cordova plugin add com.unarin.cordova.beacon
// iOS Keychain
cordova plugin add https://github.com/shazron/KeychainPlugin.git
```













