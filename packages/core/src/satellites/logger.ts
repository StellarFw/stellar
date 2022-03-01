import winston from "winston";

import { io, Satellite, unsafe, LogLevel } from "@stellarfw/common/lib/index.js";

export default class LoggerSatellite extends Satellite {
  protected _name = "logger";
  public loadPriority = 120;

  /**
   * Container to create the folder where to store the log files.
   *
   * TODO: change when move the utils function to the IO Monad
   */
  private createLogsFolder = io(() =>
    unsafe(() => {
      const logsDir = this.api.configs.general.paths.log;

      if (!this.api.utils.dirExists(logsDir)) {
        this.api.utils.createDir(logsDir);
      }
    }),
  );

  public async load(): Promise<void> {
    // try to create the logs folder.
    this.createLogsFolder.run().tapErr(() => {
      this.api.log(`Unable to create the logs directory(${this.api.configs.general.paths.log})`, LogLevel.Emergency);
      this.api.commands.stop();
    });

    // load all transports
    const loggers = (this.api.configs.logger.loggers || []).map((logger) =>
      typeof logger === "function" ? logger(this.api, winston) : logger,
    );

    // create the logger instance
    this.api.logger = winston.createLogger({
      transports: loggers,
      levels: this.api.configs.logger.levels ?? winston.config.syslog.levels,
    });

    // define log colors
    if (this.api.configs.logger.colors) {
      winston.addColors(this.api.configs.logger.colors);
    }

    // replace the default engine log function
    this.api.log = (msg: unknown, level: LogLevel = LogLevel.Info, ...extra: Array<unknown>) => {
      const args = [level, msg, ...extra];
      this.api.logger.log(...args);
    };

    const logLevels = Object.keys(this.api.logger.levels);
    this.api.log("** starting Stellar **", LogLevel.Notice);
    this.api.log("Logger loaded. Possible levels included:", LogLevel.Debug, logLevels);
  }
}
