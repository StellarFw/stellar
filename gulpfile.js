/**
 * Gulp Dependencies
 */
var gulp = require('gulp');
var babel = require('gulp-babel');
var notify = require('gulp-notify');
var eslint = require('gulp-eslint');
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
 * Lint JavaScript files using eslint tool.
 */
gulp.task('lint', function () {
  // Return the stream from the task;
  // Otherwise, the task may end before the stream has finished.
  return gulp.src('src/**/*.js')
    // eslint() attaches the lint output to the "eslint" property
    // of the file object so it can be used by other modules.
    .pipe(eslint())
    // eslint.format() outputs the lint result to the console.
    .pipe(eslint.format())
    // to have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failAfterError() last.
    .pipe(eslint.failAfterError());
});

/**
 * This task watch for changes on JavaScript files.
 *
 * Each time the files changes the flow task is called.
 */
gulp.task('watch', function () {
  gulp.watch(sourceDir + '/**/*.js', ['babel'])
});
