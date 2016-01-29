export default {

  logger: function (api) {
    let logger = {transports: []};

    // add console logger
    logger.transports.push(function (api, winston) {
      return new winston.transports.Console({
        colorize: true,
        level: 'debug',
        timestamp: true
      });
    });

    // define the maximum length of params to log (we will truncate)
    logger.maxLogStringLength = 100;

    return logger;
  }

};
