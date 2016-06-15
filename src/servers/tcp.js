import net from 'net'
import tls from 'tls'
import GenericServer from '../genericServer'

// server type
let type = 'tcp'

// server attributes
let attributes = {
  canChat: true,
  logConnections: true,
  logExits: true,
  pendingShutdownWaitLimit: 5000,
  sendWelcomeMessage: true,
  verbs: [
    'quit',
    'exit',
    'documentation',
    'paramAdd',
    'paramDelete',
    'paramView',
    'paramsView',
    'paramsDelete',
    'roomAdd',
    'roomLeave',
    'roomView',
    'detailsView',
    'say'
  ]
};

export default class Tcp extends GenericServer {

  server;

  constructor (api, options) {
    super(api, type, options, attributes);

    // define events
    this._defineEvents();
  }

  // ------------------------------------------------------------------------------------------------ [Required Methods]

  /**
   * Start server.
   *
   * @param next callback
   */
  start (next) {
    let self = this;

    if (self.options.secure === false) {
      self.server = net.createServer(self.api.config.servers.tcp.serverOptions, (rawConnection) => {
        self._handleConnection(rawConnection);
      });
    } else {
      self.server = tls.createServer(self.api.config.servers.tcp.serverOptions, (rawConnection) => {
        self._handleConnection(rawConnection);
      });
    }

    // on server error
    self.server.on('error', (e) => {
      return next(new Error(`Cannot start tcp server @ ${self.options.bindIP}:${self.options.port} => ${e.message}`));
    });

    // server listener
    self.server.listen(self.options.port, self.options.bindIP, () => {
      process.nextTick(() => {
        next();
      })
    });
  }

  /**
   * Stop server.
   *
   * @param next
   */
  stop (next) {
    self._gracefulShutdown(next);
  }

  /**
   * Send a message to a client.
   *
   * @param connection    Client connection object.
   * @param message       Message to be sent.
   * @param messageCount  Number of messages already sent for this client.
   */
  sendMessage (connection, message, messageCount) {
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
  goodbye (connection) {
    try {
      connection.rawConnection.end(JSON.stringify({status: 'Bye!', context: 'api'}) + '\r\n');
    } catch (e) {
    }
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
  sendFile (connection, error, fileStream) {
    // if is an error response send a message with the error
    if (error) {
      server.sendMessage(connection, error, connection.messageCount);
    } else {
      // send the file to client
      fileStream.pipe(connection.rawConnection, {end: false});
    }
  }

  // ---------------------------------------------------------------------------------------------------------- [Events]

  /**
   * Define server events.
   *
   * @private
   */
  _defineEvents () {
    let self = this;

    // on connection event
    self.on('connection', (connection) => {
      connection.params = {};

      let parseLine = (line) => {
        if (line.length > 0) {
          // increment at the start of the request so that responses can be caught in order
          // on the client, this is not handled by the genericServer
          connection.messageCount++;
          self._parseRequest(connection, line);
        }
      };

      // on data event
      connection.rawConnection.on('data', (chunk) => {
        if (self._checkBreakChars(chunk)) {
          connection.destroy();
        } else {
          connection.rawConnection.socketDataString += chunk.toString('utf-8').replace(/\r/g, '\n');
          let index;
          while ((index = connection.rawConnection.socketDataString.indexOf('\n')) > -1) {
            let data = connection.rawConnection.socketDataString.slice(0, index);
            connection.rawConnection.socketDataString = connection.rawConnection.socketDataString.slice(index + 2);
            data.split('\n').forEach(parseLine);
          }
        }
      });

      // on end event
      connection.rawConnection.on('end', () => {
        // if the connection isn't destroyed do it now
        if (connection.destroyed !== true) {
          try {
            connection.rawConnection.end();
          } catch (e) {
          }
          connection.destroy();
        }
      });

      // on error event
      connection.rawConnection.on('error', (e) => {
        if (connection.destroyed !== true) {
          self.log(`server error: ${e}`, 'error');

          try {
            connection.rawConnection.end();
          } catch (e) {
          }
          connection.destroy();
        }
      });
    });

    // on actionComplete event
    self.on('actionComplete', (data) => {
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
  _parseRequest (connection, line) {
    let self = this;

    let words = line.split(' ');
    let verb = words.shift();

    if (verb === 'file') {
      if (words.length > 0) {
        connection.params.file = words[ 0 ];
      }
      self.processFile(connection);
    } else {
      connection.verbs(verb, words, (error, data) => {
        if (!error) {
          // send an success response message
          self.sendMessage(connection, {status: 'OK', context: 'response', data: data});
        } else if (error.match('verb not found or not allowed')) {
          // check for and attempt to check single-use params
          try {
            // parse JSON request
            let requestHash = JSON.parse(line);

            // pass all founded params to the connection object
            if (requestHash.params !== undefined) {
              connection.params = {};
              for (let v in requestHash.params) {
                connection.params[ v ] = requestHash.params[ v ];
              }
            }

            // pass action name to the connection object, if exists
            if (requestHash.action) {
              connection.params.action = requestHash.action;
            }
          } catch (e) {
            connection.params.action = verb;
          }
        } else {
          // send an error message
          self.sendMessage(connection, {status: error, context: 'response', data: data});
        }

        // reset some connection properties
        connection.error = null;
        connection.response = {};

        // process actions
        self.processAction(connection);
      });
    }
  }

  /**
   * Handle new connection.
   *
   * @param rawConnection Client raw connection object.
   * @private
   */
  _handleConnection (rawConnection) {
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
  _checkBreakChars (chunk) {
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
  _gracefulShutdown (next, alreadyShutdown = false) {
    let self = this;

    // if the server isn't already shutdown do it now
    if (alreadyShutdown === false) {
      self.server.close();
    }

    let pendingConnections = 0;

    // finish all pending connections
    self.connections().forEach((connection) => {
      if (connection.pendingActions === 0) {
        connection.destroy();
      } else {
        pendingConnections++;

        if (!connection.rawConnection.shutDownTimer) {
          connection.rawConnection.shutDownTimer = setTimeout(() => {
            connection.destroy();
          }, attributes.pendingShutdownWaitLimit);
        }
      }
    });

    if (pendingConnections > 0) {
      self.log(`waiting on shutdown, there are still ${pendingConnections} connected clients waiting on a response`, 'notice');
      setTimeout(() => {
        self._gracefulShutdown(next, true);
      }, 1000);
    } else if (typeof  next === 'function') {
      next();
    }
  }

}
