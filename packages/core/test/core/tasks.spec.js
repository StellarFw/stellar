"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
let engine = null;
let api = null;
describe("Core: Tasks", () => {
    beforeAll(async () => {
        engine = await (0, utils_1.startEngine)();
        api = engine.api;
    });
    afterAll(async () => engine.stop());
    test("can run the task manually", async () => {
        const response = await api.helpers.runTask("runAction", {
            action: "randomNumber",
        });
        expect(response.number).toBeGreaterThan(0);
        expect(response.number).toBeLessThan(1);
    });
});
//# sourceMappingURL=tasks.spec.js.map