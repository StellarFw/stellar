/**
 * General configs.
 */
export default {
  general(api) {
    return {
      // ---------------------------------------------------------------------
      // API version
      // ---------------------------------------------------------------------
      apiVersion: '0.0.1',

      // ---------------------------------------------------------------------
      // Server name
      // ---------------------------------------------------------------------
      serverName: 'Stellar API',

      // ---------------------------------------------------------------------
      // A unique token to the application that servers will use to
      // authenticate to each other
      //
      // If this is not present an id will be generated dynamically.
      // ---------------------------------------------------------------------
      serverToken: 'change-me',

      // ---------------------------------------------------------------------
      // Welcome message seen by TCP and WebSocket clients upon connection
      // ---------------------------------------------------------------------
      welcomeMessage: 'Hello human! Welcome to Stellar',

      // ---------------------------------------------------------------------
      // The Redis prefix for Stellar's cache objects
      // ---------------------------------------------------------------------
      cachePrefix: 'stellar:cache',

      // ---------------------------------------------------------------------
      // The Redis prefix for Stellar's cache/lock objects
      // ---------------------------------------------------------------------
      lockPrefix: 'stellar:lock',

      // ---------------------------------------------------------------------
      // How long will a lock last before it expires (ms)
      // ---------------------------------------------------------------------
      lockDuration: 1000 * 10, // 10 seconds

      // ---------------------------------------------------------------------
      // By default the Stellar are in development mode
      // ---------------------------------------------------------------------
      developmentMode: true,

      // ---------------------------------------------------------------------
      // Number of action who can be executed simultaneous by a single
      // connection.
      // ---------------------------------------------------------------------
      simultaneousActions: 5,

      // ---------------------------------------------------------------------
      // Allow connection to be created without remoteIP and remotePort
      //
      // They will be set to 0
      // ---------------------------------------------------------------------
      enforceConnectionProperties: true,

      // ---------------------------------------------------------------------
      // Params you would like hidden from any logs
      // ---------------------------------------------------------------------
      filteredParams: [],

      // ---------------------------------------------------------------------
      // Values that signify missing params
      // ---------------------------------------------------------------------
      missingParamChecks: [ null, '', undefined ],

      // ---------------------------------------------------------------------
      // The default priority level given to middleware of all types
      // ---------------------------------------------------------------------
      defaultMiddlewarePriority: 100,

      // ---------------------------------------------------------------------
      // Configurations for Stellar project structure
      // ---------------------------------------------------------------------
      paths: {
        'public': api.scope.rootPath + '/public',
        'temp': api.scope.rootPath + '/temp',
        'pid': api.scope.rootPath + '/temp/pids',
        'log': api.scope.rootPath + '/temp/logs'
      },

      // ---------------------------------------------------------------------
      // hash containing chat rooms to be created at server boot
      //
      // Format:
      //  {roomName: {authKey, authValue}}
      //
      // Example:
      //  'secureRoom': {authorized: true}
      // ---------------------------------------------------------------------
      startingChatRooms: {
        'defaultRoom': {}
      }
    }
  }
}

/**
 * Test configs.
 *
 * @type {{}}
 */
export const test = {
  general: (api) => {
    return {
      id: 'test-server',
      developmentMode: true,
      startingChatRooms: {
        defaultRoom: {},
        otherRoom: {}
      }
    }
  }
}

/**
 * Production configs.
 *
 * @type {{}}
 */
export const production = {
  general: (api) => {
    return {
      developmentMode: false
    }
  }
}
