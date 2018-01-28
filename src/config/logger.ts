import * as DailyRotateFile from 'winston-daily-rotate-file';
import BeautifulLogger from '../beautiful-logger';
import { isMaster } from 'cluster';
import { mkdirSync } from 'fs';

export default {
  logger(api) {
    const logger: any = {
      transports: [],
    };

    // check if this Stellar instance is the Master
    if (isMaster) {
      logger.transports.push(() => {
        return new BeautifulLogger(api, {
          colorize: true,
          level: 'info',
          timestamp: true,
        });
      });
    }

    // add a file logger
    const logDirectory = api.configs.general.paths.log;

    try {
      mkdirSync(logDirectory);
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw new Error(`Cannot create log directory @ ${logDirectory}`);
      }
    }

    logger.transports.push(() => {
      return new DailyRotateFile({
        filename: `${logDirectory}/${api.pids.title}.log`,
        datePattern: 'yyyy-MM-dd.',
        prepend: true,
        level: 'info',
        timestamp: true,
      });
    });

    // define the maximum length of params to log (we will truncate)
    logger.maxLogStringLength = 100;

    return logger;
  },
};

export const test = {
  logger(api) {
    return {
      transports: null,
    };
  },
};
