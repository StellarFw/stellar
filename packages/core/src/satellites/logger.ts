import * as winston from "winston";

import { Satellite } from "@stellarfw/common/lib/satellite";
import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";

export default class LoggerSatellite extends Satellite {
  protected _name: string = "logger";
  public loadPriority: number = 120;

  /**
   * Create the folder to store the log files.
   */
  private createLogsFolder(): void {
    const logsDir = this.api.configs.general.paths.log;

    if (!this.api.utils.dirExists(logsDir)) {
      this.api.utils.createDir(logsDir);
    }
  }

  public async load(): Promise<void> {
    const transports = [];

    this.createLogsFolder();

    // load all transports
    if (this.api.configs.logger.transports) {
      this.api.configs.logger.transports.forEach(transport => {
        if (typeof transport === "function") {
          transports.push(transport(this.api, winston));
        } else {
          transports.push(transport);
        }
      });
    }

    // create the logger instance
    this.api.logger = new winston.Logger({ transports });

    // define the log level
    if (this.api.configs.logger.levels) {
      this.api.logger.setLevels(this.api.configs.logger.levels);
    } else {
      this.api.logger.setLevels(winston.config.syslog.levels);
    }

    // define log colors
    if (this.api.configs.logger.colors) {
      winston.addColors(this.api.configs.logger.colors);
    }

    // replace the default engine log function
    this.api.log = (msg: any, level: LogLevel = LogLevel.Info) => {
      const args = [level, msg];

      args.push.apply(args, Array.prototype.splice.call(arguments, 2));
      this.api.logger.log.apply(this.api.logger, args);
    };

    const logLevels = Object.keys(this.api.logger.levels);
    this.api.log("** starting Stellar **", LogLevel.Notice);
    this.api.log(
      "Logger loaded. Possible levels included:",
      LogLevel.Debug,
      logLevels,
    );
  }
}
