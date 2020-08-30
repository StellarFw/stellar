module.exports = {
  "root": true,

  "parser": "@babel/eslint-parser",

  "env": {
    "es6": true,
    "browser": false,
    "node": true
  },

  "extends": "eslint:recommended",

  "rules": {
    "arrow-parens": 0,
    "generator-star-spacing": 0,
    "no-useless-escape": 0,
    "valid-typeof": 0,
    "standard/no-callback-literal": 0,
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
