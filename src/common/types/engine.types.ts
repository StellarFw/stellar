/**
 * Enumeration with the available log levels.
 */
export enum LogLevel {
	Debug = "debug",
	Info = "info",
	Notice = "notice",
	Warning = "warning",
	Alert = "alert",
	Error = "error",
	Emergency = "emergency",
}

/**
 * The different states that the engine has.
 */
export enum EngineStatus {
	Stopped = "stopped",
	Stage0 = "init_stage0",
	Stage1 = "init_stage1",
	Running = "running",
	Stopping = "stopping",
}
