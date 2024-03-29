/**
 * General configs.
 */
export default {
	general(api) {
		return {
			// ---------------------------------------------------------------------
			// API version
			// ---------------------------------------------------------------------
			apiVersion: "0.0.1",

			// ---------------------------------------------------------------------
			// Server name
			// ---------------------------------------------------------------------
			serverName: "Stellar API",

			// ---------------------------------------------------------------------
			// A unique token to the application that servers will use to
			// authenticate to each other
			//
			// If this is not present an id will be generated dynamically.
			// ---------------------------------------------------------------------
			serverToken: "change-me",

			// ---------------------------------------------------------------------
			// Welcome message seen by TCP and WebSocket clients upon connection
			// ---------------------------------------------------------------------
			welcomeMessage: "Hello human! Welcome to Stellar",

			// ---------------------------------------------------------------------
			// The Redis prefix for Stellar's cache objects
			// ---------------------------------------------------------------------
			cachePrefix: "stellar:cache",

			// ---------------------------------------------------------------------
			// The Redis prefix for Stellar's cache/lock objects
			// ---------------------------------------------------------------------
			lockPrefix: "stellar:lock",

			// ---------------------------------------------------------------------
			// How long will a lock last before it expires (ms)
			// ---------------------------------------------------------------------
			lockDuration: 1000 * 10, // 10 seconds

			// ---------------------------------------------------------------------
			// By default the Stellar are in development mode
			// ---------------------------------------------------------------------
			developmentMode: true,

			// ---------------------------------------------------------------------
			// Number of action who can be executed simultaneous by a single
			// connection.
			// ---------------------------------------------------------------------
			simultaneousActions: 5,

			// ---------------------------------------------------------------------
			// Allow connection to be created without remoteIP and remotePort
			//
			// They will be set to 0
			// ---------------------------------------------------------------------
			enforceConnectionProperties: true,

			// ---------------------------------------------------------------------
			// Params you would like hidden from any logs
			// ---------------------------------------------------------------------
			filteredParams: [],

			// ---------------------------------------------------------------------
			// Which channel to use on redis pub/sub for RPC communication
			// ---------------------------------------------------------------------
			channel: "stellar",

			// ---------------------------------------------------------------------
			// How long to wait for an RPC call before considering it a failure
			// ---------------------------------------------------------------------
			rpcTimeout: 5000,

			// ---------------------------------------------------------------------
			// The default priority level given to middleware of all types
			// ---------------------------------------------------------------------
			defaultMiddlewarePriority: 100,

			// ---------------------------------------------------------------------
			// Default priority level given to listeners
			// ---------------------------------------------------------------------
			defaultListenerPriority: 100,

			// ---------------------------------------------------------------------
			// Default filetype to serve when a user requests a directory
			// ---------------------------------------------------------------------
			directoryFileType: "index.html",

			// ---------------------------------------------------------------------
			// Configurations for Stellar project structure
			// ---------------------------------------------------------------------
			paths: {
				public: `${api.scope.rootPath}/public`,
				temp: `${api.scope.rootPath}/temp`,
				pid: `${api.scope.rootPath}/temp/pids`,
				log: `${api.scope.rootPath}/temp/logs`,
			},

			// ---------------------------------------------------------------------
			// Hash containing chat rooms to be created at server boot
			//
			// Format:
			//  {roomName: {authKey, authValue}}
			//
			// Example:
			//  'secureRoom': {authorized: true}
			// ---------------------------------------------------------------------
			startingChatRooms: {
				defaultRoom: {},
			},

			// ---------------------------------------------------------------------
			// This activates some system actions, these allow obtain the status of
			// the server.
			// ---------------------------------------------------------------------
			enableSystemActions: true,

			// ---------------------------------------------------------------------
			// Documentation
			//
			// If active the Stellar will generate documentation , on the startup,
			// for all loaded actions. This will be accessible from
			// `:serverAddress/docs`.
			// ---------------------------------------------------------------------
			generateDocumentation: true,

			// ---------------------------------------------------------------------
			// Predefined salt to use in the hash functions
			//
			// Attention: you must overwrite this with your own salt
			// ---------------------------------------------------------------------
			salt: "$2a$10$NH3tXRj/M1YX6cXn2RmVI.CFOiKGJz59qfoD3Coe1rN1TJi9olK1S",

			// ---------------------------------------------------------------------
			// Predefined salt length to use in the salt generation
			// ---------------------------------------------------------------------
			saltLength: 10,

			// ---------------------------------------------------------------------
			// Number of round to use on the salt generation
			// ---------------------------------------------------------------------
			saltRounds: 10,

			// ---------------------------------------------------------------------
			// Time that an action have to send a response to the client.
			//
			// NOTE: The values is specified into milliseconds.
			// DEFAULT: 30 seconds
			// ---------------------------------------------------------------------
			actionTimeout: 30000,
		};
	},
};

/**
 * Test configs.
 *
 * @type {{}}
 */
export const test = {
	general() {
		return {
			// set the server identifier during testing
			id: "test-server",
			serverToken: `server-Token-${process.pid}`,

			// disable dev mode to speed up the tests
			developmentMode: false,

			// Ensure the creation of the `defaultRoom` and `otherRoom` rooms
			startingChatRooms: {
				defaultRoom: {},
				otherRoom: {},
			},

			// we don't need to generate documentation during testing
			generateDocumentation: false,
		};
	},
};

/**
 * Production configs.
 *
 * @type {{}}
 */
export const production = {
	general() {
		return {
			developmentMode: false,
		};
	},
};
