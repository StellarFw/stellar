/**
 * Redis configs.
 */
export default {
  redis: (api) => {
    let redisDetails = {
      // ---------------------------------------------------------------------
      // Which channel to use on redis pub/sub for RPC communication
      // ---------------------------------------------------------------------
      channel: 'stellar',

      // ---------------------------------------------------------------------
      // How long to wait for an RPC call before considering it a failure
      // ---------------------------------------------------------------------
      rpcTimeout: 5000,

      // ---------------------------------------------------------------------
      // Which redis package should we use?
      // ---------------------------------------------------------------------
      pkg: 'fakeredis',

      // ---------------------------------------------------------------------
      // Basic configuration options
      // ---------------------------------------------------------------------
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      database: process.env.REDIS_DB || 0
    };

    if (process.env.FAKEREDIS === 'false' || process.env.REDIS_HOST !== undefined) {
      redisDetails.pkg = 'iorerdis';

      // there are many more connection options, including support for cluster and sentinel
      // learn more @ https://github.com/luin/ioredis
      redisDetails.options = { password: process.env.REDIS_PASS || null }
    }

    return redisDetails;
  }
}

/**
 * Redis configs for test environment.
 *
 * @type {{redis: test.redis}}
 */
export let test = {
  redis: function (api) {
    let pkg = 'fakeredis';

    if (process.env.FAKEREDIS === 'false') {
      pkg = 'ioredis';
    }

    return {
      pkg: pkg
    }
  }
}
