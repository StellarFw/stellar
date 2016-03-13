import fs from 'fs';
import cluster from 'cluster';

export default {

  consoleLevel: function (api) {
    return 'debug';
  },

  logger: function (api) {
    let logger = {transports: []};

    // check if this Stellar instance is the Master
    if (cluster.isMaster) {
      logger.transports.push((api, winston) => {
        return new (winston.transports.Console)({
          colorize: true,
          level: 'info',
          timestamp: true
        });
      })
    }

    // add a file logger
    let logDirectory = api.config.general.paths.log;

    try {
      fs.mkdirSync(logDirectory);
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw new Error(`Cannot create log directory @ ${logDirectory}`);
      }
    }

    logger.transports.push((api, winston) => {
      return new (winston.transports.File)({
        filename: `${logDirectory}/${api.pids.title}.log`,
        level: 'info',
        timestamp: true
      });
    });

    // define the maximum length of params to log (we will truncate)
    logger.maxLogStringLength = 100;

    return logger;
  }

};
