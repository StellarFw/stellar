import { describe, beforeAll, afterAll, it, expect, beforeEach, afterEach } from "vitest";

import Engine from "../../lib/engine";
import { connect } from "net";
import { randomUUID } from "crypto";
import { API } from "../../src/interfaces/api.interface";

const engine = new Engine({ rootPath: `${process.cwd()}/example` });

let api: API;

// TCP instance clients
let client1;
let client2;
let client3;

/**
 * This function allows to make a socket request.
 *
 * @param client      Client object.
 * @param message     Message to be sent.
 * @param delimiter   Message delimiter, by default `\r\n`
 */
const makeSocketRequest = async (client, message, delimiter = "\r\n") => {
	const lines = [];
	let counter = 0;

	// function to split by lines
	const rsp = (d) => {
		d.split(delimiter).forEach((line) => lines.push(line));
		lines.push();
	};

	return new Promise((resolve, rejects) => {
		const responder = () => {
			if (lines.length === 0 && counter < 20) {
				counter++;
				return setTimeout(responder, 10);
			}

			// get last line
			let lastLine = lines[lines.length - 1];

			// if the last line are empty get -2 position
			if (lastLine === "") {
				lastLine = lines[lines.length - 2];
			}

			let parsed = null;

			try {
				parsed = JSON.parse(lastLine);
			} catch (e) {}

			// remove the event listener from the client
			client.removeListener("data", rsp);

			!!parsed.error ? rejects(parsed.error) : resolve(parsed);
		};

		// define a timeout
		setTimeout(responder, 50);

		// add a new listener to catch the response message
		client.on("data", rsp);

		// send the new message
		client.write(message + delimiter);
	});
};

const connectClients = async () => {
	return new Promise((resolve) => {
		// resolve the promise after 1 second
		setTimeout(resolve, 1000);

		// create three clients
		client1 = connect(api.config.servers.tcp.port, () => {
			client1.setEncoding("utf8");
		});

		client2 = connect(api.config.servers.tcp.port, () => {
			client2.setEncoding("utf8");
		});
		client3 = connect(api.config.servers.tcp.port, () => {
			client3.setEncoding("utf8");
		});
	});
};

describe("Servers: TCP", function () {
	beforeAll(async () => {
		api = await engine.start();

		// connect the clients
		await connectClients();
	});

	afterAll(async () => {
		// close all the tree sockets
		client1.write("quit\r\n");
		client2.write("quit\r\n");
		client3.write("quit\r\n");

		// finish the Stellar instance execution
		await engine.stop();
	});

	it("connections should be able to connect and get JSON", async () => {
		await expect(makeSocketRequest(client1, "hello")).rejects.toMatchObject({
			code: "004",
		});
	});

	it("single string message are treated as actions", async () => {
		await expect(makeSocketRequest(client1, "status")).resolves.toMatchObject({
			id: "test-server",
		});
	});

	it("stringified JSON can also be send as actions", async () => {
		await expect(
			makeSocketRequest(client1, JSON.stringify({ action: "status", params: { somethings: "example" } })),
		).resolves.toMatchObject({ id: "test-server" });
	});

	it("can not call private actions", async () => {
		await expect(
			makeSocketRequest(client1, JSON.stringify({ action: "sumANumber", params: { a: 3, b: 4 } })),
		).rejects.toMatchObject({
			code: "002",
		});
	});

	it("can execute namespaced actions", async () => {
		await expect(makeSocketRequest(client1, JSON.stringify({ action: "isolated.action" }))).resolves.toMatchObject({
			success: "ok",
		});
	});

	it("really long messages are OK", async () => {
		// build a long message using v4 UUIDs
		const value = Array(10)
			.map(() => randomUUID())
			.join("");
		const msg = {
			action: "cacheTest",
			params: {
				key: randomUUID(),
				value,
			},
		};

		await expect(makeSocketRequest(client1, JSON.stringify(msg))).resolves.toMatchObject({
			cacheTestResults: {
				loadResp: {
					key: `cache_test_${msg.params.key}`,
					value,
				},
			},
		});
	});

	it("client can get their details", async () => {
		const response = await makeSocketRequest(client2, "detailsView");

		expect(response.status).toBe("OK");
		expect(response.data).toBeTypeOf("object");
		expect(response.data.params).toBeTypeOf("object");
	});

	it("params can update", async () => {
		await makeSocketRequest(client1, "paramAdd key=otherKey");
		await expect(makeSocketRequest(client1, "paramsView")).resolves.toMatchObject({
			status: "OK",
			data: {
				key: "otherKey",
			},
		});
	});

	it("actions will fail without params set to the connection", async () => {
		await makeSocketRequest(client1, "paramDelete key");
		await expect(makeSocketRequest(client1, "cacheTest")).rejects.toMatchObject({
			key: "The key field is required.",
		});
	});

	it("a new param can be added", async () => {
		await expect(makeSocketRequest(client1, "paramAdd key=testKey")).resolves.toMatchObject({
			status: "OK",
		});
	});

	it("a new param can be viewed once added", async () => {
		await expect(makeSocketRequest(client1, "paramView key")).resolves.toMatchObject({
			data: "testKey",
		});
	});

	it("another new param can be added", async () => {
		await expect(makeSocketRequest(client1, "paramAdd value=test123")).resolves.toMatchObject({
			status: "OK",
		});
	});

	it("action will work once all the needed params are added", async () => {
		await expect(makeSocketRequest(client1, "cacheTest")).resolves.toMatchObject({
			cacheTestResults: {
				saveResp: true,
			},
		});
	});

	it("params are sticky between actions", async () => {
		await expect(makeSocketRequest(client1, "cacheTest")).resolves.toMatchObject({
			cacheTestResults: {
				loadResp: {
					key: "cache_test_testKey",
					value: "test123",
				},
			},
		});

		await expect(makeSocketRequest(client1, "cacheTest")).resolves.toMatchObject({
			cacheTestResults: {
				loadResp: {
					key: "cache_test_testKey",
					value: "test123",
				},
			},
		});
	});

	it("only params sent is a JSON block are used", async () => {
		await expect(
			makeSocketRequest(client1, JSON.stringify({ action: "cacheTest", params: { key: "someOtherKey" } })),
		).rejects.toMatchObject({
			value: "The value field is required.",
		});
	});

	it("will limit how many simultaneous connection a client can have", async () => {
		client1.write(`${JSON.stringify({ action: "sleep", params: { sleepDuration: 500 } })}\r\n`);
		client1.write(`${JSON.stringify({ action: "sleep", params: { sleepDuration: 600 } })}\r\n`);
		client1.write(`${JSON.stringify({ action: "sleep", params: { sleepDuration: 700 } })}\r\n`);
		client1.write(`${JSON.stringify({ action: "sleep", params: { sleepDuration: 800 } })}\r\n`);
		client1.write(`${JSON.stringify({ action: "sleep", params: { sleepDuration: 900 } })}\r\n`);
		client1.write(`${JSON.stringify({ action: "sleep", params: { sleepDuration: 1000 } })}\r\n`);

		const responses = [];

		return new Promise((resolve) => {
			const checkResponses = (data) => {
				data.split("\n").forEach((line) => {
					if (line.length > 0) {
						responses.push(JSON.parse(line));
					}
				});

				if (responses.length === 6) {
					client1.removeListener("data", checkResponses);

					for (const i in responses) {
						const response = responses[i];

						if (i === "0") {
							expect(response.error.code).toBe("007");
						} else {
							expect(response.error).toBeUndefined();
						}
					}

					resolve(null);
				}
			};

			client1.on("data", checkResponses);
		});
	});

	describe("with a custom max data length", () => {
		beforeAll(() => {
			api.config.servers.tcp.maxDataLength = 64;
		});

		afterAll(() => {
			api.config.servers.tcp.maxDataLength = 0;
		});

		it("will error if received data length is bigger then maxDataLength", async () => {
			const msg = {
				action: "cacheTest",
				params: {
					key: randomUUID(),
					value: Array(10).fill(randomUUID()).join(""),
				},
			};

			await expect(makeSocketRequest(client1, JSON.stringify(msg))).rejects.toMatchObject({
				code: "008",
				message: "Data length is too big (64 received/449 max)",
			});
		});
	});

	describe("custom data delimiter", function () {
		afterAll(() => {
			// return the config back to normal so we don't error other tests
			api.config.servers.tcp.delimiter = "\n";
		});

		it("will parse /newline data delimiter", async () => {
			await expect(makeSocketRequest(client1, JSON.stringify({ action: "status" }), "\n")).resolves.toMatchObject({
				context: "response",
			});
		});

		it("will parse custom `^]` data delimiter", async () => {
			api.config.servers.tcp.delimiter = "^]";

			await expect(makeSocketRequest(client1, JSON.stringify({ action: "status" }), "^]")).resolves.toMatchObject({
				context: "response",
			});
		});
	});

	describe("chat", function () {
		beforeAll(() => {
			api.chatRoom.addMiddleware({
				name: "join chat middleware",
				join: (connection, room, callback) => {
					api.chatRoom.emit(room, "message", `I have entered the room: ${connection.id}`).then((_) => {
						callback();
					});
				},
			});

			api.chatRoom.addMiddleware({
				name: "leave chat middleware",
				leave: (connection, room, callback) => {
					api.chatRoom.emit(room, "message", `I have left the room: ${connection.id}`).then((_) => {
						callback();
					});
				},
			});
		});

		afterAll(() => {
			api.chatRoom.middleware = {};
			api.chatRoom.globalMiddleware = [];
		});

		beforeEach(async () => {
			await makeSocketRequest(client1, "roomJoin defaultRoom");
			await makeSocketRequest(client2, "roomJoin defaultRoom");
			await makeSocketRequest(client3, "roomJoin defaultRoom");

			return new Promise((resolve) => setTimeout(resolve, 250));
		});

		afterEach(async () => {
			for (const room of ["defaultRoom", "otherRoom"]) {
				await makeSocketRequest(client1, `roomLeave ${room}`);
				await makeSocketRequest(client2, `roomLeave ${room}`);
				await makeSocketRequest(client3, `roomLeave ${room}`);
			}

			return new Promise((resolve) => setTimeout(resolve, 250));
		});

		it("clients are in the default room", async () => {
			await expect(makeSocketRequest(client1, "roomView defaultRoom")).resolves.toMatchObject({
				data: {
					room: "defaultRoom",
				},
			});
		});

		it("clients can view additional info about rooms they are in", async () => {
			await expect(makeSocketRequest(client1, "roomView defaultRoom")).resolves.toMatchObject({
				data: {
					membersCount: 3,
				},
			});
		});

		it("rooms can be changed", async () => {
			await makeSocketRequest(client1, "roomJoin otherRoom");

			await expect(makeSocketRequest(client1, "roomLeave defaultRoom")).resolves.toMatchObject({
				status: "OK",
			});

			await expect(makeSocketRequest(client1, "roomView otherRoom")).resolves.toMatchObject({
				data: {
					room: "otherRoom",
				},
			});
		});

		it("connections in the first room see the count go down", async () => {
			await makeSocketRequest(client1, "roomJoin otherRoom");
			await makeSocketRequest(client1, "roomLeave defaultRoom");
			await expect(makeSocketRequest(client2, "roomView defaultRoom")).resolves.toMatchObject({
				data: {
					room: "defaultRoom",
					membersCount: 2,
				},
			});
		});
	});

	describe("disconnect", function () {
		afterAll(async () => {
			await connectClients();
		});

		it("Server can disconnect a client", async () => {
			await expect(makeSocketRequest(client1, "status")).resolves.toMatchObject({
				id: "test-server",
			});

			expect(client1.readable).toBeTruthy();
			expect(client1.writable).toBeTruthy();

			for (const id in api.connections.connections) {
				api.connections.connections[id].destroy();
			}

			return new Promise((resolve) => {
				setTimeout(() => {
					expect(client1.readable).toBeFalsy();
					expect(client1.writable).toBeFalsy();
					resolve(null);
				}, 100);
			});
		});
	});
});
