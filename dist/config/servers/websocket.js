'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = {
  servers: {
    websocket: function websocket(api) {
      return {
        // ---------------------------------------------------------------------
        // Enable the server?
        // ---------------------------------------------------------------------
        enable: true,

        // ---------------------------------------------------------------------
        // Client location.
        //
        // This can also be a FQDN.
        // ---------------------------------------------------------------------
        clientUrl: 'window.location.origin',

        // ---------------------------------------------------------------------
        // The name of the client-side JS file to render.
        //
        // Both '.js' and '.min.js' versions will be created do not include the
        // file extension.
        // ---------------------------------------------------------------------
        clientJsName: 'stellar-client',

        // ---------------------------------------------------------------------
        // Should the server signal clients to not reconnect when the server is
        // shutdown/reboot.
        // ---------------------------------------------------------------------
        destroyClientsOnShutdown: false,

        // ---------------------------------------------------------------------
        // WebSocket client options
        // ---------------------------------------------------------------------
        client: {
          // the api base endpoint on your actionhero server
          apiPath: '/api'
        },

        // ---------------------------------------------------------------------
        // WebSocket server options
        // ---------------------------------------------------------------------
        server: {
          // this disable Primus warning on cluster environments
          iknowclusterwillbreakconnections: true
        }
      };
    }
  }
};