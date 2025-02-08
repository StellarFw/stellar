export type GeneralConfig = {
	/**
	 * Identifier for the this stellar instance.
	 *
	 * This value can be overwrite using the arg `title` or the `STELLAR_TITLE` env var.
	 *
	 * When not present it will fallback to the external IP.
	 */
	id?: string;

	/**
	 * API version.
	 */
	apiVersion: string;

	/**
	 * Server name
	 */
	serverName: string;

	/**
	 * A unique token to the application that servers will use to
	 * authenticate to each other
	 *
	 * If this is not present an id will be generated dynamically.
	 */
	serverToken: string;

	/**
	 * Welcome message seen by TCP and WebSocket clients upon connection
	 */
	welcomeMessage: string;

	/**
	 * The Redis prefix for Stellar's cache objects
	 */
	cachePrefix: string;

	/**
	 * The Redis prefix for Stellar's cache/lock objects
	 */
	lockPrefix: string;

	/**
	 * How long will a lock last before it expires (ms)
	 */
	lockDuration: number;

	/**
	 * By default the Stellar are in development mode
	 *
	 * This enables some internal actions as well as to generates
	 * documentation.
	 */
	developmentMode: boolean;

	/**
	 * Number of action who can be executed simultaneous by a single
	 * connection.
	 */
	simultaneousActions: number;

	/**
	 * Allow connection to be created without remoteIP and remotePort
	 *
	 * They will be set to 0
	 */
	enforceConnectionProperties: boolean;

	/**
	 * Params you would like hidden from any logs
	 */
	filteredParams: string[];

	/**
	 * Which channel to use on redis pub/sub for RPC communication
	 */
	channel: string;

	/**
	 * How long to wait for an RPC call before considering it a failure
	 */
	rpcTimeout: number;

	/**
	 * The default priority level given to middleware of all types
	 */
	defaultMiddlewarePriority: number;

	/**
	 * Default priority level given to listeners
	 */
	defaultListenerPriority: number;

	/**
	 * Default filetype to serve when a user requests a directory
	 */
	directoryFileType: string;

	/**
	 * Configurations for Stellar project structure
	 */
	paths: Record<string, string>;

	/**
	 * Hash containing chat rooms to be created at server boot
	 *
	 * Format:
	 *  {roomName: {authKey, authValue}}
	 *
	 * Example:
	 *  'secureRoom': {authorized: true}
	 */
	startingChatRooms: Record<string, { authKey?: string; authValue?: string }>;

	/**
	 * This activates some system actions, these allow obtain the status of
	 * the server.
	 */
	enableSystemActions: boolean;

	/**
	 * Documentation
	 *
	 * If active the Stellar will generate documentation , on the startup,
	 * for all loaded actions. This will be accessible from
	 * `:serverAddress/docs`.
	 */
	generateDocumentation: boolean;

	/**
	 * Predefined salt to use in the hash functions
	 *
	 * Attention: you must overwrite this with your own salt
	 */
	salt: string;

	/**
	 * Predefined salt length to use in the salt generation
	 */
	saltLength: number;

	/**
	 * Number of round to use on the salt generation
	 */
	saltRounds: number;

	/**
	 * Time that an action have to send a response to the client.
	 *
	 * NOTE: The values is specified into milliseconds.
	 * DEFAULT: 30 seconds
	 */
	actionTimeout: number;
};

export type BaseConfig = {
	/**
	 * Array of active modules.
	 */
	modules: string[];

	general: GeneralConfig;
};
