'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Models configs.
 */
exports.default = {
  models: function models(api) {
    return {
      // ---------------------------------------------------------------------
      // Connection string for the MongoDB server
      // ---------------------------------------------------------------------
      connectionString: 'mongodb://localhost/ConnectionTest',

      // ---------------------------------------------------------------------
      // Which MongoDB package should we use?
      //
      // Valid Values:
      //  - mockgoose: Used for dev or test servers. This shouldn't be used on
      //    a production server, every time the server is shutdown all
      //    information is lost.
      //  - mongoose: Used for production server.
      // ---------------------------------------------------------------------
      pkg: 'mockgoose'
    };
  }
};

/**
 * Models configs for test environment.
 *
 * @type {{models: (function())}}
 */

var test = exports.test = {
  models: function models(api) {
    // by default we use mockgoose
    var pkg = 'mockgoose';

    // if the environment have a MOCKGOOSE var set to false we use mongoose instead
    // of mockgoose
    if (process.env.MOCKGOOSE === 'false') {
      pkg = 'mongoose';
    }

    return {
      pkg: pkg
    };
  }
};
//# sourceMappingURL=models.js.map
