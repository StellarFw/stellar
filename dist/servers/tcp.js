'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _tls = require('tls');

var _tls2 = _interopRequireDefault(_tls);

var _genericServer = require('../genericServer');

var _genericServer2 = _interopRequireDefault(_genericServer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// server type
let type = 'tcp';

// server attributes
let attributes = {
  canChat: true,
  logConnections: true,
  logExits: true,
  pendingShutdownWaitLimit: 5000,
  sendWelcomeMessage: true,
  verbs: ['quit', 'exit', 'paramAdd', 'paramDelete', 'paramView', 'paramsView', 'paramsDelete', 'roomJoin', 'roomLeave', 'roomView', 'detailsView', 'say', 'event']

  /**
   * TCP server implementation.
   */
};class Tcp extends _genericServer2.default {

  /**
   * Create a new server instance.
   *
   * @param api       API object reference.
   * @param options   Server options.
   */
  constructor(api, options) {
    // call super constructor
    super(api, type, options, attributes

    // define events
    );this.server = null;
    this._defineEvents();
  }

  // ------------------------------------------------------------------------------------------------ [Required Methods]

  /**
   * Start server.
   *
   * @param callback callback
   */

  /**
   * TCP server socket.
   */
  start(callback) {
    let self = this;

    if (self.options.secure === false) {
      self.server = _net2.default.createServer(self.api.config.servers.tcp.serverOptions, rawConnection => {
        self._handleConnection(rawConnection);
      });
    } else {
      self.server = _tls2.default.createServer(self.api.config.servers.tcp.serverOptions, rawConnection => {
        self._handleConnection(rawConnection);
      });
    }

    // on server error
    self.server.on('error', e => {
      return callback(new Error(`Cannot start tcp server @ ${self.options.bindIP}:${self.options.port} => ${e.message}`));
    }

    // server listener
    );self.server.listen(self.options.port, self.options.bindIP, () => {
      process.nextTick(callback);
    });
  }

  /**
   * Stop server.
   *
   * @param next
   */
  stop(next) {
    this._gracefulShutdown(next);
  }

  /**
   * Send a message to a client.
   *
   * @param connection    Client connection object.
   * @param message       Message to be sent.
   * @param messageCount  Number of messages already sent for this client.
   */
  sendMessage(connection, message, messageCount) {
    let self = this;

    // if is an error message serialize the object
    if (message.error) {
      message.error = self.api.config.errors.serializers.servers.tcp(message.error);
    }

    if (connection.respondingTo) {
      message.messageCount = messageCount;
      connection.respondingTo = null;
    } else if (message.context === 'response') {
      // if the messageCount isn't defined use the connection.messageCount
      if (messageCount) {
        message.messageCount = messageCount;
      } else {
        message.messageCount = connection.messageCount;
      }
    }

    // try send the message to the client
    try {
      connection.rawConnection.write(JSON.stringify(message) + '\r\n');
    } catch (e) {
      self.api.log(`socket write error: ${e}`, 'error');
    }
  }

  /**
   * Close the connection with the client sending a 'Bye!' message.
   *
   * @param connection  Client connection.
   */
  goodbye(connection) {
    let self = this;

    try {
      connection.rawConnection.end(JSON.stringify({
        status: connection.localize(self.api.config.servers.tcp.goodbeyMessage),
        context: 'api'
      }) + '\r\n');
    } catch (e) {}
  }

  /**
   * Send a file to the client.
   *
   * If the error is defined send a error message instead.
   *
   * @param connection  Client connection object.
   * @param error       Error object.
   * @param fileStream  FileStream object.
   */
  sendFile(connection, error, fileStream) {
    let self = this;

    // if is an error response send a message with the error
    if (error) {
      self.server.sendMessage(connection, error, connection.messageCount);
    } else {
      // send the file to client
      fileStream.pipe(connection.rawConnection, { end: false });
    }
  }

  // ---------------------------------------------------------------------------------------------------------- [Events]

  /**
   * Define server events.
   *
   * @private
   */
  _defineEvents() {
    let self = this;

    // on connection event
    self.on('connection', connection => {
      connection.params = {};

      let parseLine = line => {
        // check the message length if the maxDataLength is active
        if (self.api.config.servers.tcp.maxDataLength > 0) {
          let bufferLen = Buffer.byteLength(line, 'utf8');

          if (bufferLen > self.api.config.servers.tcp.maxDataLength) {
            let error = self.api.config.errors.dataLengthTooLarge(self.api.config.servers.tcp.maxDataLength, bufferLen);
            self.log(error, 'error');
            return self.sendMessage(connection, { status: 'error', error: error, context: 'response' });
          }
        }

        if (line.length > 0) {
          // increment at the start of the request so that responses can be caught in order
          // on the client, this is not handled by the genericServer
          connection.messageCount++;
          self._parseRequest(connection, line);
        }
      };

      // on data event
      connection.rawConnection.on('data', chunk => {
        if (self._checkBreakChars(chunk)) {
          connection.destroy();
        } else {
          connection.rawConnection.socketDataString += chunk.toString('utf-8').replace(/\r/g, '\n');
          let index;

          // get delimiter
          let delimiter = String(self.api.config.servers.tcp.delimiter);

          while ((index = connection.rawConnection.socketDataString.indexOf(delimiter)) > -1) {
            let data = connection.rawConnection.socketDataString.slice(0, index);
            connection.rawConnection.socketDataString = connection.rawConnection.socketDataString.slice(index + delimiter.length);
            data.split(delimiter).forEach(parseLine);
          }
        }
      }

      // on end event
      );connection.rawConnection.on('end', () => {
        // if the connection isn't destroyed do it now
        if (connection.destroyed !== true) {
          try {
            connection.rawConnection.end();
          } catch (e) {}
          connection.destroy();
        }
      }

      // on error event
      );connection.rawConnection.on('error', e => {
        if (connection.destroyed !== true) {
          self.log(`server error: ${e}`, 'error');

          try {
            connection.rawConnection.end();
          } catch (e) {}
          connection.destroy();
        }
      });
    }

    // on actionComplete event
    );self.on('actionComplete', data => {
      if (data.toRender === true) {
        data.response.context = 'response';
        self.sendMessage(data.connection, data.response, data.messageCount);
      }
    });
  }

  // --------------------------------------------------------------------------------------------------------- [Helpers]

  /**
   * Parse client request.
   *
   * @param connection  Client connection object.
   * @param line        Request line to be parsed.
   * @private
   */
  _parseRequest(connection, line) {
    let self = this;

    let words = line.split(' '

    // get the verb how are
    );let verb = words.shift();

    if (verb === 'file') {
      if (words.length > 0) {
        connection.params.file = words[0];
      }
      self.processFile(connection);
      return;
    }

    connection.verbs(verb, words, (error, data) => {
      // send an success response message, when there is no errors
      if (!error) {
        self.sendMessage(connection, { status: 'OK', context: 'response', data: data });
        return;
      }

      if (error.code && error.code.match('014')) {
        // Error: Verb not found or not allowed
        // check for and attempt to check single-use params
        try {
          // parse JSON request
          let requestHash = JSON.parse(line

          // pass all founded params to the connection object
          );if (requestHash.params !== undefined) {
            connection.params = {};

            for (let v in requestHash.params) {
              connection.params[v] = requestHash.params[v];
            }
          }

          // pass action name to the connection object, if exists
          if (requestHash.action) {
            connection.params.action = requestHash.action;
          }
        } catch (e) {
          connection.params.action = verb;
        }

        // reset some connection properties
        connection.error = null;
        connection.response = {};

        // process actions
        self.processAction(connection);
        return;
      }

      // send an error message
      self.sendMessage(connection, { status: error, context: 'response', data: data });
    });
  }

  /**
   * Handle new connection.
   *
   * @param rawConnection Client raw connection object.
   * @private
   */
  _handleConnection(rawConnection) {
    let self = this;

    // if the options are enabled, set keepAlive to true
    if (self.api.config.servers.tcp.setKeepAlive === true) {
      rawConnection.setKeepAlive(true);
    }

    // reset socket data
    rawConnection.socketDataString = '';

    // build a new connection object (will emit 'connection')
    self.buildConnection({
      rawConnection: rawConnection,
      remoteAddress: rawConnection.remoteAddress,
      remotePort: rawConnection.remotePort
    });
  }

  /**
   * Check if the chunk contains the break chars.
   *
   * @param chunk         Chunk to the analysed.
   * @returns {boolean}   True if found, false otherwise.
   * @private
   */
  _checkBreakChars(chunk) {
    let found = false;
    let hexChunk = chunk.toString('hex', 0, chunk.length);

    if (hexChunk === 'fff4fffd06') {
      found = true; // CTRL + C
    } else if (hexChunk === '04') {
      found = true; // CTRL + D
    }

    return found;
  }

  /**
   * Try a graceful shutdown.
   *
   * We will wait a while to Stellar try response to the pending connections.
   *
   * @param next              Callback.
   * @param alreadyShutdown   Informs if the server was already shutdown.
   * @private
   */
  _gracefulShutdown(next, alreadyShutdown = false) {
    let self = this;

    // if the server isn't already shutdown do it now
    if (!alreadyShutdown || alreadyShutdown === false) {
      self.server.close();
    }

    let pendingConnections = 0;

    // finish all pending connections
    self.connections().forEach(connection => {
      // if there is no pending actions destroy the connection
      if (connection.pendingActions === 0) {
        connection.destroy();
        return;
      }

      // increment the pending connections
      pendingConnections++;

      if (!connection.rawConnection.shutDownTimer) {
        connection.rawConnection.shutDownTimer = setTimeout(() => {
          connection.destroy();
        }, attributes.pendingShutdownWaitLimit);
      }
    });

    if (pendingConnections > 0) {
      self.log(`waiting on shutdown, there are still ${pendingConnections} connected clients waiting on a response`, 'notice');
      setTimeout(() => {
        self._gracefulShutdown(next, true);
      }, 1000);
    } else if (typeof next === 'function') {
      next();
    }
  }
}
exports.default = Tcp;