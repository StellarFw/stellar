/**
 * Configurations for the Model system.
 *
 * This configuration follows the Waterline pattern, you can see more about
 * this at:
 * https://sailsjs.com/documentation/concepts/models-and-orm/model-settings
 *
 * By default we use a memory based adapter to make the startup process
 * really simple.
 */
export default {
  models(api) {
    return {
      _toExpand: false,

      // -----------------------------------------------------------------------
      // Dictionary with model system adapters
      // -----------------------------------------------------------------------
      adapters: {
        memory: "sails-disk",
      },

      // -----------------------------------------------------------------------
      // Dictionary with the active datastores
      // -----------------------------------------------------------------------
      datastores: {
        default: {
          adapter: "memory",
          inMemoryOnly: true,
        },
      },

      // -----------------------------------------------------------------------
      // Default datastore
      // -----------------------------------------------------------------------
      defaultDatastore: "default",

      // -----------------------------------------------------------------------
      // Use schemas
      //
      // By default Stellar uses a schema based model, this means that only the
      // defined attributes are inserted on the models.
      //
      // You can turn this off when use are using schema-less adapters like the
      // MongoDB or Redis, if you want.
      // -----------------------------------------------------------------------
      schema: true,
    };
  },
};
