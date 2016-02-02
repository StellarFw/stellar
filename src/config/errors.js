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
      // When a params for an action is invalid
      // ---------------------------------------------------------------------
      invalidParams: function (params) {
        return params.join(', ');
      },

      // ---------------------------------------------------------------------
      // When a required param for an action is not provided
      // ---------------------------------------------------------------------
      missingParams: function (params) {
        return `${params[ 0 ]} is a required parameter for this action`;
      },

      // ---------------------------------------------------------------------
      // user required an unknown action
      // ---------------------------------------------------------------------
      unknownAction: function (action) {
        return 'unknown action or invalid apiVersion';
      },

      // ---------------------------------------------------------------------
      // action can be called by this client/server type
      // ---------------------------------------------------------------------
      unsupportedServerType: function (type) {
        return `this action does not support the ${type} connection type`;
      },

      // ---------------------------------------------------------------------
      // Action failed because server is mid-shutdown
      // ---------------------------------------------------------------------
      serverShuttingDown: function () {
        return 'the server is shutting down';
      },

      // ---------------------------------------------------------------------
      // action failed because this client already has too many pending
      // actions
      //
      // the limit is defined in api.config.general.simultaneousActions
      // ---------------------------------------------------------------------
      tooManyPendingActions: function () {
        return 'you have too many pending requests';
      },

      // ---------------------------------------------------------------------
      // a poorly designed action cloud try to call next() more than once
      // ---------------------------------------------------------------------
      doubleCallbackError: function () {
        return 'Double callback prevented within action';
      }

    };
  }
};
