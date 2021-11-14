import { buildEngine } from "../test-utils";

const SALT = "$2a$10$8Ux95eQglaUMSn75J7MAXO";
const TEST_PASSWORD = "MY_GREAT_PASSWORD";
const TEST_PASSWORD_HASHED = "$2a$10$8Ux95eQglaUMSn75J7MAXOrHISe8xlR596kiYoVs2shRznjzD5CGC";

describe("Core", () => {
  const engine = buildEngine();

  beforeAll(() => engine.start());
  afterAll(() => engine.stop());

  describe("Hash", () => {
    /**
     * After each test reset the hash configs
     */
    afterEach(() => {
      const api = engine.api;

      api.configs.general.salt = null;
      api.configs.general.saltLength = 10;
      api.configs.general.saltRounds = 10;
    });

    test("generate salt", async () => {
      const salt = await engine.api.hash.generateSalt();
      expect(typeof salt).toBe("string");
    });

    test("hash data without options", async () => {
      const result = await engine.api.hash.hash(TEST_PASSWORD);
      expect(typeof result).toBe("string");
    });

    test("hash data with predefined salt", async () => {
      engine.api.configs.general.salt = SALT;
      const result = await engine.api.hash.hash(TEST_PASSWORD);
      expect(result).toBe(TEST_PASSWORD_HASHED);
    });

    test("throw exception on hash with wrong salt", async () => {
      engine.api.configs.general.salt = "invalid_salt";

      try {
        await engine.api.hash.hash("some_data");
      } catch (_) {
        return;
      }

      throw new Error("Using an invalid salt for hashing must result in a failure");
    });

    test("compare plain data with hash", async () => {
      const result = await engine.api.hash.compare(TEST_PASSWORD, TEST_PASSWORD_HASHED);
      expect(result).toBeTruthy();
    });
  });
});
