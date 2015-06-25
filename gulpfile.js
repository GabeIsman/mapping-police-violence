var gulp = require('gulp');

var rename = require('gulp-rename');
var merge = require('merge2');
var jshint = require('gulp-jshint');
var compass = require('gulp-compass');
var jade = require('gulp-jade');
var source = require('vinyl-source-stream');
var watchify = require('watchify');
var browserify = require('browserify');
var async = require('async');
var _ = require('underscore');
var notify = require('gulp-notify');
var fs = require('fs');

var parseCsv = require('./tasks/parsecsv');
var stringifyCsv = require('./tasks/stringifyCsv');
var filterColumns = require('./tasks/filtercolumns');
var renameColumns = require('./tasks/renameColumns');
var where = require('./tasks/where');
var join = require('./tasks/join');
var objectify = require('./tasks/objectify');
var wrap = require('./tasks/wrap');
var combine = require('./tasks/combine');
var prefixColumns = require('./tasks/prefixColumns');

var downloadCensusTables = require('./scripts/download-census-tables');
var geocode = require('./scripts/geocode');

var DEST = 'public/';
var DATA_DEST = DEST + 'data/';
var APP = 'app/';
var CSS_DEST = DEST + 'css/';



gulp.task('violencedata', function() {
  return merge(
      merge(
          gulp.src('srcdata/fips.csv')
            .pipe(parseCsv({auto_parse: true}))
            .pipe(filterColumns(['NAME', 'FIPS']))
            .pipe(renameColumns()),
          gulp.src('srcdata/kaiser-foundation-pop-estimates.csv') // This needs to be replaced with something more reliable.
            .pipe(parseCsv({auto_parse: true}))
            .pipe(filterColumns(['Location', 'Total']))
            .pipe(renameColumns({
              Location: 'name',
              Total: 'pop'
            })))
        .pipe(join({joinColumn: 'name'}))
        .pipe(rename({basename: 'populations'}))
        .pipe(objectify({indexColumn: 'fips'})),
      gulp.src('srcdata/us.topo.json'),
      gulp.src('public/data/the-counted.json')
        .pipe(rename({basename: 'killings'}))
    )
    .pipe(wrap())
    .pipe(rename({
      basename: 'policeviolencemap',
      extname: '.json'
    }))
    .pipe(gulp.dest(DATA_DEST))
    .on('error', function(error) {
      console.log(error);
    });
});


gulp.task('convert-the-counted-to-json', function() {
  gulp.src('srcdata/the-counted.csv')
    .pipe(parseCsv({ auto_parse: true }))
    .pipe(rename({ basename: 'the-counted', extname: '.json' }))
    .pipe(objectify())
    .pipe(gulp.dest('public/data/'));
});


gulp.task('geocode', function() {
  var file = 'public/data/the-counted.json';
  var data = JSON.parse(fs.readFileSync(file));
  geocode(data, function(data) {
    fs.writeFileSync(file, JSON.stringify(data));
  });
});


gulp.task('lint', function() {
  gulp.src(['./app/**/*.js', './tasks/**/*.js', 'gulpfile.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});


// Monitor js files and rebuild dependency trees on change
gulp.task('bundlejs', function() {
  var bundler = watchify(browserify('./' + APP + 'javascript/index.js', watchify.args));

  bundler.on('update', rebundle);

  function rebundle() {
    return bundler.bundle()
      .on('error', notify.onError("JS error: <%= error.message %>"))
      .pipe(source('build.js'))
      .pipe(gulp.dest(DEST + '/javascript/'));
  }

  return rebundle();
});

// Monitor less and main jade template for changes
gulp.task('watch', ['bundlejs'], function() {

  gulp.watch(APP + '/stylesheets/**', ['styles']);
  gulp.watch(APP + '/templates/*.jade', ['html']);
});

// Render jade template to html
gulp.task('html', function() {
  gulp.src(APP + '/templates/index.jade')
    .pipe(jade({
      pretty: true
    }))
    .pipe(gulp.dest(DEST))
    .on("error", notify.onError("Html error: <%= error.message %>"));
});

// Watch less files for changes and compile to css
gulp.task('styles', function() {
  gulp.src(APP + '/stylesheets/**/*.scss')
    .pipe(compass({
      sass: APP + 'stylesheets/',
      css: DEST + 'css/',
      image: DEST + 'images/',
      font: DEST + 'fonts/'
    }))
    .pipe(gulp.dest(DEST + 'css/'))
    .on("error", notify.onError("Styles error: <%= error.message %>"));
});

