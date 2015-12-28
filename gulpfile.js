/**
 * Gulp Dependencies
 */
var gulp = require('gulp');
var babel = require('gulp-babel');
var notify = require('gulp-notify');
var sourcemaps = require('gulp-sourcemaps');

/**
 * Some useful vars.
 */
var sourceDir = 'src';
var destinationDir = 'dist';

/**
 * Transpile ES6 code to ES5 to be interpreted by NodeJS engine.
 */
gulp.task('babel', function (cb) {
  gulp.src(sourceDir + '/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel())
    .on('error', notify.onError('<%= error.message %>'))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(destinationDir))
    .on('end', cb);
});

/**
 * This task watch for changes on JavaScript files.
 *
 * Each time the files changes the flow task is called.
 */
gulp.task('watch', function () {
  gulp.watch(sourceDir + '/**/*.js', ['babel'])
});
