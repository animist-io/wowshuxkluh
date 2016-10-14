var gulp = require('gulp');
var gulpDocs = require('gulp-ngdocs');
var connect = require('gulp-connect');
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

gulp.task('ngdocs', [], function () {

  var options = {
    startPage: '/api/gitphaser.service:Beacons',
    title: "GitPhaser Docs",
    image: "www/img/phaser.png",
    imageLink: "https://github.com/git-phaser/git-phaser",
    titleLink: "/api"
  };
  return gulp.src('www/js/{,*/}*.js')
    .pipe(gulpDocs.process(options))
    .pipe(gulp.dest('./docs'));
});

gulp.task('connect_ngdocs', function() {
var connect = require('gulp-connect');
  connect.server({
    root: 'docs',
    livereload: false,
    fallback: 'docs/index.html',
    port: 8083
  });
});
