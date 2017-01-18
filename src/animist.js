angular.module('animist', []);

// Error logging utility
function errorType (where) {
  this.where = where;
  this.error = null;
}

errorType.prototype.set = function (error) { this.error = error; };

