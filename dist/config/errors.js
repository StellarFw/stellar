'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {
  errors: function errors(api) {
    return {
      '_toExpand': false,

      // ---------------------------------------------------------------------
      // [SERIALIZERS]
      // ---------------------------------------------------------------------

      serializers: {
        servers: {
          web: function web(error) {
            if (_utils2.default.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          websocket: function websocket(error) {
            if (_utils2.default.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          tcp: function tcp(error) {
            if (_utils2.default.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          helper: function helper(error) {
            if (_utils2.default.isError(error)) {
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
      serverErrorMessage: function serverErrorMessage() {
        return 'The server experienced an internal error';
      },

      // ---------------------------------------------------------------------
      // When a client make a call to a private action
      // ---------------------------------------------------------------------
      privateActionCalled: function privateActionCalled(actionName) {
        return 'the action \'' + actionName + '\' is private';
      },

      // ---------------------------------------------------------------------
      // When a params for an action is invalid
      // ---------------------------------------------------------------------
      invalidParams: function invalidParams(params) {
        return params.join(', ');
      },

      // ---------------------------------------------------------------------
      // When a required param for an action is not provided
      // ---------------------------------------------------------------------
      missingParams: function missingParams(params) {
        return params[0] + ' is a required parameter for this action';
      },

      // ---------------------------------------------------------------------
      // When a param was an invalid type
      // ---------------------------------------------------------------------
      paramInvalidType: function paramInvalidType(paramName, expected) {
        return 'param \'' + paramName + '\' has an invalid type, expected ' + expected;
      },

      // ---------------------------------------------------------------------
      // user required an unknown action
      // ---------------------------------------------------------------------
      unknownAction: function unknownAction(action) {
        return 'unknown action or invalid apiVersion';
      },

      // ---------------------------------------------------------------------
      // action can be called by this client/server type
      // ---------------------------------------------------------------------
      unsupportedServerType: function unsupportedServerType(type) {
        return 'this action does not support the ' + type + ' connection type';
      },

      // ---------------------------------------------------------------------
      // Action failed because server is mid-shutdown
      // ---------------------------------------------------------------------
      serverShuttingDown: function serverShuttingDown() {
        return 'the server is shutting down';
      },

      // ---------------------------------------------------------------------
      // action failed because this client already has too many pending
      // actions
      //
      // the limit is defined in api.config.general.simultaneousActions
      // ---------------------------------------------------------------------
      tooManyPendingActions: function tooManyPendingActions() {
        return 'you have too many pending requests';
      },

      // ---------------------------------------------------------------------
      // data length is too big
      //
      // the limit can be configured using:
      //  api.config.servers.tcp.maxDataLength
      // ---------------------------------------------------------------------
      dataLengthTooLarge: function dataLengthTooLarge(maxLength, receivedLength) {
        return api.i18n.localize('data length is too big (' + maxLength + ' received/' + receivedLength + ' max)');
      },

      // ---------------------------------------------------------------------
      // a poorly designed action cloud try to call next() more than once
      // ---------------------------------------------------------------------
      doubleCallbackError: function doubleCallbackError() {
        return 'Double callback prevented within action';
      },

      // ---------------------------------------------------------------------
      // function to be executed when a file to exists
      // ---------------------------------------------------------------------
      fileNotFound: function fileNotFound() {
        return 'The requested file not exists';
      },

      // ---------------------------------------------------------------------
      // function to be executed when occurs a error during file reading
      // ---------------------------------------------------------------------
      fileReadError: function fileReadError(connection, error) {
        return connection.localize('error reading file: ' + String(error));
      },

      // ---------------------------------------------------------------------
      // User didn't request a file
      // ---------------------------------------------------------------------
      fileNotProvided: function fileNotProvided() {
        return 'File is a required param to send a file';
      },

      // ---------------------------------------------------------------------
      // Connections
      // ---------------------------------------------------------------------

      // ---------------------------------------------------------------------
      // Function to be executed when a verb is'nt found
      // ---------------------------------------------------------------------
      verbNotFound: function verbNotFound(connection, verb) {
        return connection.localize('the verb non\'t exists (' + verb + ')');
      },

      // ---------------------------------------------------------------------
      // Function to be executed when a verb isn't not allowed
      // ---------------------------------------------------------------------
      verbNotAllowed: function verbNotAllowed(connection, verb) {
        return connection.localize('verb not found or not allowed (' + verb + ')');
      },

      // ---------------------------------------------------------------------
      // Error handler when the room and the message are not present on the
      // request.
      // ---------------------------------------------------------------------
      connectionRoomAndMessage: function connectionRoomAndMessage(connection) {
        return connection.localize('both room and message are required');
      },

      // ---------------------------------------------------------------------
      // Error handle for a request made to a room who the user as not part of
      // ---------------------------------------------------------------------
      connectionNotInRoom: function connectionNotInRoom(connection, room) {
        return connection.localize('connection not in this room (' + room + ')');
      },

      // ---------------------------------------------------------------------
      // Error handler for a join request to a room which the user is already
      // part
      // ---------------------------------------------------------------------
      connectionAlreadyInRoom: function connectionAlreadyInRoom(connection, room) {
        return connection.localize('connection already in this room (' + room + ')');
      },

      // ---------------------------------------------------------------------
      // Error handle request for a deleted room.
      // ---------------------------------------------------------------------
      connectionRoomHasBeenDeleted: function connectionRoomHasBeenDeleted(room) {
        return 'this room has been deleted';
      },

      // ---------------------------------------------------------------------
      // Error handler for a join request to a not existing room
      // ---------------------------------------------------------------------
      connectionRoomNotExist: function connectionRoomNotExist(room) {
        return 'room does not exist';
      },

      // ---------------------------------------------------------------------
      // Error handler for a room creation request with a same name a already
      // existing room
      // ---------------------------------------------------------------------
      connectionRoomExists: function connectionRoomExists(room) {
        return 'room exists';
      },

      // ---------------------------------------------------------------------
      // Error handler for a request who need a room name and that parameter
      // are not present.
      // ---------------------------------------------------------------------
      connectionRoomRequired: function connectionRoomRequired(room) {
        return 'a room is required';
      }
    };
  }
};