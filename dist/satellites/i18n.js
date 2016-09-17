'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _i18n = require('i18n');

var _i18n2 = _interopRequireDefault(_i18n);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var I18n = function () {

  /**
   * Constructor.
   *
   * @param api   API reference.
   */


  /**
   * Stellar api object.
   */
  function I18n(api) {
    _classCallCheck(this, I18n);

    var self = this;

    // save api reference
    self.api = api;

    // save i18n instance
    self.i18n = _i18n2.default;
  }

  /**
   * Configure i18n.
   */


  /**
   * i18n instance.
   */


  _createClass(I18n, [{
    key: 'configure',
    value: function configure() {
      var self = this;

      // @todo - copy all modules locale folder to a temp folder '/tmp/locale'

      // create locale folder (remove first if exists)
      var localePath = self.api.config.general.paths.temp + '/locale';
      _utils2.default.removeDirectory(localePath);
      _fs2.default.mkdirSync(localePath);

      // iterate all modules
      for (var module in self.api.modules.activeModules.keys()) {
        var _localePath = self.api.scope.rootPath + '/modules/' + module + '/locale';

        // check if the folder exists
        if (_utils2.default.directoryExists(_localePath)) {
          // copy all files to temp locale folder
        }
      }

      // get i18n configs
      var options = self.api.config.i18n;

      // define locale folder
      options.directory = localePath;

      // configure application
      self.i18n.configure(options);

      // setting the current locale globally
      self.i18n.setLocale(self.api.config.i18n.defaultLocale);
    }

    /**
     * Determine the current client locale from connection.
     *
     * @param connection  Client connection object.
     */

  }, {
    key: 'determineConnectionLocale',
    value: function determineConnectionLocale(connection) {
      return this.api.config.i18n.defaultLocale;
    }

    /**
     * Invoke the connection locale method.
     *
     * @param connection  Client connection object.
     */

  }, {
    key: 'invokeConnectionLocale',
    value: function invokeConnectionLocale(connection) {
      var self = this;

      // split the command by '.'
      var cmdParts = self.api.config.i18n.determineConnectionLocale.split('.');

      // get the first array position
      var cmd = cmdParts.shift();

      // this only works with the api object
      if (cmd !== 'api') {
        throw new Error('cannot operate on a method outside of the api object');
      }

      // execute method
      var locale = eval('self.api.' + cmdParts.join('.') + '(connection)');

      // set locale
      self.i18n.setLocale(connection, locale);
    }

    /**
     * Localize a message.
     *
     * @param message   Message to be localized.
     * @param options   Localization options.
     * @returns {*}     Localized message.
     */

  }, {
    key: 'localize',
    value: function localize(message, options) {
      var self = this;

      // the arguments should be an array
      if (!Array.isArray(message)) {
        message = [message];
      }

      if (!options) {
        options = self.i18n;
      }

      return self.i18n.__.apply(options, message);
    }
  }]);

  return I18n;
}();

/**
 * Initializer class.
 *
 * This initializer adds support to i18n localization.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 10;
  }

  /**
   * Load priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Load initializer method.
     *
     * @param api   Stellar api object.
     * @param next  Callback.
     */
    value: function load(api, next) {
      // add i18n class to the api object
      api.i18n = new I18n(api);

      // configure i18n
      api.i18n.configure();

      // call callback
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;