module.exports = {
  preset: "ts-jest",

  globals: {
    "ts-jest": {
      tsconfig: {
        target: "esnext",
        sourceMap: true,
      },
    },
  },

  rootDir: __dirname,
  testMatch: ["<rootDir>/packages/**/src/**/*.test.[jt]s", "<rootDir>/test/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_module/", "example"],

  // Watch settings
  watchPathIgnorePatterns: ["/node_module/", "/example/"],

  // coverage configurations
  collectCoverage: true,
  coverageReporters: ["lcov", "text-summary"],
  coverageDirectory: "<rootDir>/test/coverage",
  collectCoverageFrom: ["packages/**/lib/**/*.js", "!**/node_modules/**"],
};
