/**
 * Configurations for the models.
 *
 * This configuration follows the Waterline pattern, you can see more about
 * this at:
 * https://github.com/balderdashy/waterline-docs/blob/master/introduction/getting-started.md
 *
 * By default we use a memory based adapter to make the startup really simple.
 */
export default {
  models() {
    return {
      _toExpand: false,

      // -----------------------------------------------------------------------
      // Object with model system adapters
      // -----------------------------------------------------------------------
      adapters: {
        memory: "sails-disk",
      },

      // -----------------------------------------------------------------------
      // Object with the active datastores
      // -----------------------------------------------------------------------
      datastores: {
        memory: {
          adapter: "memory",
          inMemoryOnly: true,
        },
      },

      // -----------------------------------------------------------------------
      // Default models properties based on the Datastore
      // -----------------------------------------------------------------------
      // This allows to set default properties for the models. For example, this
      // is useful when to defined the default primary key, as following.
      // -----------------------------------------------------------------------
      defaultModelPropsForDatastore: {
        memory: {
          attributes: {
            id: {
              type: "number",
              autoMigrations: {
                unique: true,
                autoIncrement: true,
              },
            },
          },
          primaryKey: "id",
        },
      },

      // -----------------------------------------------------------------------
      // Default datastore
      // -----------------------------------------------------------------------
      defaultDatastore: "memory",

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
