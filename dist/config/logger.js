'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.test = undefined;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {

  logger: function logger(api) {
    var logger = { transports: [] };

    // check if this Stellar instance is the Master
    if (_cluster2.default.isMaster) {
      logger.transports.push(function (api, winston) {
        return new winston.transports.Console({
          colorize: true,
          level: 'info',
          timestamp: true
        });
      });
    }

    // add a file logger
    var logDirectory = api.config.general.paths.log;

    try {
      _fs2.default.mkdirSync(logDirectory);
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw new Error('Cannot create log directory @ ' + logDirectory);
      }
    }

    logger.transports.push(function (api, winston) {
      return new winston.transports.File({
        filename: logDirectory + '/' + api.pids.title + '.log',
        level: 'info',
        timestamp: true
      });
    });

    // define the maximum length of params to log (we will truncate)
    logger.maxLogStringLength = 100;

    return logger;
  }

};
var test = exports.test = {
  logger: function logger(api) {
    return {
      transports: null
    };
  }
};