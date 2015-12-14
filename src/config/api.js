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
      // Configutation for Stellar project structure
      // ---------------------------------------------------------------------
      paths: {
        'public': api.scope.rootPath + '/public'
      }
    };
  }
}
