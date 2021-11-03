module.exports = {
  testRegex: "test/.*.spec\\.tsx?$",
  testEnvironment: "node",
  setupTestFrameworkScriptFile: "./test/jest.setup.js",
  moduleFileExtensions: ["ts", "js", "json", "node"],
  moduleDirectories: ["node_modules", "dist", "example"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverage: true,
  coverageReporters: ["lcov", "text-summary"],
  coverageDirectory: "<rootDir>/test/coverage",
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!**/node_modules/**"],
};
