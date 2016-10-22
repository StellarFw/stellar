'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
// get parameters from the environment or use defaults
let host = process.env.REDIS_HOST || '127.0.0.1';
let port = process.env.REDIS_PORT || 6379;
let db = process.env.REDIS_DB || 0;
let password = process.env.REDIS_PASS || null;

/**
 * Redis configs.
 *
 * constructor  - the redis client constructor method (package)
 * args         - the arguments to pass to the constructor
 * buildNew     - is to use the `new` keyword on the the constructor?
 */
exports.default = {
  redis: api => {

    if (process.env.FAKEREDIS === 'false' || process.env.REDIS_HOST !== undefined) {

      return {
        '_toExpand': false,

        client: {
          constructor: require('ioredis'),
          args: [{ port: port, host: host, password: password, db: db }],
          buildNew: true
        },
        subscriber: {
          constructor: require('ioredis'),
          args: [{ port: port, host: host, password: password, db: db }],
          buildNew: true
        },
        tasks: {
          constructor: require('ioredis'),
          args: [{ port: port, host: host, password: password, db: db }],
          buildNew: true
        }
      };
    } else {

      return {
        '_toExpand': false,

        client: {
          constructor: require('fakeredis').createClient,
          args: [port, host, { fast: true }],
          buildNew: false
        },
        subscriber: {
          constructor: require('fakeredis').createClient,
          args: [port, host, { fast: true }],
          buildNew: false
        },
        tasks: {
          constructor: require('fakeredis').createClient,
          args: [port, host, { fast: true }],
          buildNew: false
        }
      };
    }
  }
};