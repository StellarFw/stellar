import Log from 'log';
import _ from 'lodash';
import path from 'path';
import async from 'async';

export default class Engine {

  /**
   * API object.
   *
   * @type {{}}
   */
  api = {};

  /**
   * List with all initialisers.
   *
   * @type {{}}
   */
  initialisers = {};

  /**
   * Create a new instance of Stellar Engine.
   *
   * @param scope - Initial scope
   */
  constructor(scope) {
    // default scope configs
    var defaultScope = {
      debug: 'error'
    };

    // save the app scope
    this.api.scope = _.merge(scope, defaultScope);

    // create a log instance
    this.api.log = new Log(this.api.scope.debug);
  }

  /**
   * Start engine execution.
   */
  start() {
    // print current execution path
    this.api.log.info(`Current universe "${this.api.scope.rootPath}"`);

    // start stage0 loading method
    this.stage0();
  }

  stage0() {
    var self = this;

    // reset config stage0 initialisers
    this.stage0Initialisers = [];

    // we need to load the config first
    [
      path.resolve(__dirname + '/initialisers/config.js')
    ].forEach(function (file) {
      var filename = file.replace(/^.*[\\\/]/, '');
      var initializer = filename.split('.')[0];
      self.initialisers[initializer] = require(file);
      self.stage0Initialisers.push(function (next) {
        self.initialisers[initializer].load(this.api, next);
      });
    });

    // add stage1 function at the end of stage0 initializer cycle
    this.stage0Initialisers.push(this.stage1);

    // execute stage0 initialisers in series
    async.series(this.stage0Initialisers, function (error) {
      this.fatalError(self.api, error, 'stage0');
    });
  }

  /**
   * @todo
   *
   * @param api
   * @param error
   * @param s
     */
  fatalError(api, error, s) {

  }

  /**
   * @todo
   */
  stage1() {
    console.log("@todo > :D");
  }
}
