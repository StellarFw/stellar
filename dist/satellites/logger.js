'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 120;
  }

  _createClass(_class, [{
    key: 'load',
    value: function load(api, next) {
      var transports = [];

      // load all transports
      for (var i in api.config.logger.transports) {
        var t = api.config.logger.transports[i];

        if (typeof t === 'function') {
          transports.push(t(api, _winston2.default));
        } else {
          transports.push(t);
        }
      }

      // create the logger instance
      api.logger = new _winston2.default.Logger({ transports: transports });

      // define the log level
      if (api.config.logger.levels) {
        api.logger.setLevels(api.config.logger.levels);
      } else {
        api.logger.setLevels(_winston2.default.config.syslog.levels);
      }

      // define log colors
      if (api.config.logger.colors) {
        _winston2.default.addColors(api.config.logger.colors);
      }

      // define an helper function to log
      api.log = function (msg) {
        var level = arguments.length <= 1 || arguments[1] === undefined ? 'info' : arguments[1];

        var args = [level, msg];

        args.push.apply(args, Array.prototype.slice.call(arguments, 2));
        api.logger.log.apply(api.logger, args);
      };

      var logLevels = [];
      for (var _i in api.logger.levels) {
        logLevels.push(_i);
      }

      api.log('*** starting Stellar ***', 'notice');
      api.log('Logger loaded. Possible levels include: ', 'debug', logLevels);

      next();
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=logger.js.map
