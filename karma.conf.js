// Karma configuration
// Generated on Tue May 10 2016 18:16:56 GMT-0700 (PDT)

module.exports = function(config) {

   var configuration = {

      // base path that will be used to resolve all patterns (eg. files, exclude)
      basePath: '',


      // frameworks to use
      // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
      frameworks: ['jasmine'],


      // list of files / patterns to load in the browser
      files: [

         "bower_components/angular/angular.js",
         "bower_components/angular-mocks/angular-mocks.js",
         "node_modules/eth-lightwallet/dist/lightwallet.min.js",
      
         "src/animist.js",
         "src/accounts.js",
         "src/beacon.js",
         "src/ble.js",

         //"tests/animist.mocks.js",
         //"tests/bluetooth.spec.js",
         //"tests/beacon.spec.js"

         "tests/*.js"
      ],


      // list of files to exclude
      exclude: [
      ],


      customLaunchers: {
         Chrome_without_security: {
            base: 'Chrome',
            flags: ['--disable-web-security']
         },

         Chrome_travis_ci: {
            base: 'Chrome',
            flags: ['--no-sandbox']
         }
      },

      plugins: [
         "karma-chrome-launcher",
         "karma-jasmine",
         "karma-mocha-reporter",
         "karma-ng-html2js-preprocessor"
      ],

      // preprocess matching files before serving them to the browser
      // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
      /*
      preprocessors: {
         'www/templates/*.html': ['ng-html2js']
      },

      
      ngHtml2JsPreprocessor: {
         moduleName: 'templates',
         stripPrefix: 'www/'
      },
      */
       
      // test results reporter to use
      // possible values: 'dots', 'progress'
      // available reporters: https://npmjs.org/browse/keyword/karma-reporter
      reporters: ['mocha'],


      // web server port
      port: 9876,


      // enable / disable colors in the output (reporters and logs)
      colors: true,


      // level of logging
      // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
      logLevel: config.LOG_INFO,


      // enable / disable watching file and executing tests whenever any file changes
      autoWatch: true,


      // start these browsers
      // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
      browsers: ['Chrome'],


      // Continuous Integration mode
      // if true, Karma captures browsers, runs the tests and exits
      singleRun: false,

      // Concurrency level
      // how many browser should be started simultaneous
      concurrency: Infinity
   };

   if (process.env.TRAVIS) {
      configuration.browsers = ['Chrome_travis_ci'];
   }
 
   config.set(configuration);
}
