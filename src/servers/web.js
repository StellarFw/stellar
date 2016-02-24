import fs from 'fs';
import qs from 'qs';
import url from 'url';
import path from 'path';
import uuid from 'node-uuid';
import Utils from '../utils';
import formidable from 'formidable';
import GenericServer from '../genericServer';
import browser_fingerprint from 'browser_fingerprint';

// server type
let type = 'web';

// server attributes
let attributes = {
  canChat: false,
  logConnections: false,
  logExists: false,
  sendWelcomeMessage: false,
  verbs: [
    // no verbs for connections of this type, as they are to very short-lived
  ]
};

export default class Web extends GenericServer {

  /**
   * Http server instance.
   */
  server;

  /**
   * Constructor.
   *
   * @param api       api instance.
   * @param options   map with the server options.
   */
  constructor(api, options) {
    super(api, type, options, attributes);

    let self = this;

    if ([ 'api', 'file' ].indexOf(self.api.config.servers.web.rootEndpointType) < 0) {
      throw new Error(`api.config.servers.web.rootEndpointType can only be 'api' or 'file'.`);
    }

    //////////////////// [EVENTS]
    self.on('connection', function (connection) {
      self._determineRequestParams(connection, function (requestMode) {
        switch (requestMode) {
          case 'api':
            self.processAction(connection);
            break;
          case 'file':
            self.processFile(connection);
            break;
          case 'options':
            self._respondToOptions(connection);
            break;
          case 'client-lib':
            self.processClientLib(connection);
            break;
          default:
            self.api.log(`TODO - ${requestMode}`, 'emergency');
        }
      });
    });

    // event to be executed after the action completion
    self.on('actionComplete', function (data) {
      self._completeResponse(data);
    });

  }

  //////////////////// [REQUIRED METHODS]

  /**
   * Start a new server instance.
   */
  start(next) {
    let self = this;

    if (self.options.secure === false) {
      let http = require('http');
      self.server = http.createServer(function (req, res) {
        self._handleRequest(req, res);
      });
    } else {
      let https = require('http');
      self.server = https.createServer(self.api.config.servers.web.ServerOptions, function (req, res) {
        self._handleRequest(req, res);
      });
    }

    let bootAttempts = 0;
    self.server.on('error', function (e) {
      bootAttempts++;

      if (bootAttempts < api.config.servers.web.bootAttempts) {
        self.log(`cannot boot web server; trying again [${String(e)}]`, 'error');

        if (bootAttempts === 1) {
          self.cleanSocket(self.options.bindIP, self.options.port);
        }

        setTimeout(function () {
          self.log(`attempting to boot again...`);
          self.server.listen(self.options.port, self.options.bindIP);
        });
      } else {
        return next(new Error(`Cannot start web server @ ${self.options.bindIP}:${self.options.port} => ${e.message}`));
      }
    });

    self.server.listen(self.options.port, self.options.bindIP, function () {
      self.chmodSocket(self.options.bindIP, self.options.port);
      next();
    });
  }

  /**
   * Stop server.
   *
   * @param next callback
   */
  stop(next) {
    this.server.close();
    process.nextTick(function () {
      next();
    });
  }

  /**
   * Send a message to the client.
   *
   * @param connection
   * @param message
   */
  sendMessage(connection, message) {
    let self = this;
    let stringResponse = '';

    // if the connection is as 'HEAD' HTTP method we need
    // to ensure the message is a string
    if (connection.rawConnection.method !== 'HEAD') {
      stringResponse = String(message);
    }

    self.cleanHeaders(connection);
    let headers = connection.rawConnection.responseHeaders;
    let responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);

    self.sendWithCompression(connection, responseHttpCode, headers, stringResponse);
  }

  /**
   * Send a file to the client.
   *
   * @param connection
   * @param error
   * @param fileStream
   * @param mime
   * @param length
   * @param lastModified
   */
  sendFile(connection, error, fileStream, mime, length, lastModified) {
    let self = this;
    let foundExpires = false;
    let foundCacheControl = false;
    let ifModifiedSince;
    let reqHeaders;

    connection.rawConnection.responseHeaders.forEach(function (pair) {
      if (pair[ 0 ].toLowerCase() === 'expires') {
        foundExpires = true;
      }
      if (pair[ 1 ].toLowerCase() === 'cache-control') {
        foundCacheControl = true;
      }
    });

    reqHeaders = connection.rawConnection.req.headers;
    if (reqHeaders[ 'if-modified-since' ]) {
      ifModifiedSince = new Date(reqHeaders[ 'if-modified-since' ]);
    }

    // add mime type to the response headers
    connection.rawConnection.responseHeaders.push([ 'Content-Type', mime ]);

    // check if file expires
    if (foundExpires === false) {
      connection.rawConnection.responseHeaders.push([ 'Expires',
        new Date(new Date().getTime() + self.api.config.servers.web.flatFileCacheDuration * 1000).toUTCString() ]);
    }

    // check if exists a cache control
    if (foundCacheControl === false) {
      connection.rawConnection.responseHeaders.push([ 'Cache-Control', 'max-age=' + self.api.config.servers.web.flatFileCacheDuration + ', must-revalidate, public' ]);
    }

    // add header entry for last modified info
    connection.rawConnection.responseHeaders.push([ 'Last-Modified', new Date(lastModified) ]);

    self.cleanHeaders(connection);
    let headers = connection.rawConnection.responseHeaders;
    if (error) {
      connection.rawConnection.responseHttpCode = 404
    }
    if (ifModifiedSince && lastModified <= ifModifiedSince) {
      connection.rawConnection.responseHttpCode = 304
    }
    let responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);
    if (error) {
      self.sendWithCompression(connection, responseHttpCode, headers, String(error));
    }
    else if (responseHttpCode !== 304) {
      self.sendWithCompression(connection, responseHttpCode, headers, null, fileStream, length);
    } else {
      connection.rawConnection.res.writeHead(responseHttpCode, headers);
      connection.rawConnection.res.end();
      connection.destroy();
    }
  }

  /**
   * Send a compressed message to the client.
   *
   * @param connection
   * @param responseHttpCode
   * @param headers
   * @param stringResponse
   * @param fileStream
   * @param fileLength
   */
  sendWithCompression(connection, responseHttpCode, headers, stringResponse, fileStream, fileLength) {
    let self = this;
    let compressor, stringEncoder;
    let acceptEncoding = connection.rawConnection.req.headers[ 'accept-encoding' ];

    // Note: this is not a conformant accept-encoding parser.
    // https://nodejs.org/api/zlib.html#zlib_zlib_createinflate_options
    // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    if (self.api.config.servers.web.compress === true) {
      if (acceptEncoding.match(/\bdeflate\b/)) {
        headers.push([ 'Content-Encoding', 'deflate' ]);
        compressor = zlib.createDeflate();
        stringEncoder = zlib.deflate;
      } else if (acceptEncoding.match(/\bgzip\b/)) {
        headers.push([ 'Content-Encoding', 'gzip' ]);
        compressor = zlib.createGzip();
        stringEncoder = zlib.gzip;
      }
    }

    // note: the 'end' event may not fire on some OSes; finish will
    connection.rawConnection.res.on('finish', function () {
      connection.destroy();
    });

    if (fileStream) {
      if (compressor) {
        connection.rawConnection.res.writeHead(responseHttpCode, headers);
        fileStream.pipe(compressor).pipe(connection.rawConnection.res)
      } else {
        headers.push([ 'Content-Length', fileLength ]);
        connection.rawConnection.res.writeHead(responseHttpCode, headers);
        fileStream.pipe(connection.rawConnection.res);
      }
    } else {
      if (stringEncoder) {
        stringEncoder(stringResponse, function (error, zippedString) {
          headers.push([ 'Content-Length', zippedString.length ]);
          connection.rawConnection.res.writeHead(responseHttpCode, headers);
          connection.rawConnection.res.end(zippedString);
        });
      } else {
        headers.push([ 'Content-Length', Buffer.byteLength(stringResponse) ]);
        connection.rawConnection.res.writeHead(responseHttpCode, headers);
        connection.rawConnection.res.end(stringResponse);
      }
    }
  }

  /**
   * Disconnect a client.
   *
   * @param connection
   */
  goodbye(connection) {
    // disconnect handlers
  }

  // --------------------------------------------------------------------------------------------------------- [PRIVATE]

  _handleRequest(req, res) {
    let self = this;

    browser_fingerprint.fingerprint(req, self.api.config.servers.web.fingerprintOptions, function (fingerprint, elementHash, cookieHash) {
      let responseHeaders = [];
      let cookies = Utils.parseCookies(req);
      let responseHttpCode = 200;
      let method = req.method.toUpperCase();
      let parsedURL = url.parse(req.url, true);
      let i;

      for (i in cookieHash) {
        responseHeaders.push([ i, cookieHash[ i ] ]);
      }

      responseHeaders.push([ 'Content-Type', 'application/json; charset=utf-8' ]);

      for (i in self.api.config.servers.web.httpHeaders) {
        responseHeaders.push([ i, self.api.config.servers.web.httpHeaders[ i ] ]);
      }

      let remoteIP = req.connection.remoteAddress;
      let remotePort = req.connection.remotePort;

      // helpers for unix socket bindings with no forward
      if (!remoteIP && !remotePort) {
        remoteIP = '0.0.0.0';
        remotePort = '0';
      }

      if (req.headers[ 'x-forwarded-for' ]) {
        let parts;
        let forwardedIp = req.headers[ 'x-forwarded-for' ].split(',')[ 0 ];
        if (forwardedIp.indexOf('.') >= 0 || (forwardedIp.indexOf('.') < 0 && forwardedIp.indexOf(':') < 0)) {
          // IPv4
          forwardedIp = forwardedIp.replace('::ffff:', ''); // remove any IPv6 information, ie: '::ffff:127.0.0.1'
          parts = forwardedIp.split(':');
          if (parts[ 0 ]) {
            remoteIP = parts[ 0 ];
          }
          if (parts[ 1 ]) {
            remotePort = parts[ 1 ];
          }
        } else {
          // IPv6
          parts = api.utils.parseIPv6URI(forwardedIp);
          if (parts.host) {
            remoteIP = parts.host;
          }
          if (parts.port) {
            remotePort = parts.port;
          }
        }

        if (req.headers[ 'x-forwarded-port' ]) {
          remotePort = req.headers[ 'x-forwarded-port' ];
        }
      }

      self.buildConnection({
        // will emit 'connection'
        rawConnection: {
          req: req,
          res: res,
          params: {},
          method: method,
          cookies: cookies,
          responseHeaders: responseHeaders,
          responseHttpCode: responseHttpCode,
          parsedURL: parsedURL
        },
        id: `${fingerprint}-${uuid.v4()}`,
        fingerprint: fingerprint,
        remoteAddress: remoteIP,
        remotePort: remotePort
      });
    });
  }

  /**
   * Change socket permission.
   *
   * @param bindIP
   * @param port
   */
  chmodSocket(bindIP, port) {
    let self = this;
    if (!self.options.bindIP && self.options.port.indexOf('/') >= 0) {
      fs.chmodSync(port, 0o777);
    }
  }

  _determineRequestParams(connection, callback) {
    let self = this;

    // determine if is a file or an api request
    let requestMode = self.api.config.servers.web.rootEndpointType;
    let pathname = connection.rawConnection.parsedURL.pathname;
    let pathParts = pathname.split('/');
    let matcherLength, i;

    while (pathParts[ 0 ] === '') {
      pathParts.shift();
    }

    if (pathParts[ pathParts.length - 1 ] === '') {
      pathParts.pop();
    }

    if (pathParts[ 0 ] && pathParts[ 0 ] === self.api.config.servers.web.urlPathForActions) {
      requestMode = 'api';
      pathParts.shift();
    } else if (pathParts[ 0 ] && pathParts[ 0 ] === self.api.config.servers.websocket.clientJsName) {
      requestMode = 'client-lib';
      pathParts.shift();
    } else if (pathParts[ 0 ] && pathParts[ 0 ] === self.api.config.servers.web.urlPathForFiles) {
      requestMode = 'file';
      pathParts.shift();
    } else if (pathParts[ 0 ] && pathname.indexOf(self.api.config.servers.web.urlPathForActions) === 0) {
      requestMode = 'api';
      matcherLength = self.api.config.servers.web.urlPathForActions.split('/').length;
      for (i = 0; i < (matcherLength - 1); i++) {
        pathParts.shift();
      }
    } else if (pathParts[ 0 ] && pathname.indexOf(self.api.config.servers.web.urlPathForFiles) === 0) {
      requestMode = 'file';
      matcherLength = api.config.servers.web.urlPathForFiles.split('/').length;
      for (i = 0; i < (matcherLength - 1); i++) {
        pathParts.shift();
      }
    }

    var extensionParts = connection.rawConnection.parsedURL.pathname.split('.');
    if (extensionParts.length > 1) {
      connection.extension = extensionParts[ (extensionParts.length - 1) ];
    }

    // OPTIONS Request
    if (connection.rawConnection.method === 'OPTIONS') {
      requestMode = 'options';
      callback(requestMode);
    }

    // API
    else if (requestMode === 'api') {
      if (connection.rawConnection.method === 'TRACE') {
        requestMode = 'trace';
      }

      let search = connection.rawConnection.parsedURL.search.slice(1);
      self._fillParamsFromWebRequest(connection, qs.parse(search, self.api.config.servers.web.queryParseOptions));
      connection.rawConnection.params.query = connection.rawConnection.parsedURL.query;

      if (connection.rawConnection.method !== 'GET' && connection.rawConnection.method !== 'HEAD' &&
        ( connection.rawConnection.req.headers[ 'content-type' ] || connection.rawConnection.req.headers[ 'Content-Type' ] )) {
        connection.rawConnection.form = new formidable.IncomingForm();

        for (i in self.api.config.servers.web.formOptions) {
          connection.rawConnection.form[ i ] = self.api.config.servers.web.formOptions[ i ];
        }

        connection.rawConnection.form.parse(connection.rawConnection.req, (err, fields, files) => {
          if (err) {
            self.log('error processing form: ' + String(err), 'error');
            connection.error = new Error('There was an error processing this form.')
          } else {
            connection.rawConnection.params.body = fields;
            connection.rawConnection.params.files = files;
            self._fillParamsFromWebRequest(connection, files);
            self._fillParamsFromWebRequest(connection, fields);
          }

          if (self.api.config.servers.web.queryRouting !== true) {
            connection.params.action = null;
          }

          // process route
          self.api.routes.processRoute(connection, pathParts);

          callback(requestMode);
        });
      } else {
        if (self.api.config.servers.web.queryRouting !== true) {
          connection.params.action = null;
        }

        // process route
        self.api.routes.processRoute(connection, pathParts);

        callback(requestMode);
      }
    } else if (requestMode === 'file') {
      if (!connection.params.file) {
        connection.params.file = pathParts.join(path.sep);
      }
      if (connection.params.file === '' || connection.params.file[ connection.params.file.length - 1 ] === '/') {
        connection.params.file = connection.params.file + self.api.config.general.directoryFileType;
      }
      callback(requestMode);
    } else if (requestMode === 'client-lib') {
      callback(requestMode);
    }
  }

  processClientLib(connection) {
    let self = this;

    // client lib
    let file = path.normalize(
      self.api.config.general.paths.temp + path.sep +
      self.api.config.servers.websocket.clientJsName + '.js');

    // define the file to be loaded
    connection.params.file = file;

    // process like a file
    self.processFile(connection);
  }

  /**
   * Fill the connection with the web request params.
   *
   * @param connection Connection object.
   * @param varsHash Request params.
   * @private
   */
  _fillParamsFromWebRequest(connection, varsHash) {
    let self = this;

    // helper for JSON parts
    let collapsedVarsHash = Utils.collapseObjectToArray(varsHash);

    if (collapsedVarsHash !== false) {
      // post was an array, lets call it "payload"
      varsHash = {payload: collapsedVarsHash};
    }

    // copy requests params to connection object
    for (let v in varsHash) {
      connection.params[ v ] = varsHash[ v ];
    }
  }

  _completeResponse(data) {
    let self = this;

    if (data.toRender === true) {
      if (self.api.config.servers.web.metadataOptions.serverInformation) {
        let stopTime = new Date().getTime();

        data.response.serverInformation = {
          serverName: self.api.config.general.serverName,
          apiVersion: self.api.config.general.apiVersion,
          requestDuration: (stopTime - data.connection.connectedAt),
          currentTime: stopTime
        };
      }
    }

    // check if is to use requester information
    if (self.api.config.servers.web.metadataOptions.requesterInformation) {
      data.response.requesterInformation = self._buildRequesterInformation(data.connection);
    }

    // is an error response?
    if (data.response.error) {
      if (self.api.config.servers.web.returnErrorCoded === true && data.connection.rawConnection.responseHttpCode === 200) {
        if (data.actionStatus === 'unknown_action') {
          data.connection.rawConnection.responseHttpCode = 404;
        } else if (data.actionStatus === 'missing_params') {
          data.connection.rawConnection.responseHttpCode = 422;
        } else if (data.actionStatus === 'server_error') {
          data.connection.rawConnection.responseHttpCode = 500;
        } else {
          data.connection.rawConnection.responseHttpCode = 400;
        }
      }
    }

    if (!data.response.error && data.action && data.params.apiVersion && self.api.actions.actions[ data.params.action ][ data.params.apiVersion ].matchExtensionMimeType === true && data.connection.extension) {
      data.connection.rawConnection.responseHeaders.push([ 'Content-Type', Mime.lookup(data.connection.extension) ]);
    }

    // if its an error response we need to serialize the error object
    if (data.response.error) {
      data.response.error = self.api.config.errors.serializers.servers.web(data.response.error);
    }

    let stringResponse = '';

    // build the string response
    if (self._extractHeader(data.connection, 'Content-Type').match(/json/)) {
      stringResponse = JSON.stringify(data.response, null, self.api.config.servers.web.padding);
      if (data.params.callback) {
        data.connection.rawConnection.responseHeaders.push([ 'Content-Type', 'application/javascript' ]);
        stringResponse = data.connection.params.callback + '(' + stringResponse + ');';
      }
    } else {
      stringResponse = data.response;
    }

    // return the response to the client
    self.sendMessage(data.connection, stringResponse);
  }

  _extractHeader(connection, match) {
    let i = connection.rawConnection.responseHeaders.length - 1;

    while (i >= 0) {
      if (connection.rawConnection.responseHeaders[ i ][ 0 ].toLowerCase() === match.toLowerCase()) {
        return connection.rawConnection.responseHeaders[ i ][ 1 ];
      }
      i--;
    }
    return null;
  }

  _buildRequesterInformation(connection) {
    let requesterInformation = {
      id: connection.id,
      fingerprint: connection.fingerprint,
      remoteIP: connection.remoteIP,
      receivedParams: {}
    };

    for (let param in connection.params) {
      requesterInformation.receivedParams[ param ] = connection.params[ param ];
    }

    return requesterInformation;
  }

  /**
   * Remove some unnecessary headers from the response.
   *
   * @param connection
   */
  cleanHeaders(connection) {
    let originalHeaders = connection.rawConnection.responseHeaders.reverse();
    let foundHeaders = [];
    let cleanedHeaders = [];

    for (let i in originalHeaders) {
      let key = originalHeaders[ i ][ 0 ];
      let value = originalHeaders[ i ][ 1 ];

      if (foundHeaders.indexOf(key.toLowerCase()) >= 0 && key.toLowerCase().indexOf('set-cookie') < 0) {
        // ignore, it's a duplicate
      } else if (connection.rawConnection.method === 'HEAD' && key === 'Transfer-Encoding') {
        // ignore, we can't send this header for HEAD requests
      } else {
        foundHeaders.push(key.toLowerCase());
        cleanedHeaders.push([ key, value ]);
      }
    }

    connection.rawConnection.responseHeaders = cleanedHeaders;
  }

  _respondToOptions(connection = null) {
    let self = this;

    if (!self.api.config.servers.web.httpHeaders[ 'Access-Control-Allow-Methods' ] && !extractHeader(connection, 'Access-Control-Allow-Methods')) {
      let methods = 'HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE';
      connection.rawConnection.responseHeaders.push([ 'Access-Control-Allow-Methods', methods ]);
    }

    if (!self.api.config.servers.web.httpHeaders[ 'Access-Control-Allow-Origin' ] && !extractHeader(connection, 'Access-Control-Allow-Origin')) {
      var origin = '*';
      connection.rawConnection.responseHeaders.push([ 'Access-Control-Allow-Origin', origin ]);
    }
    self.sendMessage(connection, '');
  }
}
