import winston from "winston";

import { io, Satellite } from "@stellarfw/common/lib";
import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";

export default class LoggerSatellite extends Satellite {
  protected _name: string = "logger";
  public loadPriority: number = 120;

  /**
   * Container to create the folder where to store the log files.
   */
  private createLogsFolder = io(() => {
    const logsDir = this.api.configs.general.paths.log;

    if (!this.api.utils.dirExists(logsDir)) {
      this.api.utils.createDir(logsDir);
    }
  });

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
    this.api.log = (msg: any, level: LogLevel = LogLevel.Info) => {
      const args = [level, msg];

      args.push.apply(args, Array.prototype.splice.call(arguments, 2, 0));
      this.api.logger.log.apply(this.api.logger, args);
    };

    const logLevels = Object.keys(this.api.logger.levels);
    this.api.log("** starting Stellar **", LogLevel.Notice);
    this.api.log("Logger loaded. Possible levels included:", LogLevel.Debug, logLevels);
  }
}
