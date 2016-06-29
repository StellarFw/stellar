import Utils from '../utils'

export default {
  errors: api => {
    return {
      '_toExpand': false,

      // ---------------------------------------------------------------------
      // [SERIALIZERS]
      // ---------------------------------------------------------------------

      serializers: {
        servers: {
          web: error => {
            if (Utils.isError(error)) {
              return String(error.message)
            } else {
              return error
            }
          },
          websocket: error => {
            if (Utils.isError(error)) {
              return String(error.message)
            } else {
              return error
            }
          },
          tcp: error => {
            if (Utils.isError(error)) {
              return String(error.message)
            } else {
              return error
            }
          },
          helper: error => {
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
      serverErrorMessage: () => {
        return 'The server experienced an internal error'
      },

      // ---------------------------------------------------------------------
      // When a params for an action is invalid
      // ---------------------------------------------------------------------
      invalidParams: params => {
        return params.join(', ')
      },

      // ---------------------------------------------------------------------
      // When a required param for an action is not provided
      // ---------------------------------------------------------------------
      missingParams: params => {
        return `${params[ 0 ]} is a required parameter for this action`
      },

      // ---------------------------------------------------------------------
      // user required an unknown action
      // ---------------------------------------------------------------------
      unknownAction: action => {
        return 'unknown action or invalid apiVersion'
      },

      // ---------------------------------------------------------------------
      // action can be called by this client/server type
      // ---------------------------------------------------------------------
      unsupportedServerType: type => {
        return `this action does not support the ${type} connection type`
      },

      // ---------------------------------------------------------------------
      // Action failed because server is mid-shutdown
      // ---------------------------------------------------------------------
      serverShuttingDown: () => {
        return 'the server is shutting down'
      },

      // ---------------------------------------------------------------------
      // action failed because this client already has too many pending
      // actions
      //
      // the limit is defined in api.config.general.simultaneousActions
      // ---------------------------------------------------------------------
      tooManyPendingActions: () => {
        return 'you have too many pending requests'
      },

      // ---------------------------------------------------------------------
      // a poorly designed action cloud try to call next() more than once
      // ---------------------------------------------------------------------
      doubleCallbackError: () => {
        return 'Double callback prevented within action'
      },

      // ---------------------------------------------------------------------
      // function to be executed when a file to exists
      // ---------------------------------------------------------------------
      fileNotFound: () => {
        return 'The requested file not exists'
      },

      // ---------------------------------------------------------------------
      // User didn't request a file
      // ---------------------------------------------------------------------
      fileNotProvided: () => {
        return 'File is a required param to send a file'
      },

      // ---------------------------------------------------------------------
      // Connections
      // ---------------------------------------------------------------------

      // ---------------------------------------------------------------------
      // Function to be executed when a verb is'nt found
      // ---------------------------------------------------------------------
      verbNotFound: (connection, verb) => {
        connection.localize(`the verb non't exists (${verb})`)
      },

      // ---------------------------------------------------------------------
      // Function to be executed when a verb isn't not allowed
      // ---------------------------------------------------------------------
      verbNotAllowed: (connection, verb) => {
        return connection.localize(`verb not found or not allowed (${verb})`)
      },

      // ---------------------------------------------------------------------
      // Error handler when the room and the message are not present on the
      // request.
      // ---------------------------------------------------------------------
      connectionRoomAndMessage: connection => {
        return connection.localize('both room and message are required')
      },

      // ---------------------------------------------------------------------
      // Error handle for a request made to a room who the user as not part of
      // ---------------------------------------------------------------------
      connectionNotInRoom: (connection, room) => {
        return connection.localize(`connection not in this room (${room})`)
      },

      // ---------------------------------------------------------------------
      // Error handler for a join request to a room which the user is already
      // part
      // ---------------------------------------------------------------------
      connectionAlreadyInRoom: (connection, room) => {
        return connection.localize(`connection already in this room (${room})`)
      },

      // ---------------------------------------------------------------------
      // Error handle request for a deleted room.
      // ---------------------------------------------------------------------
      connectionRoomHasBeenDeleted: room => {
        return 'this room has been deleted'
      },

      // ---------------------------------------------------------------------
      // Error handler for a join request to a not existing room
      // ---------------------------------------------------------------------
      connectionRoomNotExist: room => {
        return 'room does not exist'
      },

      // ---------------------------------------------------------------------
      // Error handler for a room creation request with a same name a already
      // existing room
      // ---------------------------------------------------------------------
      connectionRoomExists: room => {
        return 'room exists'
      },

      // ---------------------------------------------------------------------
      // Error handler for a request who need a room name and that parameter
      // are not present.
      // ---------------------------------------------------------------------
      connectionRoomRequired: room => {
        return 'a room is required'
      }
    }
  }
}
