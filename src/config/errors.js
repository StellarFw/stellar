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
          },
          websocket: function (error) {
            if (Utils.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          tcp: function (error) {
            if (Utils.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          helper: function (error) {
            if (Utils.isError(error)) {
              return 'Error: ' + String(error.message)
            } else {
              return error
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
      },

      // ---------------------------------------------------------------------
      // function to be executed when a file to exists
      // ---------------------------------------------------------------------
      fileNotFound: function () {
        return 'The requested file not exists';
      },

      // ---------------------------------------------------------------------
      // User didn't request a file
      // ---------------------------------------------------------------------
      fileNotProvided: function () {
        return 'File is a required param to send a file';
      },

      // ---------------------------------------------------------------------
      // Connections
      // ---------------------------------------------------------------------

      // ---------------------------------------------------------------------
      // Function to be executed when a verb isn't not allowed
      // ---------------------------------------------------------------------
      verbNotAllowed: function (connection, verb) {
        return connection.localize(`verb not found or not allowed (${verb})`);
      },

      // ---------------------------------------------------------------------
      // Error handler when the room and the message are not present on the
      // request.
      // ---------------------------------------------------------------------
      connectionRoomAndMessage: function (connection) {
        return connection.localize('both room and message are required');
      },

      // ---------------------------------------------------------------------
      // Error handle for a request made to a room who the user as not part of
      // ---------------------------------------------------------------------
      connectionNotInRoom: function (connection, room) {
        return connection.localize(`connection not in this room (${room})`);
      },

      // ---------------------------------------------------------------------
      // Error handler for a join request to a room which the user is already
      // part
      // ---------------------------------------------------------------------
      connectionAlreadyInRoom: function (connection, room) {
        return connection.localize(`connection already in this room (${room})`);
      },

      // ---------------------------------------------------------------------
      // Error handle request for a deleted room.
      // ---------------------------------------------------------------------
      connectionRoomHasBeenDeleted: function (room) {
        return 'this room has been deleted';
      },

      // ---------------------------------------------------------------------
      // Error handler for a join request to a not existing room
      // ---------------------------------------------------------------------
      connectionRoomNotExist: function (room) {
        return 'room does not exist';
      },

      // ---------------------------------------------------------------------
      // Error handler for a room creation request with a same name a already
      // existing room
      // ---------------------------------------------------------------------
      connectionRoomExists: function (room) {
        return 'room exists';
      },

      // ---------------------------------------------------------------------
      // Error handler for a request who need a room name and that parameter
      // are not present.
      // ---------------------------------------------------------------------
      connectionRoomRequired: function (room) {
        return 'a room is required';
      }

    };
  }
};
