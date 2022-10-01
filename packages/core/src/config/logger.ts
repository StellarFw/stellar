import winston from "winston";
import "winston-daily-rotate-file";
import { TransformableInfo } from "logform";
import chalk from "chalk";
import cluster from "cluster";
import { LogLevel } from "@stellarfw/common";

/**
 * List of colors for each level
 */
const colors = {
	emerg: "Red",
	alert: "Yellow",
	crit: "Red",
	error: "Red",
	warning: "Red",
	notice: "Yellow",
	info: "Green",
	debug: "Blue",
};

/**
 * Serialize additional log information.
 *
 * @param info Information to be serialized.
 * @returns
 */
function extraPropsSerializer(info: any) {
	const propsToIgnore = ["message", "timestamp", "level"];

	return Object.keys(info).reduce((response: string, entryKey: any) => {
		if (propsToIgnore.includes(entryKey)) {
			return response;
		}

		const value = info[entryKey];
		if (value === undefined || value === null || value === "") {
			return response;
		}

		return `${response} ${entryKey}=${value}`;
	}, "");
}

function buildColorizeFormat() {
	return new (class Colorize {
		transform(info: TransformableInfo): TransformableInfo | boolean {
			// format log level
			if (info.level) {
				info.level = chalk[`bg${colors[info.level]}`].black(` ${info.level.toUpperCase()} `);
			}

			// format timestamp
			if (info.timestamp) {
				info.timestamp = chalk.bgWhite.black(info.timestamp);
			}

			return info;
		}
	})();
}

/**
 * Build Console logger.
 *
 * @returns
 */
function buildConsoleLogger(level: LogLevel = LogLevel.Debug) {
	return winston.createLogger({
		format: winston.format.combine(
			winston.format.timestamp(),
			buildColorizeFormat(),
			winston.format.printf((info) => `${info.timestamp}${info.level} ${info.message}${extraPropsSerializer(info)}`),
		),
		level,
		levels: winston.config.syslog.levels,
		transports: [new winston.transports.Console()],
	});
}

function buildFileLogger(api) {
	const logsDir = api.configs.general.paths.log;

	return winston.createLogger({
		levels: winston.config.syslog.levels,
		transports: [
			new winston.transports.DailyRotateFile({
				filename: `${logsDir}/${api.pids.title}.log`,
				datePattern: "yyyy-MM-dd.",
				level: LogLevel.Info,
			}),
		],
	});
}

export default {
	logger(api) {
		const loggers: Array<() => winston.Logger> = [];

		// check if this Stellar instance is the Master
		if (cluster.isPrimary) {
			loggers.push(() => buildConsoleLogger(LogLevel.Debug));
		}

		// add file logger
		loggers.push(() => buildFileLogger(api));

		return {
			// default loggers
			loggers,

			// define the maximum length of params to log (we will truncate)
			maxLogStringLength: 100,
		};
	},
};

export const test = {
	logger() {
		return {
			loggers: [buildConsoleLogger(LogLevel.Emergency)],
		};
	},
};
