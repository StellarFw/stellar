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
  testMatch: ["<rootDir>/packages/**/src/**/*.test.[jt]s"],
  testPathIgnorePatterns: ["/node_module/"],
};
