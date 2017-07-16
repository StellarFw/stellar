'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.test = undefined;

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

require('winston-daily-rotate-file');

var _BeautifulLogger = require('../BeautifulLogger');

var _BeautifulLogger2 = _interopRequireDefault(_BeautifulLogger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {
  logger(api) {
    let logger = { transports: []

      // check if this Stellar instance is the Master
    };if (_cluster2.default.isMaster) {
      logger.transports.push(() => {
        return new _BeautifulLogger2.default({
          colorize: true,
          level: 'info',
          timestamp: true
        });
      });
    }

    // add a file logger
    let logDirectory = api.config.general.paths.log;

    try {
      _fs2.default.mkdirSync(logDirectory);
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw new Error(`Cannot create log directory @ ${logDirectory}`);
      }
    }

    logger.transports.push((api, winston) => {
      return new winston.transports.DailyRotateFile({
        filename: `${logDirectory}/${api.pids.title}.log`,
        datePattern: 'yyyy-MM-dd.',
        prepend: true,
        level: 'info',
        timestamp: true
      });
    }

    // define the maximum length of params to log (we will truncate)
    );logger.maxLogStringLength = 100;

    return logger;
  }

};
const test = exports.test = {
  logger(api) {
    return {
      transports: null
    };
  }
};