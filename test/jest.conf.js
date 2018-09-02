module.exports = {
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?|jsx?)$",
  setupTestFrameworkScriptFile: './jest.setup.js',
  moduleFileExtensions: [
    "ts",
    "js",
    "json",
    "node"
  ],
  moduleDirectories: [
    "node_modules",
    "dist",
    "example"
  ],
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  collectCoverage: true,
  coverageReporters: ['lcov', 'text-summary'],
  coverageDirectory: './coverage',
}
