import cluster from 'cluster'
import fs from 'fs'
import 'winston-daily-rotate-file'

export default {
  logger (api) {
    let logger = {transports: []}

    // check if this Stellar instance is the Master
    if (cluster.isMaster) {
      logger.transports.push((api, winston) => {
        return new (winston.transports.Console)({
          colorize: true,
          level: 'info',
          timestamp: true
        })
      })
    }

    // add a file logger
    let logDirectory = api.config.general.paths.log

    try {
      fs.mkdirSync(logDirectory)
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw new Error(`Cannot create log directory @ ${logDirectory}`)
      }
    }

    logger.transports.push((api, winston) => {
      return new (winston.transports.DailyRotateFile)({
        filename: `${logDirectory}/${api.pids.title}.log`,
        datePattern: 'yyyy-MM-dd.',
        prepend: true,
        level: 'info',
        timestamp: true
      })
    })

    // define the maximum length of params to log (we will truncate)
    logger.maxLogStringLength = 100

    return logger
  }

}

export const test = {
  logger (api) {
    return {
      transports: null
    }
  }
}
