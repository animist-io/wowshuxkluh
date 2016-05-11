var gulp = require('gulp');
var karma = require('karma').server;

gulp.task('test', function(done) {
    karma.start({
        configFile: __dirname + '/karma.conf.js',
        singleRun: false,
        autoWatch: true
    }, function() {
        done();
    });
});
