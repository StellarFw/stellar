import { describe, beforeAll, afterAll, it, afterEach, test, beforeEach } from "vitest";

import Engine from "../../lib/engine";
import { expect } from "vitest";
import { API } from "../../src/interfaces/api.interface";
import { head, last } from "ramda";
import { sleep } from "../../src/utils";

const engine = new Engine({ rootPath: `${process.cwd()}/example` });

let api: API;

describe("Core: Chat", () => {
	beforeAll(async () => {
		api = await engine.start();
	});

	afterAll(() => engine.stop());

	afterEach(async () => {
		try {
			await api.chatRoom.destroy("newRoom");
		} catch (e) {}
		try {
			await api.chatRoom.destroy("otherRoom");
		} catch (e) {}
	});

	it("can check if rooms exist", async () => {
		await expect(api.chatRoom.exists("defaultRoom")).resolves.toBeTruthy();
	});

	it("can check if a room does not exits", async () => {
		await expect(api.chatRoom.exists("missingRoom")).resolves.toBeFalsy();
	});

	it("server can create new room", async () => {
		// creates the new room
		await api.chatRoom.create("newRoom");

		// check if the room exists
		await expect(api.chatRoom.exists("newRoom")).resolves.toBeTruthy();
	});

	it("server cannot create already existing room", async () => {
		await expect(api.chatRoom.create("defaultRoom")).rejects.toThrowError("Room (defaultRoom) already exists");
	});

	it("can enumerate all the rooms in the system", async () => {
		// create two rooms
		await api.chatRoom.create("newRoom");
		await api.chatRoom.create("otherRoom");

		// request the list of rooms
		await expect(api.chatRoom.list()).resolves.toEqual(["defaultRoom", "newRoom", "otherRoom"]);
	});

	it("server can destroy a existing room", async () => {
		// creates the new room
		await api.chatRoom.create("newRoom");

		// remove the created room
		await expect(api.chatRoom.destroy("newRoom")).resolves.toBeTruthy();
	});

	it("server can not destroy a non existing room", async () => {
		await expect(api.chatRoom.destroy("nonExistingRoom")).rejects.toThrowError(
			"Room (nonExistingRoom) does not exists",
		);
	});

	it("server can add connections to a room", async () => {
		const client = api.helpers.connection();

		// the client must have zero rooms
		expect(client.rooms).toHaveLength(0);

		// add the client to the room
		await api.chatRoom.join(client.id, "defaultRoom");

		// now the client must have one connection
		expect(client.rooms[0]).toBe("defaultRoom");

		await client.destroy();
	});

	it("will not re-add a member to a room", async () => {
		const client = api.helpers.connection();

		// the client must have zero rooms
		expect(client.rooms).toHaveLength(0);

		// add the client to the room
		await api.chatRoom.join(client.id, "defaultRoom");

		// try add the client to the same room
		await expect(api.chatRoom.join(client.id, "defaultRoom")).rejects.toThrowError(
			`Connection (${client.id}) already in room (defaultRoom)`,
		);

		await client.destroy();
	});

	it("will not add a member to a non-existing room", async () => {
		const client = api.helpers.connection();

		// the client must have zero rooms
		expect(client.rooms).toHaveLength(0);

		// add the client to a non-existing room
		await expect(api.chatRoom.join(client.id, "noExists")).rejects.toMatchObject({
			code: "019",
		});

		await client.destroy();
	});

	it("server will not remove a member not in a room", async () => {
		const client = api.helpers.connection();

		await expect(api.chatRoom.leave(client.id, "noExists")).rejects.toThrowError(
			`Connection (${client.id}) not in room (noExists)`,
		);

		await client.destroy();
	});

	it("server can remove connections from a room", async () => {
		const client = api.helpers.connection();

		// add the client to a room
		await api.chatRoom.join(client.id, "defaultRoom");

		await expect(api.chatRoom.leave(client.id, "defaultRoom")).resolves.toBeTruthy();

		await client.destroy();
	});

	it("server can destroy a room and connections will be removed", async () => {
		const client = api.helpers.connection();

		// create a new room
		await api.chatRoom.create("newRoom");

		// add the client to it
		await api.chatRoom.join(client.id, "newRoom");
		expect(client.rooms[0]).toBe("newRoom");

		// destroy the room
		await expect(api.chatRoom.destroy("newRoom")).resolves.toBeTruthy();

		expect(client.rooms).toHaveLength(0);

		await client.destroy();
	});

	it("can get a list of rooms members", async () => {
		const client = api.helpers.connection();

		// add the client to the room
		await api.chatRoom.join(client.id, "defaultRoom");

		const status = await api.chatRoom.status("defaultRoom");

		expect(status.room).toBe("defaultRoom");
		expect(status.membersCount).toBe(1);

		await client.destroy();
	});

	describe("middleware", () => {
		let client1;
		let client2;
		let originalGenerateMessagePayload;

		beforeEach(async () => {
			originalGenerateMessagePayload = api.chatRoom.generateMessagePayload;
			client1 = api.helpers.connection();
			client2 = api.helpers.connection();
		});

		afterEach(async () => {
			api.chatRoom.middleware = {};
			api.chatRoom.globalMiddleware = [];

			await client1.destroy();
			await client2.destroy();

			api.chatRoom.generateMessagePayload = originalGenerateMessagePayload;
		});

		test("generateMessagePayload can be replaced", async () => {
			api.chatRoom.generateMessagePayload = (message: any) => ({
				thing: "something",
				room: message.connection.room,
				from: message.connection.id,
			});

			await client1.verbs("roomJoin", "defaultRoom");
			await client2.verbs("roomJoin", "defaultRoom");
			await client1.verbs("say", ["defaultRoom", "hello"]);
			await sleep(100);
			const message = last(client2.messages);
			expect(message.thing).toBe("something");
			expect(message.message).toBeUndefined();
		});

		test("join and leave can add middleware to announce members", async () => {
			api.chatRoom.addMiddleware({
				name: "add chat middleware",
				join: async (connection, room) => {
					await api.chatRoom.broadcast({}, room, `client(${connection.id}) have entered the room`);
				},
			});

			api.chatRoom.addMiddleware({
				name: "leave chat middleware",
				leave: async (connection, room) => {
					await api.chatRoom.broadcast({}, room, `client(${connection.id}) have left the room`);
				},
			});

			await client1.verbs("roomJoin", "defaultRoom");
			await client2.verbs("roomJoin", "defaultRoom");
			await client2.verbs("roomLeave", "defaultRoom");
			await sleep(100);

			expect(client1.messages.pop().message).toBe(`client(${client2.id}) have left the room`);
			expect(client1.messages.pop().message).toBe(`client(${client2.id}) have entered the room`);
		});

		test("say can add modify payloads", async () => {
			api.chatRoom.addMiddleware({
				name: "chat middleware",
				say: async (connection, room, messagePayload: { from: number; message: string }) => {
					if (messagePayload.from !== 0) {
						messagePayload.message = "modified-message";
					}

					return messagePayload;
				},
			});

			await client1.verbs("roomJoin", "defaultRoom");
			await client2.verbs("roomJoin", "defaultRoom");
			await client2.verbs("say", ["defaultRoom", "my", "message"]);
			await sleep(100);

			const latestMessage = last(client1.messages);
			expect(latestMessage.message).toBe(`modified-message`);
		});

		test("can add middleware in a particular order", async () => {
			api.chatRoom.addMiddleware({
				name: "chat middleware 1",
				priority: 100,
				say: async (connection, room, messagePayload: { from: number; message: string }) => {
					messagePayload.message = "middleware-1";
					return messagePayload;
				},
			});

			api.chatRoom.addMiddleware({
				name: "chat middleware 2",
				priority: 200,
				say: async (connection, room, messagePayload: { from: number; message: string }) => {
					messagePayload.message = `${messagePayload.message} middleware-2`;
					return messagePayload;
				},
			});

			await client1.verbs("roomJoin", "defaultRoom");
			await client2.verbs("roomJoin", "defaultRoom");
			await client2.verbs("say", ["defaultRoom", "my", "message"]);
			await sleep(100);

			const latestMessage = last(client1.messages);
			expect(latestMessage.message).toBe(`middleware-1 middleware-2`);
		});

		test("say middleware can block execution", async () => {
			api.chatRoom.addMiddleware({
				name: "middleware",
				say: async (connection, room, messagePayload: { from: number; message: string }) => {
					throw new Error("unauthorized");
				},
			});

			await client1.verbs("roomJoin", "defaultRoom");
			await client2.verbs("roomJoin", "defaultRoom");
			await client2.verbs("say", ["defaultRoom", "my", "message"]);
			await sleep(100);

			// only one message must be present, is the welcome message, the remaining ones where blocked
			expect(client1.messages).toHaveLength(1);
			expect(last(client1.messages).welcome).toMatch(/Welcome/);
		});

		test("join middleware can block execution", async () => {
			api.chatRoom.addMiddleware({
				name: "middleware",
				join: async () => {
					throw new Error("unauthorized");
				},
			});

			try {
				await client1.verbs("roomJoin", "defaultRoom");
				throw new Error("should not get here");
			} catch (error) {
				expect(error.toString()).toBe("Error: unauthorized");
				expect(client1.rooms).toHaveLength(0);
			}
		});

		test("leave middleware can block execution", async () => {
			api.chatRoom.addMiddleware({
				name: "middleware",
				leave: async () => {
					throw new Error("you can never leave");
				},
			});

			await client1.verbs("roomJoin", "defaultRoom");
			expect(client1.rooms).toHaveLength(1);
			expect(head(client1.rooms)).toBe("defaultRoom");

			try {
				await client1.verbs("roomLeave", "defaultRoom");
				throw new Error("should not get here");
			} catch (error) {
				expect(error.toString()).toBe("Error: you can never leave");
				expect(client1.rooms).toHaveLength(1);
			}
		});
	});
});
