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
  testMatch: ["<rootDir>/packages/**/__tests__/**/*.test.[jt]s"],
  testPathIgnorePatterns: ["/node_module/"],
};
