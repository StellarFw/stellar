'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = class {
  constructor() {
    this.loadPriority = 120;
  }

  load(api, next) {
    let transports = [];

    // load all transports
    for (let i in api.config.logger.transports) {
      let t = api.config.logger.transports[i];

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
    api.log = function (msg, level = 'info') {
      let args = [level, msg];

      args.push.apply(args, Array.prototype.slice.call(arguments, 2));
      api.logger.log.apply(api.logger, args);
    };

    let logLevels = [];
    for (let i in api.logger.levels) {
      logLevels.push(i);
    }

    api.log('*** starting Stellar ***', 'notice');
    api.log('Logger loaded. Possible levels include: ', 'debug', logLevels);

    next();
  }

};