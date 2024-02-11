export default {
  errors(api) {
    return {
      _toExpand: false,

      // ---------------------------------------------------------------------
      // [SERIALIZERS]
      // ---------------------------------------------------------------------

      serializers: {
        servers: {
          web: (error) => {
            if (api.utils.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          websocket: (error) => {
            if (api.utils.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          tcp: (error) => {
            if (api.utils.isError(error)) {
              return String(error.message);
            } else {
              return error;
            }
          },
          helper: (error) => {
            if (api.utils.isError(error)) {
              return `Error: ${String(error.message)}`;
            } else {
              return error;
            }
          },
        },
      },

      // ---------------------------------------------------------------------
      // [GENERAL ERRORS]
      // ---------------------------------------------------------------------

      // ---------------------------------------------------------------------
      // The message to accompany general 500 errors (internal server errors)
      // ---------------------------------------------------------------------
      serverErrorMessage() {
        return {
          code: "001",
          message: "The server experienced an internal error",
        };
      },

      // ---------------------------------------------------------------------
      // When a client make a call to a private action
      // ---------------------------------------------------------------------
      privateActionCalled(actionName) {
        return {
          code: "002",
          message: `The action '${actionName}' is private`,
        };
      },

      // ---------------------------------------------------------------------
      // When a params for an action is invalid
      // ---------------------------------------------------------------------
      invalidParams(errors) {
        const response = {};
        errors.forEach((message, attribute) => {
          response[attribute] = message;
        });
        return response;
      },

      // ---------------------------------------------------------------------
      // When a param was an invalid type
      // ---------------------------------------------------------------------
      paramInvalidType(paramName, expected) {
        return {
          code: "003",
          message: `Param '${paramName}' has an invalid type, expected ${expected}`,
        };
      },

      // ---------------------------------------------------------------------
      // user required an unknown action
      // ---------------------------------------------------------------------
      unknownAction(action) {
        return {
          code: "004",
          message: `Unknown action (${action}) or invalid apiVersion`,
        };
      },

      // ---------------------------------------------------------------------
      // action can be called by this client/server type
      // ---------------------------------------------------------------------
      unsupportedServerType(type) {
        return {
          code: "005",
          message: `This action does not support the ${type} connection type`,
        };
      },

      // ---------------------------------------------------------------------
      // Action failed because server is mid-shutdown
      // ---------------------------------------------------------------------
      serverShuttingDown() {
        return {
          code: "006",
          message: "The server is shutting down",
        };
      },

      // ---------------------------------------------------------------------
      // action failed because this client already has too many pending
      // actions
      //
      // the limit is defined in api.config.general.simultaneousActions
      // ---------------------------------------------------------------------
      tooManyPendingActions() {
        return {
          code: "007",
          message: "You have too many pending requests",
        };
      },

      // ---------------------------------------------------------------------
      // data length is too big
      //
      // the limit can be configured using:
      //  api.config.servers.tcp.maxDataLength
      // ---------------------------------------------------------------------
      dataLengthTooLarge(maxLength, receivedLength) {
        return {
          code: "008",
          message: api.i18n.localize(
            `Data length is too big (${maxLength} received/${receivedLength} max)`,
          ),
        };
      },

      // ---------------------------------------------------------------------
      // a poorly designed action cloud try to call next() more than once
      // ---------------------------------------------------------------------
      doubleCallbackError() {
        return {
          code: "009",
          message: "Double callback prevented within action",
        };
      },

      // ---------------------------------------------------------------------
      // function to be executed when a file to exists
      // ---------------------------------------------------------------------
      fileNotFound() {
        return {
          code: "010",
          message: "The requested file not exists",
        };
      },

      // ---------------------------------------------------------------------
      // function to be executed when occurs a error during file reading
      // ---------------------------------------------------------------------
      fileReadError(connection, error) {
        return {
          code: "011",
          message: connection.localize(`Error reading file: ${String(error)}`),
        };
      },

      // ---------------------------------------------------------------------
      // User didn't request a file
      // ---------------------------------------------------------------------
      fileNotProvided() {
        return {
          code: "012",
          message: "File is a required param to send a file",
        };
      },

      // ---------------------------------------------------------------------
      // Connections
      // ---------------------------------------------------------------------

      // ---------------------------------------------------------------------
      // Function to be executed when a verb is'nt found
      // ---------------------------------------------------------------------
      verbNotFound(connection, verb) {
        return {
          code: "013",
          message: connection.localize(`The verb non't exists (${verb})`),
        };
      },

      // ---------------------------------------------------------------------
      // Function to be executed when a verb isn't not allowed
      // ---------------------------------------------------------------------
      verbNotAllowed(connection, verb) {
        return {
          code: "014",
          message: connection.localize(
            `Verb not found or not allowed (${verb})`,
          ),
        };
      },

      // ---------------------------------------------------------------------
      // Error handler when the room and the message are not present on the
      // request.
      // ---------------------------------------------------------------------
      connectionRoomAndMessage(connection) {
        return {
          code: "015",
          message: connection.localize("Both room and message are required"),
        };
      },

      // ---------------------------------------------------------------------
      // Error handle for a request made to a room who the user as not part of
      // ---------------------------------------------------------------------
      connectionNotInRoom(connection, room) {
        return {
          code: "016",
          message: connection.localize(
            `Connection (${connection.id}) not in room (${room})`,
          ),
        };
      },

      // ---------------------------------------------------------------------
      // Error handler for a join request to a room which the user is already
      // part
      // ---------------------------------------------------------------------
      connectionAlreadyInRoom(connection, room) {
        return {
          code: "017",
          message: connection.localize(
            `Connection (${connection.id}) already in room (${room})`,
          ),
        };
      },

      // ---------------------------------------------------------------------
      // Error handle request for a deleted room.
      // ---------------------------------------------------------------------
      connectionRoomHasBeenDeleted(room) {
        return {
          name: "ConnectionRoomHasBeenDeleted Error",
          code: "018",
          message: `Room (${room}) has been deleted`,
        };
      },

      // ---------------------------------------------------------------------
      // Error handler for a join request to a not existing room
      // ---------------------------------------------------------------------
      connectionRoomNotExist(room) {
        return {
          name: "ConnectionRoomNotExist Error",
          code: "019",
          message: `Room (${room}) does not exists`,
        };
      },

      // ---------------------------------------------------------------------
      // Error handler for a room creation request with a same name a already
      // existing room
      // ---------------------------------------------------------------------
      connectionRoomExists(room) {
        return {
          name: "ConnectionRoomExists Error",
          code: "020",
          message: `Room (${room}) already exists`,
        };
      },

      // ---------------------------------------------------------------------
      // Error handler for a request who need a room name and that parameter
      // are not present.
      // ---------------------------------------------------------------------
      connectionRoomRequired() {
        return {
          code: "021",
          message: "A room is required",
        };
      },

      // ---------------------------------------------------------------------
      // Error handler for a timeout during a request. This means that the
      // action doesn't responded during the time specified on the
      // `general.actionTimeout` config.
      // ---------------------------------------------------------------------
      responseTimeout(action) {
        return {
          code: "022",
          message: `Response timeout for action '${action}'`,
        };
      },
    };
  },
};
