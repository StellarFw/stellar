'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = {
  errors: api => {
    return {
      '_toExpand': false,

      // ---------------------------------------------------------------------
      // [SERIALIZERS]
      // ---------------------------------------------------------------------

      serializers: {
        servers: {
          web: error => {
            if (api.utils.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          websocket: error => {
            if (api.utils.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          tcp: error => {
            if (api.utils.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          helper: error => {
            if (api.utils.isError(error)) {
              return 'Error: ' + String(error.message);
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
      serverErrorMessage: () => 'The server experienced an internal error',

      // ---------------------------------------------------------------------
      // When a client make a call to a private action
      // ---------------------------------------------------------------------
      privateActionCalled: actionName => `the action '${actionName}' is private`,

      // ---------------------------------------------------------------------
      // When a params for an action is invalid
      // ---------------------------------------------------------------------
      invalidParams: errors => {
        const response = {};
        errors.forEach((message, attribute) => {
          response[attribute] = message;
        });
        return response;
      },

      // ---------------------------------------------------------------------
      // When a param was an invalid type
      // ---------------------------------------------------------------------
      paramInvalidType: (paramName, expected) => `param '${paramName}' has an invalid type, expected ${expected}`,

      // ---------------------------------------------------------------------
      // user required an unknown action
      // ---------------------------------------------------------------------
      unknownAction: action => 'unknown action or invalid apiVersion',

      // ---------------------------------------------------------------------
      // action can be called by this client/server type
      // ---------------------------------------------------------------------
      unsupportedServerType: type => `this action does not support the ${type} connection type`,

      // ---------------------------------------------------------------------
      // Action failed because server is mid-shutdown
      // ---------------------------------------------------------------------
      serverShuttingDown: () => 'the server is shutting down',

      // ---------------------------------------------------------------------
      // action failed because this client already has too many pending
      // actions
      //
      // the limit is defined in api.config.general.simultaneousActions
      // ---------------------------------------------------------------------
      tooManyPendingActions: () => 'you have too many pending requests',

      // ---------------------------------------------------------------------
      // data length is too big
      //
      // the limit can be configured using:
      //  api.config.servers.tcp.maxDataLength
      // ---------------------------------------------------------------------
      dataLengthTooLarge: (maxLength, receivedLength) => {
        return api.i18n.localize(`data length is too big (${maxLength} received/${receivedLength} max)`);
      },

      // ---------------------------------------------------------------------
      // a poorly designed action cloud try to call next() more than once
      // ---------------------------------------------------------------------
      doubleCallbackError: () => 'Double callback prevented within action',

      // ---------------------------------------------------------------------
      // function to be executed when a file to exists
      // ---------------------------------------------------------------------
      fileNotFound: () => 'The requested file not exists',

      // ---------------------------------------------------------------------
      // function to be executed when occurs a error during file reading
      // ---------------------------------------------------------------------
      fileReadError: (connection, error) => connection.localize(`error reading file: ${String(error)}`),

      // ---------------------------------------------------------------------
      // User didn't request a file
      // ---------------------------------------------------------------------
      fileNotProvided: () => 'File is a required param to send a file',

      // ---------------------------------------------------------------------
      // Connections
      // ---------------------------------------------------------------------

      // ---------------------------------------------------------------------
      // Function to be executed when a verb is'nt found
      // ---------------------------------------------------------------------
      verbNotFound: (connection, verb) => connection.localize(`the verb non't exists (${verb})`),

      // ---------------------------------------------------------------------
      // Function to be executed when a verb isn't not allowed
      // ---------------------------------------------------------------------
      verbNotAllowed: (connection, verb) => connection.localize(`verb not found or not allowed (${verb})`),

      // ---------------------------------------------------------------------
      // Error handler when the room and the message are not present on the
      // request.
      // ---------------------------------------------------------------------
      connectionRoomAndMessage: connection => connection.localize('both room and message are required'),

      // ---------------------------------------------------------------------
      // Error handle for a request made to a room who the user as not part of
      // ---------------------------------------------------------------------
      connectionNotInRoom: (connection, room) => connection.localize(`connection not in this room (${room})`),

      // ---------------------------------------------------------------------
      // Error handler for a join request to a room which the user is already
      // part
      // ---------------------------------------------------------------------
      connectionAlreadyInRoom: (connection, room) => connection.localize(`connection already in this room (${room})`),

      // ---------------------------------------------------------------------
      // Error handle request for a deleted room.
      // ---------------------------------------------------------------------
      connectionRoomHasBeenDeleted: room => 'this room has been deleted',

      // ---------------------------------------------------------------------
      // Error handler for a join request to a not existing room
      // ---------------------------------------------------------------------
      connectionRoomNotExist: room => 'room does not exist',

      // ---------------------------------------------------------------------
      // Error handler for a room creation request with a same name a already
      // existing room
      // ---------------------------------------------------------------------
      connectionRoomExists: room => 'room exists',

      // ---------------------------------------------------------------------
      // Error handler for a request who need a room name and that parameter
      // are not present.
      // ---------------------------------------------------------------------
      connectionRoomRequired: room => 'a room is required'
    };
  }
};