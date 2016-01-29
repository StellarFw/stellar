export default {
  servers: {
    web: function (api) {
      return {
        // ---------------------------------------------------------------------
        // Enable the server?
        // ---------------------------------------------------------------------
        enable: true,

        // ---------------------------------------------------------------------
        // If this property are defined to false we will use a regular HTTP
        // connection, otherwise we use a secure HTTPS connection.
        // ---------------------------------------------------------------------
        secure: false,

        // ---------------------------------------------------------------------
        // This config map is passed to the https.createServer method.
        //
        // This is only used if we are using a secure connection. This should
        // contains the SSL certificate.
        // ---------------------------------------------------------------------
        serverOptions: {},

        // ---------------------------------------------------------------------
        // Server socket port.
        //
        // This options can be overwrited withe PORT param on the console
        // execution.
        // ---------------------------------------------------------------------
        port: process.env.PORT || 8080,

        // ---------------------------------------------------------------------
        // This is the IP who will be used to listen the web socket.
        //
        // If this property are defined to '0.0.0.0' we listen for all on the
        // IPv4 and IPv6.
        // ---------------------------------------------------------------------
        bindIP: '0.0.0.0',

        // ---------------------------------------------------------------------
        // This are the headers who are sended on all Stellar responses.
        //
        // By default this tells CORS to allow request from any origin.
        // ---------------------------------------------------------------------
        httpHeaders: {
          'X-Powered-By': api.config.general.serverName,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, TRACE',
          'Access-Control-Allow-Headers': 'Content-Type'
        },

        // ---------------------------------------------------------------------
        // Define the route that actions will be served from.
        //
        // Using a call format like REST is treated as an action call too.
        // IE: /api?action=generateNumber == /api/generateNumber
        // ---------------------------------------------------------------------
        urlPathForActions: 'api',

        // ---------------------------------------------------------------------
        // When visiting the root URL, should visitors see 'api' or 'file'?
        //
        // Visitors can always visit /api and /public as normal.
        // ---------------------------------------------------------------------
        rootEndpointType: 'file',

        // ---------------------------------------------------------------------
        // Settings for determining the id of an http(s) request
        // (browser-fingerprint)
        // ---------------------------------------------------------------------
        fingerprintOptions: {
          cookieKey: 'sessionID',
          toSetCookie: true,
          onlyStaticElements: false,
          settings: {
            path: '/',
            expires: 3600000
          }
        },

        // ---------------------------------------------------------------------
        // Options to be applied to incoming file uploads.
        // ---------------------------------------------------------------------
        formOptions: {
          uploadDir: '/tmp',
          keepExtensions: false,
          maxFieldsSize: 1024 * 1024 * 100
        },

        // ---------------------------------------------------------------------
        // Options to pass to the query parser.
        //
        // All options available at https://github.com/hapijs/qs
        // ---------------------------------------------------------------------
        queryParseOptions: {},

        // ---------------------------------------------------------------------
        // queryRouting allows an action to be defined via a URL param,
        // ie: /api?action=:action
        // ---------------------------------------------------------------------
        queryRouting: true,

        // ---------------------------------------------------------------------
        // Options to configure metadata in responses
        // ---------------------------------------------------------------------
        metadataOptions: {
          serverInformation: true,
          requesterInformation: true
        }
      };
    }
  }
};
