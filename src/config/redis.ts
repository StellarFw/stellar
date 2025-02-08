import IORedis from "ioredis";
import MockRedis from "ioredis-mock";

/**
 * Redis configs.
 *
 * constructor  - the redis client constructor method (package)
 * args         - the arguments to pass to the constructor
 * buildNew     - is to use the `new` keyword on the the constructor?
 */
export default {
	redis() {
		// get parameters from the environment or use defaults
		let protocol = Deno.env.get("REDIS_SSL") ? "rediss" : "redis";
		let host = Deno.env.get("REDIS_HOST") ?? "127.0.0.1";
		let port = Deno.env.get("REDIS_PORT") ?? "6379";
		let db = Deno.env.get("REDIS_DB") ?? Deno.env.get("VITEST_WORKER_ID") ?? "0";
		let password = Deno.env.get("REDIS_PASS") ?? null;
		const maxBackoff = 3000;

		if (Deno.env.has("REDIS_URL")) {
			const parsed = new URL(Deno.env.get("REDIS_URL")!);
			if (parsed.protocol) protocol = parsed.protocol.split(":")[0];
			if (parsed.password) password = parsed.password;
			if (parsed.hostname) host = parsed.hostname;
			if (parsed.port) port = parsed.port;
			if (parsed.pathname) db = parsed.pathname.substring(1);
		}

		const commonArgs = {
			port,
			host,
			password,
			db: parseInt(db),
			tls: protocol === "redis" ? { rejectUnauthorized: false } : undefined,
			retryStrategy: (times: number) => {
				if (times === 1) {
					console.error("Unable to connect to Redis - please check your Redis config!");
					return 5000;
				}
				return Math.min(times * 50, maxBackoff);
			},
		};

		const RedisConstructor = Deno.env.get("FAKEREDIS") === "false" || Deno.env.has("REDIS_HOST") ? IORedis : MockRedis;

		return {
			_toExpand: false,

			client: {
				constructor: RedisConstructor,
				args: [commonArgs],
				buildNew: true,
			},
			subscriber: {
				constructor: RedisConstructor,
				args: [commonArgs],
				buildNew: true,
			},
			tasks: {
				constructor: RedisConstructor,
				args: [commonArgs],
				buildNew: true,
			},
		};
	},
};
