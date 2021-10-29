"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
let engine = null;
let api = null;
describe("Core: Errors", () => {
    beforeAll(async () => {
        engine = await (0, utils_1.startEngine)();
        api = engine.api;
    });
    afterAll(async () => engine.stop());
    test("returns string errors properly", async () => {
        const response = await api.helpers.runAction("aNotExistingAction");
        expect(response.error.code).toBe("004");
    });
    test("returns Error object properly", async () => {
        api.configs.errors.unknownAction = () => new Error("error test");
        const response = await api.helpers.runAction("aNotExistingAction");
        expect(response.error).toBe("Error: error test");
    });
    test("returns generic object properly", async () => {
        api.configs.errors.unknownAction = () => ({ code: "error160501" });
        const response = await api.helpers.runAction("aNotExistingAction");
        expect(response.error.code).toBe("error160501");
    });
});
//# sourceMappingURL=errors.spec.js.map