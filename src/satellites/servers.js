// module dependencies
import path from "path";
import async from "async";

/**
 * Manager for server instances.
 */
class Servers {
	/**
	 * Engine API instance.
	 * @type {null}
	 */
	api = null;

	/**
	 * Array with all running server instances.
	 *
	 * @type {{}}
	 */
	servers = {};

	/**
	 * Class constructor.
	 *
	 * @param api engine api instance.
	 */
	constructor(api) {
		this.api = api;
	}

	/**
	 * Load all servers.
	 */
	async loadServers() {
		// get the list of servers to load
		let serversFiles = this.api.utils.recursiveDirectoryGlob(path.resolve(`${import.meta.dirname}/../servers`));

		for (let file of serversFiles) {
			let parts = file.split(/[\/\\]+/);
			let serverName = parts[parts.length - 1].split(".")[0];

			// only load .js files (in debug we also have .map files)
			if (parts[parts.length - 1].match(".map$")) {
				continue;
			}

			// get server options if exists
			let options = this.api.config.servers[serverName];

			// only load the server if it's enabled
			if (options?.enable === true) {
				const { default: ServerConstructor } = await import(file);

				this.servers[serverName] = new ServerConstructor(this.api, options);
				this.api.log(`Initialized server: ${serverName}`, "debug");
			}
		}
	}

	/**
	 * Start all the existing servers.
	 */
	async startServers() {
		for (const serverName in this.servers) {
			let server = this.servers[serverName];

			// only load the server if the server is enabled
			if (server.options.enable !== true) {
				continue;
			}
			let message = `Starting server: ${serverName}`;

			// append the bind IP to log message
			if (this.api.config.servers[serverName].bindIP) {
				message += ` @ ${this.api.config.servers[serverName].bindIP}`;
			}

			// append the port to log message
			if (this.api.config.servers[serverName].port) {
				message += ` @ ${this.api.config.servers[serverName].port}`;
			}

			this.api.log(message, "notice");
			try {
				await server.start();
				this.api.log(`Server started: ${serverName}`, "debug");
			} catch (error) {
				this.api.log(`Failed to start server "${serverName}"`, "emerg");
			}
		}
	}

	/**
	 * Stop all running servers.
	 *
	 * @param next  Callback function.
	 */
	stopServers(next) {
		// array with the jobs to stop all servers
		let jobs = [];

		Object.keys(this.servers).forEach((serverName) => {
			// get server instance
			let server = this.servers[serverName];

			// check if the server are enable
			if ((server && server.options.enable === true) || !server) {
				jobs.push((done) => {
					this.api.log(`Stopping server: ${serverName}`, "notice");

					// call the server stop method
					server.stop((error) => {
						if (error) {
							return done(error);
						}
						this.api.log(`Server stopped ${serverName}`, "debug");
						return done();
					});
				});
			}
		});

		// execute all jobs
		async.series(jobs, next);
	}
}

export default class {
	/**
	 * This should be loaded after all engine
	 * loading satellites.
	 *
	 * @type {number}
	 */
	loadPriority = 550;

	startPriority = 900;

	stopPriority = 100;

	async load(api, next) {
		// instance the server manager
		api.servers = new Servers(api);

		await api.servers.loadServers();

		next();
	}

	/**
	 * Satellite starting function.
	 *
	 * @param api   API object reference.
	 * @param next  Callback function.
	 */
	async start(api, next) {
		await api.servers.startServers();
		next();
	}

	stop(api, next) {
		api.servers.stopServers(next);
	}
}
