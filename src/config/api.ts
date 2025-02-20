import { API } from "../common/types/api.types.ts";
import { GeneralConfig } from "../common/types/configs/general.types.ts";

/**
 * General configs.
 */
export default {
	general(api: API): GeneralConfig {
		return {
			apiVersion: "0.0.1",
			serverName: "Stellar API",
			serverToken: "change-me",
			welcomeMessage: "Hello human! Welcome to Stellar",
			cachePrefix: "stellar:cache",
			lockPrefix: "stellar:lock",
			lockDuration: 1000 * 10, // 10 seconds
			developmentMode: true,
			simultaneousActions: 5,
			enforceConnectionProperties: true,
			filteredParams: [],
			channel: "stellar",
			rpcTimeout: 5000,
			defaultMiddlewarePriority: 100,
			defaultListenerPriority: 100,
			directoryFileType: "index.html",
			paths: {
				public: `${api.scope.rootPath}/public`,
				temp: `${api.scope.rootPath}/temp`,
				pid: `${api.scope.rootPath}/temp/pids`,
				log: `${api.scope.rootPath}/temp/logs`,
			},
			startingChatRooms: {
				defaultRoom: {},
			},
			enableSystemActions: true,
			generateDocumentation: true,
			salt: "$2a$10$NH3tXRj/M1YX6cXn2RmVI.CFOiKGJz59qfoD3Coe1rN1TJi9olK1S",
			saltLength: 10,
			saltRounds: 10,
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
	general(): Partial<GeneralConfig> {
		return {
			// set the server identifier during testing
			id: "test-server",
			serverToken: `server-Token-${Deno.pid}`,

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
	general(): Partial<GeneralConfig> {
		return {
			developmentMode: false,
		};
	},
};
