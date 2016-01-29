import Utils from '../utils';

export default {
  errors: function (api) {
    return {
      '_toExpand': false,

      // ---------------------------------------------------------------------
      // [SERIALIZERS]
      // ---------------------------------------------------------------------

      serializers: {
        servers: {
          web: function (error) {
            if (Utils.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          }
        }
      },

      // ---------------------------------------------------------------------
      // [GENERAL ERRORS]
      // ---------------------------------------------------------------------

      // ---------------------------------------------------------------------
      // The message to accompany general 500 errors (internal server errors)
      // ---------------------------------------------------------------------
      serverErrorMessage: function () {
        return 'The server experienced an internal error';
      },

      // ---------------------------------------------------------------------
      // Action failed because server is mid-shutdown
      // ---------------------------------------------------------------------
      serverShuttingDown: function () {
        return 'the server is shutting down';
      }

    };
  }
};
