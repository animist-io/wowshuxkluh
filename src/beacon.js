'use strict';

angular.module('animist').service('AnimistBeacons', AnimistBeacons);

function AnimistBeacons (
    $rootScope,
    $q,
    $cordovaBeacon,
    AnimistBluetoothCore,
    AnimistBluetoothAuto,
    AnimistConstants) {
  var self = this;
  var core = AnimistBluetoothCore;
  var auto = AnimistBluetoothAuto;
  var config = AnimistConstants;
  var lock = false;
  var counter = 0;
  var regions = [];

  self.initialized = false;

  /**
   * Registers app to listen for Animist beacons in background mode on iOS.
   * @method initialize()
   * @param {String} authType (iOS 8+ only) Permission level of beacon monitoring to request ('always' OR 'whenInUse')
   * @return {Promise} Resolves on success, rejects if user does not authorize.
   */
  self.initialize = function (authType) {
    var on = $rootScope.$on;

    // Return if initialized. Also beacons cannot run in browser + output is annoying in XCode.
    if (self.initialized) { return $q.when(); }

    requestUserAuthorization(authType);

    // Register handlers
    on('$cordovaBeacon:didExitRegion', function (event, result) {
      onExit(result);
    });
    on('$cordovaBeacon:didRangeBeaconsInRegion', function (event, result) {
      onCapture(result);
    });

    return $q.all([
      self.addRequestableBeacon(config.platformBeaconUuid),
      self.userAuthorized(),
      $cordovaBeacon.getAuthorizationStatus()
    ])
    .then(function () { self.initialized = true; })
    .catch(function () { self.initialized = false; });
  };

  /**
   * Adds a region to monitor and range for.
   * @param {String} uuid v4 uuid
   * @return {Promise} Rejects if too many beacon regions are being monitored, resolves otherwise.
  */
  self.addRequestableBeacon = function (uuid) {
    return self.getAllRequestableBeacons().then(function (regions) {
      if (regions.length < config.maxRequestableBeaconRegions) {
        var region = $cordovaBeacon.createBeaconRegion('r_' + counter, uuid, null, null, true);
        $cordovaBeacon.startMonitoringForRegion(region);
        $cordovaBeacon.startRangingBeaconsInRegion(region);
        counter++;
      } else return $q.reject();
    });
  };

  /**
   * Gets array of currently monitored requestable beacon regions
   * @return {Promise} Resolves array of beacon regions or rejects with $cordovaBeacon error
   */
  self.getAllRequestableBeacons = function () {
    var index;

    return $cordovaBeacon.getMonitoredRegions().then(function (regions) {
      // Find and exclude the platform beacon
      index = regions.map(function (region) { return region.uuid; }).indexOf(config.platformBeaconUuid);

      (index !== -1)
        ? regions.splice(index, 1)
        : null;

      return regions;
    });
  };

  /**
   * Stops monitoring and ranging for a specified requestable beacon.
   * @param  {String} uuid v4 iBeacon uuid
   * @return {Promise} Rejects if unable to find uuid in currently monitored beacon set, resolves otherwise
   */
  self.clearRequestableBeacon = function (uuid) {
    var index;
    return self.getAllRequestableBeacons().then(function () {
      index = regions.map(function (region) { return region.uuid; }).indexOf(uuid);
      if (index !== -1) {
        $cordovaBeacon.stopMonitoringForRegion(regions[index]);
        $cordovaBeacon.stopRangingBeaconsInRegion(regions[index]);
      } else return $q.reject();
    });
  };

  /**
   * Stops monitoring and ranging for ALL beacons EXCEPT the universal platform beacon
   * @return {Promise} Rejects on $cordovaBeacon layer error.
   */
  self.clearAllRequestableBeacons = function () {
    return $q.all([
      $cordovaBeacon.getMonitoredRegions(),
      $cordovaBeacon.getRangedRegions()
    ])
    .then(function (results) {
      angular.forEach(results[0], function (region) {
        if (region.uuid !== config.platformBeaconUuid) {
          $cordovaBeacon.stopMonitoringForRegion(region);
        }
      });

      angular.forEach(results[1], function (region) {
        if (region.uuid !== config.platformBeaconUuid) {
          $cordovaBeacon.stopRangingBeaconsInRegion(region);
        }
      });
    });
  };

  /**
   * Clears all requestableBeacons (e.g. stops monitoring and ranging for them permanently), unregisters the auto callback,
   * and resets bleCore (e.g. wipes the current core.peripheral object )
   * @return {Promise} Resolves on successful reset, rejects with a $cordovaBeacon error otherwise.
   */
  self.reset = function () {
    return self.clearAllRequestableBeacons().then(function () {
      self.initialized = false;
      core.reset();
    });
  };

  /**
   * iOS 8+ only: Checks to see if user actually authorized requested beacon monitoring permission.
   * @return {Promise} Resolves if user authorization occured, rejects with NO_BEACON_AUTHORIZATION otherwise
   */
  self.userAuthorized = function () {
    return $cordovaBeacon.getAuthorizationStatus().catch(function () {
      return $q.reject(config.NO_BEACON_AUTHORIZATION);
    });
  };

  /**
   * iOS 8+ only: Requests beacon detection permission from app user.
   * @param  {String} authType Either 'always' OR 'whenInUse'
   */
  function requestUserAuthorization (authType) {
    if (authType === angular.isUndefined || authType === config.authBeaconDetectionAlways) {
      $cordovaBeacon.requestAlwaysAuthorization();
    } else if (authType === config.authBeaconDetectionWhenInUse) {
      $cordovaBeacon.requestWhenInUseAuthorization();
    }
  }

  /**
   * Called when monitoring exits a region. 'Resets' AnimistBLE, making it possible to
   * open a new server connection with an endpoint.
   * @method onExit
   * @param { Object } A beacon object which specifies the region uuid but not major/minor.
  */
  function onExit (result) {
    (result.region)
      ? core.reset()
      : null;
  }

  /**
   * Called when ranging detects a beacon. Passes beacon uuid and proximity to AnimistBLE
   * (When in range of beacon, this callback gets hit ~500ms - i.e. frequently)
   * @method onCapture
   * @param { Array } Array of beacon objects which specify the region uuid & their major/minor.
  */
  function onCapture (result) {
    var beacons = result.beacons;
    var where = 'AnimistBeacons:onCapture';

    // Nonsense
    if (beacons.length && !lock) {
      lock = true;
      angular.forEach(beacons, function (beacon) {
        auto.listen(beacon.uuid, beacon.proximity);
        lock = false;
      });
    }
  }

  // ----------------------------------- Development Utilities -----------------------------------------------
  // var logger = function (msg, obj) {
    // Meteor.call('ping', msg + ' ' + JSON.stringify(obj));
  // };
}
