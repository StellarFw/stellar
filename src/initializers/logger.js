import winston from 'winston';

export default class {

  static loadPriority = 10;

  static load(api, next) {
    let transports = [];

    // load all transports
    for (let i in api.config.logger.transports) {
      let t = api.config.logger.transports[ i ];

      if (typeof t === 'function') {
        transports.push(t(api, winston));
      } else {
        transports.push(t);
      }
    }

    // create the logger instance
    api.logger = new winston.Logger({transports: transports});

    // define the log level
    if (api.config.logger.levels) {
      api.logger.setLevels(api.config.logger.levels);
    } else {
      api.logger.setLevels(winston.config.syslog.levels);
    }

    // define log colors
    if (api.config.logger.colors) {
      winston.addColors(api.config.logger.colors);
    }

    // define an helper function to log
    api.log = function (msg, level = 'info') {
      let args = [ level, msg ];

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
