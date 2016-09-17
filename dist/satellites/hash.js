'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bcrypt = require('bcrypt');

var _bcrypt2 = _interopRequireDefault(_bcrypt);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * This class is a wrapper for bcrypt library.
 *
 * This allow users hash data and compare plain data with
 * and hash to validate them.
 */
var Hash = function () {

  /**
   * Create a new class instance.
   *
   * @param api   API object reference.
   */
  function Hash(api) {
    _classCallCheck(this, Hash);

    this.api = null;
    this.api = api;
  }

  // ---------------------------------------------------------------------------------------------------------- [Public]

  /**
   * Generate new bcrypt salt
   *
   * @param rounds        Number of rounds
   * @returns {Promise}
   */


  /**
   * API reference object.
   *
   * @type {null}
   */


  _createClass(Hash, [{
    key: 'generateSalt',
    value: function generateSalt() {
      var rounds = arguments.length <= 0 || arguments[0] === undefined ? this.api.config.general.saltRounds : arguments[0];

      return new Promise(function (resolve, reject) {
        _bcrypt2.default.genSalt(rounds, function (error, salt) {
          return error ? reject(error) : resolve(salt);
        });
      });
    }

    /**
     * Generate a new bcrypt salt in sync mode
     *
     * @param rounds  Number of rounds
     */

  }, {
    key: 'generateSaltSync',
    value: function generateSaltSync() {
      var rounds = arguments.length <= 0 || arguments[0] === undefined ? this.api.config.general.saltRounds : arguments[0];
      return _bcrypt2.default.genSaltSync(rounds);
    }

    /**
     * Hash data
     *
     * @param data          Data to hash
     * @param _config       Additional configuration where you can override pre-defined config
     * @return {Promise}
     */

  }, {
    key: 'hash',
    value: function hash(data) {
      var _config = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var self = this;

      // build the configs object
      var config = self._getConfigs(_config);

      // create a new promise and generate the hash
      return new Promise(function (resolve, reject) {
        _bcrypt2.default.hash(data, config.salt || config.saltLength, function (error, hash) {
          return error ? reject(error) : resolve(hash);
        });
      });
    }

    /**
     * Hash data in sync mode
     *
     * @param data        Data to hash
     * @param _config     Additional configuration where you can override pre-defined config
     * @returns {String}  Returns hashed data
     */

  }, {
    key: 'hashSync',
    value: function hashSync(data) {
      var _config = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var self = this;

      // build the configs object
      var config = self._getConfigs(_config);

      // hash the data with the bcrypt
      return _bcrypt2.default.hashSync(data, config.salt || config.saltLength);
    }

    /**
     * Compare hash with plain data
     *
     * @param plainData     Plain data
     * @param hash          Hash to compare with
     * @returns {Promise}
     */

  }, {
    key: 'compare',
    value: function compare(plainData, hash) {
      return new Promise(function (resolve, reject) {
        _bcrypt2.default.compare(plainData, hash, function (error, equal) {
          return error ? reject(error) : resolve(equal);
        });
      });
    }

    /**
     * Compare data with hash in sync mode
     *
     * @param plainData     Plain data
     * @param hash          Hash to compare with
     * @returns {Boolean}   Returns true if equal
     */

  }, {
    key: 'compareSync',
    value: function compareSync(plainData, hash) {
      return _bcrypt2.default.compareSync(plainData, hash);
    }

    // --------------------------------------------------------------------------------------------------------- [Private]

    /**
     * Get configs to be used on the generation.
     *
     * @param _configs  User defined configs
     * @returns {{}}
     * @private
     */

  }, {
    key: '_getConfigs',
    value: function _getConfigs() {
      var _configs = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var self = this;

      return _utils2.default.hashMerge({
        salt: self.api.config.general.salt,
        saltRounds: self.api.config.general.saltRounds,
        saltLength: self.api.config.general.saltLength
      }, _configs);
    }
  }]);

  return Hash;
}();

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 400;
  }

  /**
   * Satellite load priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Satellite loading function.l
     *
     * @param api     API reference object
     * @param next    Callback function
     */
    value: function load(api, next) {
      // put the hash functions available to everyone
      api.hash = new Hash(api);

      // finish the satellite loading
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;