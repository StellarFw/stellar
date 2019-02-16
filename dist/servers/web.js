'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _qs = require('qs');

var _qs2 = _interopRequireDefault(_qs);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _zlib = require('zlib');

var _zlib2 = _interopRequireDefault(_zlib);

var _etag = require('etag');

var _etag2 = _interopRequireDefault(_etag);

var _mime = require('mime');

var _mime2 = _interopRequireDefault(_mime);

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _stFormidable = require('st-formidable');

var _stFormidable2 = _interopRequireDefault(_stFormidable);

var _genericServer = require('../genericServer');

var _genericServer2 = _interopRequireDefault(_genericServer);

var _browser_fingerprint = require('browser_fingerprint');

var _browser_fingerprint2 = _interopRequireDefault(_browser_fingerprint);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// server type
let type = 'web';

// server attributes
let attributes = {
  canChat: false,
  logConnections: false,
  logExits: false,
  sendWelcomeMessage: false,
  verbs: [
    // no verbs for connections of this type, as they are to very short-lived
  ]

  /**
   * This implements the HTTP web server.
   */
};class Web extends _genericServer2.default {

  /**
   * Constructor.
   *
   * @param api       api instance.
   * @param options   map with the server options.
   */
  constructor(api, options) {
    // call the super constructor
    super(api, type, options, attributes);

    this.server = null;
    let self = this;

    this.fingerprinter = new _browser_fingerprint2.default(self.api.config.servers.web.fingerprintOptions);

    if (['api', 'file'].indexOf(self.api.config.servers.web.rootEndpointType) < 0) {
      throw new Error('api.config.servers.web.rootEndpointType can only be \'api\' or \'file\'.');
    }

    // -------------------------------------------------------------------------------------------------------- [EVENTS]
    self.on('connection', connection => {
      self._determineRequestParams(connection, requestMode => {
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
          case 'trace':
            self._respondToTrace(connection);
        }
      });
    });

    // event to be executed after the action completion
    self.on('actionComplete', data => {
      self._completeResponse(data);
    });
  }

  // ------------------------------------------------------------------------------------------------ [REQUIRED METHODS]

  /**
   * Start the server instance.
   *
   * @param next  Callback function.
   */

  /**
   * Http server instance.
   */
  start(next) {
    let self = this;

    // check if id to create a HTTP or a HTTPS server
    if (self.options.secure === false) {
      let http = require('http');
      self.server = http.createServer((req, res) => {
        self._handleRequest(req, res);
      });
    } else {
      let https = require('https');
      self.server = https.createServer(self.api.config.servers.web.serverOptions, (req, res) => {
        self._handleRequest(req, res);
      });
    }

    let bootAttempts = 0;

    self.server.on('error', e => {
      bootAttempts++;

      if (bootAttempts < self.api.config.servers.web.bootAttempts) {
        self.log(`cannot boot web server; trying again [${String(e)}]`, 'error');

        if (bootAttempts === 1) {
          self._cleanSocket(self.options.bindIP, self.options.port);
        }

        setTimeout(() => {
          self.log('attempting to boot again...');
          self.server.listen(self.options.port, self.options.bindIP);
        }, 1000);
      } else {
        return next(new Error(`Cannot start web server @ ${self.options.bindIP}:${self.options.port} => ${e.message}`));
      }
    });

    self.server.listen(self.options.port, self.options.bindIP, () => {
      self.chmodSocket(self.options.bindIP, self.options.port);
      next();
    });
  }

  /**
   * Stop server.
   *
   * @param next  Callback function.
   */
  stop(next) {
    let self = this;

    // close the server socket
    self.server.close();

    // execute the callback function
    process.nextTick(() => {
      next();
    });
  }

  /**
   * Send a message to the client.
   *
   * @param connection  Connection object where the message must be sent.
   * @param message     Message to be sent.
   */
  sendMessage(connection, message) {
    let self = this;

    // response string
    let stringResponse = '';

    // if the connection is as 'HEAD' HTTP method we need to
    // ensure the message is a string
    if (connection.rawConnection.method !== 'HEAD') {
      stringResponse = String(message);
    }

    // clean HTTP headers
    self._cleanHeaders(connection);

    // get the response headers
    let headers = connection.rawConnection.responseHeaders;

    // get the response status code
    let responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);

    // send the response to the client (use compression if active)
    self.sendWithCompression(connection, responseHttpCode, headers, stringResponse);
  }

  /**
   * Send a file to the client.
   *
   * @param connection      Connection object where the file must be sent.
   * @param error           Error object, null if not exists.
   * @param fileStream      FileStream for the requested file.
   * @param mime            File mime type.
   * @param length          File length in bytes.
   * @param lastModified    Timestamp if the last modification.
   */
  sendFile(connection, error, fileStream, mime, length, lastModified) {
    let foundCacheControl = false;
    let ifModifiedSince;
    let reqHeaders;

    // check if we should use cache mechanisms
    connection.rawConnection.responseHeaders.forEach(pair => {
      if (pair[0].toLowerCase() === 'cache-control') {
        foundCacheControl = true;
      }
    });

    // add mime type to the response headers
    connection.rawConnection.responseHeaders.push(['Content-Type', mime]);

    // If is to use a cache mechanism we must append a cache control header to the response
    if (fileStream) {
      if (!foundCacheControl) {
        connection.rawConnection.responseHeaders.push(['Cache-Control', `max-age=${this.api.config.servers.web.flatFileCacheDuration}, must-revalidate, public`]);
      }
    }

    // add a header to the response with the last modified timestamp
    if (fileStream && !this.api.config.servers.web.enableEtag) {
      if (lastModified) {
        connection.rawConnection.responseHeaders.push(['Last-Modified', new Date(lastModified).toUTCString()]);
      }
    }

    // clean the connection headers
    this._cleanHeaders(connection);

    // get headers from the client request
    reqHeaders = connection.rawConnection.req.headers;

    // get the response headers
    const headers = connection.rawConnection.responseHeaders;

    // This function is used to send the response to the client.
    const sendRequestResult = () => {
      // parse the HTTP status code to int
      let responseHttpCode = parseInt(connection.rawConnection.responseHttpCode, 10);

      if (error) {
        const errorString = error instanceof Error ? String(error) : JSON.stringify(error);
        this.sendWithCompression(connection, responseHttpCode, headers, errorString);
      } else if (responseHttpCode !== 304) {
        this.sendWithCompression(connection, responseHttpCode, headers, null, fileStream, length);
      } else {
        connection.rawConnection.res.writeHead(responseHttpCode, headers);
        connection.rawConnection.res.end();
        connection.destroy();
      }
    };

    // if an error exists change the status code to 404 and send the response
    if (error) {
      connection.rawConnection.responseHttpCode = 404;
      return sendRequestResult();
    }

    // get the 'if-modified-since' value if exists
    if (reqHeaders['if-modified-since']) {
      ifModifiedSince = new Date(reqHeaders['if-modified-since']);
      lastModified.setMilliseconds(0);
      if (lastModified <= ifModifiedSince) {
        connection.rawConnection.responseHttpCode = 304;
      }
      return sendRequestResult();
    }

    // check if is to use ETag
    if (this.api.config.servers.web.enableEtag && fileStream && fileStream.path) {
      // Get the file states in order to create the ETag header
      _fs2.default.stat(fileStream.path, (error, filestats) => {
        if (error) {
          this.log(`Error receiving file statistics: ${String(error)}`);
          return sendRequestResult();
        }

        // push the ETag header to the response
        const fileEtag = (0, _etag2.default)(filestats, { weak: true });
        connection.rawConnection.responseHeaders.push(['ETag', fileEtag]);

        let noneMatchHeader = reqHeaders['if-none-match'];
        let cacheCtrlHeader = reqHeaders['cache-control'];
        let noCache = false;
        let etagMatches;

        // check for no-cache cache request directive
        if (cacheCtrlHeader && cacheCtrlHeader.indexOf('no-cache') !== -1) {
          noCache = true;
        }

        // parse if-none-match
        if (noneMatchHeader) {
          noneMatchHeader = noneMatchHeader.split(/ *, */);
        }

        // if-none-match
        if (noneMatchHeader) {
          etagMatches = noneMatchHeader.some(match => match === '*' || match === fileEtag || match === 'W/' + fileEtag);
        }

        // use the cached object
        if (etagMatches && !noCache) {
          connection.rawConnection.responseHeaders = 304;
        }

        // send response
        sendRequestResult();
      });
    } else {
      sendRequestResult();
    }
  }

  /**
   * Send a compressed message to the client.
   *
   * @param connection          Connection object where the message must be sent.
   * @param responseHttpCode    HTTP Status code.
   * @param headers             HTTP response headers.
   * @param stringResponse      Response body.
   * @param fileStream          FileStream, only needed if to send a file.
   * @param fileLength          File size in bytes, only needed if is to send a file.
   */
  sendWithCompression(connection, responseHttpCode, headers, stringResponse, fileStream, fileLength) {
    let self = this;
    let compressor, stringEncoder;
    let acceptEncoding = connection.rawConnection.req.headers['accept-encoding'];

    // Note: this is not a conformant accept-encoding parser.
    // https://nodejs.org/api/zlib.html#zlib_zlib_createinflate_options
    // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    if (self.api.config.servers.web.compress === true) {
      if (acceptEncoding.match(/\bdeflate\b/)) {
        headers.push(['Content-Encoding', 'deflate']);
        compressor = _zlib2.default.createDeflate();
        stringEncoder = _zlib2.default.deflate;
      } else if (acceptEncoding.match(/\bgzip\b/)) {
        headers.push(['Content-Encoding', 'gzip']);
        compressor = _zlib2.default.createGzip();
        stringEncoder = _zlib2.default.gzip;
      }
    }

    // the 'finish' event deontes a successful transfer
    connection.rawConnection.res.on('finish', () => {
      connection.destroy();
    });

    // the 'close' event deontes a failed transfer, but it is probably the client's fault
    connection.rawConnection.res.on('close', () => {
      connection.destroy();
    });

    if (fileStream) {
      if (compressor) {
        connection.rawConnection.res.writeHead(responseHttpCode, headers);
        fileStream.pipe(compressor).pipe(connection.rawConnection.res);
      } else {
        headers.push(['Content-Length', fileLength]);
        connection.rawConnection.res.writeHead(responseHttpCode, headers);
        fileStream.pipe(connection.rawConnection.res);
      }
    } else {
      if (stringEncoder) {
        stringEncoder(stringResponse, (_, zippedString) => {
          headers.push(['Content-Length', zippedString.length]);
          connection.rawConnection.res.writeHead(responseHttpCode, headers);
          connection.rawConnection.res.end(zippedString);
        });
      } else {
        headers.push(['Content-Length', Buffer.byteLength(stringResponse)]);
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
  goodbye(connection) {}
  // disconnect handlers


  // --------------------------------------------------------------------------------------------------------- [PRIVATE]

  /**
   * Handle the requests.
   *
   * @param req   Request object.
   * @param res   Response object.
   * @private
   */
  _handleRequest(req, res) {
    let self = this;

    // get the client fingerprint
    const { fingerprint, headersHash } = this.fingerprinter.fingerprint(req);

    let responseHeaders = [];
    let cookies = this.api.utils.parseCookies(req);
    let responseHttpCode = 200;
    let method = req.method.toUpperCase();
    let parsedURL = _url2.default.parse(req.url, true);
    let i;

    // push all cookies from the request to the response
    for (i in headersHash) {
      responseHeaders.push([i, headersHash[i]]);
    }

    // set content type to JSON
    responseHeaders.push(['Content-Type', 'application/json; charset=utf-8']);

    // push all the default headers to the response object
    for (i in self.api.config.servers.web.httpHeaders) {
      responseHeaders.push([i, self.api.config.servers.web.httpHeaders[i]]);
    }

    // get the client IP
    let remoteIP = req.connection.remoteAddress;

    // get the client port
    let remotePort = req.connection.remotePort;

    // helpers for unix socket bindings with no forward
    if (!remoteIP && !remotePort) {
      remoteIP = '0.0.0.0';
      remotePort = '0';
    }

    if (req.headers['x-forwarded-for']) {
      let parts;
      let forwardedIp = req.headers['x-forwarded-for'].split(',')[0];
      if (forwardedIp.indexOf('.') >= 0 || forwardedIp.indexOf('.') < 0 && forwardedIp.indexOf(':') < 0) {
        // IPv4
        forwardedIp = forwardedIp.replace('::ffff:', ''); // remove any IPv6 information, ie: '::ffff:127.0.0.1'
        parts = forwardedIp.split(':');
        if (parts[0]) {
          remoteIP = parts[0];
        }
        if (parts[1]) {
          remotePort = parts[1];
        }
      } else {
        // IPv6
        parts = this.api.utils.parseIPv6URI(forwardedIp);
        if (parts.host) {
          remoteIP = parts.host;
        }
        if (parts.port) {
          remotePort = parts.port;
        }
      }

      if (req.headers['x-forwarded-port']) {
        remotePort = req.headers['x-forwarded-port'];
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
      id: `${fingerprint}-${_uuid2.default.v4()}`,
      fingerprint: fingerprint,
      remoteAddress: remoteIP,
      remotePort: remotePort
    });
  }

  /**
   * Change socket permission.
   *
   * @param bindIP  IP here socket is listening.
   * @param port    Port that socket is listening.
   */
  chmodSocket(bindIP, port) {
    if (!bindIP && port.indexOf('/') >= 0) {
      _fs2.default.chmodSync(port, 0o777);
    }
  }

  /**
   * Determine the request params.
   *
   * @param connection  Client connection object.
   * @param callback    Callback function.
   * @private
   */
  _determineRequestParams(connection, callback) {
    let self = this;

    // determine if is a file or an api request
    let requestMode = self.api.config.servers.web.rootEndpointType;
    let pathname = connection.rawConnection.parsedURL.pathname;
    let pathParts = pathname.split('/');
    let matcherLength, i;

    // remove empty parts from the beginning of the path
    while (pathParts[0] === '') {
      pathParts.shift();
    }

    // if exist an empty part on the end of the path, remove it
    if (pathParts[pathParts.length - 1] === '') {
      pathParts.pop();
    }

    if (pathParts[0] && pathParts[0] === self.api.config.servers.web.urlPathForActions) {
      requestMode = 'api';
      pathParts.shift();
    } else if (pathParts[0] && pathParts[0] === self.api.config.servers.websocket.clientJsName) {
      requestMode = 'client-lib';
      pathParts.shift();
    } else if (pathParts[0] && pathParts[0] === self.api.config.servers.web.urlPathForFiles) {
      requestMode = 'file';
      pathParts.shift();
    } else if (pathParts[0] && pathname.indexOf(self.api.config.servers.web.urlPathForActions) === 0) {
      requestMode = 'api';
      matcherLength = self.api.config.servers.web.urlPathForActions.split('/').length;
      for (i = 0; i < matcherLength - 1; i++) {
        pathParts.shift();
      }
    } else if (pathParts[0] && pathname.indexOf(self.api.config.servers.web.urlPathForFiles) === 0) {
      requestMode = 'file';
      matcherLength = self.api.config.servers.web.urlPathForFiles.split('/').length;
      for (i = 0; i < matcherLength - 1; i++) {
        pathParts.shift();
      }
    }

    // split parsed URL by '.'
    var extensionParts = connection.rawConnection.parsedURL.pathname.split('.');

    if (extensionParts.length > 1) {
      connection.extension = extensionParts[extensionParts.length - 1];
    }

    // OPTIONS
    if (connection.rawConnection.method === 'OPTIONS') {
      requestMode = 'options';
      callback(requestMode);
    } else if (requestMode === 'api') {
      // API
      // enable trace mode
      if (connection.rawConnection.method === 'TRACE') {
        requestMode = 'trace';
      }

      // Normalize `search` param to be a string even when there is
      // no search query set
      connection.rawConnection.parsedURL.search = typeof connection.rawConnection.parsedURL.search === 'string' ? connection.rawConnection.parsedURL.search : '';

      let search = connection.rawConnection.parsedURL.search.slice(1);
      self._fillParamsFromWebRequest(connection, _qs2.default.parse(search, self.api.config.servers.web.queryParseOptions));

      connection.rawConnection.params.query = connection.rawConnection.parsedURL.query;

      if (connection.rawConnection.method !== 'GET' && connection.rawConnection.method !== 'HEAD' && (connection.rawConnection.req.headers['content-type'] || connection.rawConnection.req.headers['Content-Type'])) {
        connection.rawConnection.form = new _stFormidable2.default.IncomingForm();

        for (i in self.api.config.servers.web.formOptions) {
          connection.rawConnection.form[i] = self.api.config.servers.web.formOptions[i];
        }

        connection.rawConnection.form.parse(connection.rawConnection.req, (error, fields, files) => {
          if (error) {
            self.log(`error processing form: ${String(error)}`, 'error');
            connection.error = new Error('There was an error processing this form.');
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
        connection.params.file = pathParts.join(_path2.default.sep);
      }

      if (connection.params.file === '' || connection.params.file[connection.params.file.length - 1] === '/') {
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
    let file = _path2.default.normalize(self.api.config.general.paths.public + _path2.default.sep + self.api.config.servers.websocket.clientJsName + '.js');

    // define the file to be loaded
    connection.params.file = file;

    // process like a file
    self.processFile(connection);
  }

  /**
   * Fill the connection with the web request params.
   *
   * @param connection  Connection object.
   * @param varsHash    Request params.
   * @private
   */
  _fillParamsFromWebRequest(connection, varsHash) {
    // helper for JSON parts
    let collapsedVarsHash = this.api.utils.collapseObjectToArray(varsHash);

    if (collapsedVarsHash !== false) {
      // post was an array, lets call it "payload"
      varsHash = { payload: collapsedVarsHash };
    }

    // copy requests params to connection object
    for (let v in varsHash) {
      connection.params[v] = varsHash[v];
    }
  }

  /**
   * Complete the response.
   *
   * THis add additional server info to the response message, and
   * build the final response object.
   *
   * @param data  Data to be sent to the client.
   * @private
   */
  _completeResponse(data) {
    if (data.toRender === true) {
      if (this.api.config.servers.web.metadataOptions.serverInformation) {
        let stopTime = new Date().getTime();

        data.response.serverInformation = {
          serverName: this.api.config.general.serverName,
          apiVersion: this.api.config.general.apiVersion,
          requestDuration: stopTime - data.connection.connectedAt,
          currentTime: stopTime
        };
      }
    }

    // check if is to use requester information
    if (this.api.config.servers.web.metadataOptions.requesterInformation) {
      data.response.requesterInformation = this._buildRequesterInformation(data.connection);
    }

    // is an error response?
    if (data.response.error) {
      if (this.api.config.servers.web.returnErrorCodes === true && data.connection.rawConnection.responseHttpCode === 200) {
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

    if (!data.response.error && data.action && data.params.apiVersion && this.api.actions.actions[data.params.action][data.params.apiVersion].matchExtensionMimeType === true && data.connection.extension) {
      data.connection.rawConnection.responseHeaders.push(['Content-Type', _mime2.default.getType(data.connection.extension)]);
    }

    // if its an error response we need to serialize the error object
    if (data.response.error) {
      data.response.error = this.api.config.errors.serializers.servers.web(data.response.error);
    }

    let stringResponse = '';

    // build the string response
    if (this._extractHeader(data.connection, 'Content-Type').match(/json/)) {
      try {
        stringResponse = JSON.stringify(data.response, null, this.api.config.servers.web.padding);
      } catch (_) {
        data.connection.rawConnection.responseHttpCode = 500;
        stringResponse = JSON.stringify({
          error: 'invalid_response_object',
          requesterInformation: this._buildRequesterInformation(data.connection)
        });
      }

      if (data.params.callback) {
        data.connection.rawConnection.responseHeaders.push(['Content-Type', 'application/javascript']);
        stringResponse = data.connection.params.callback + '(' + stringResponse + ');';
      }
    } else {
      stringResponse = data.response;
    }

    // return the response to the client
    this.sendMessage(data.connection, stringResponse);
  }

  /**
   * Extract one header from a connection object.
   *
   * @param connection  Connection object from the header must be extracted.
   * @param match       Header name.
   * @returns {*}       Null if not found, otherwise the header value.
   * @private
   */
  _extractHeader(connection, match) {
    let i = connection.rawConnection.responseHeaders.length - 1;

    while (i >= 0) {
      if (connection.rawConnection.responseHeaders[i][0].toLowerCase() === match.toLowerCase()) {
        return connection.rawConnection.responseHeaders[i][1];
      }
      i--;
    }

    return null;
  }

  /**
   * Build the requester information.
   *
   * @param connection
   * @returns {{id: number, fingerprint: (*|BrowserFingerprint.fingerprint|null), remoteIP: string, receivedParams: {}}}
   * @private
   */
  _buildRequesterInformation(connection) {
    // build the request information object
    let requesterInformation = {
      id: connection.id,
      fingerprint: connection.fingerprint,
      remoteIP: connection.remoteIP,
      receivedParams: {}

      // copy all the connection params to the request information
    };for (let param in connection.params) {
      requesterInformation.receivedParams[param] = connection.params[param];
    }

    // return the request information
    return requesterInformation;
  }

  /**
   * Remove some unnecessary headers from the response.
   *
   * @param connection  Client connection object.
   * @private
   */
  _cleanHeaders(connection) {
    // make a copy of the original headers
    let originalHeaders = connection.rawConnection.responseHeaders.reverse();
    let foundHeaders = [];
    let cleanedHeaders = [];

    // iterate all headers and remove duplications and unnecessary headers
    for (let i in originalHeaders) {
      // get header name and value
      let key = originalHeaders[i][0];
      let value = originalHeaders[i][1];

      if (foundHeaders.indexOf(key.toLowerCase()) >= 0 && key.toLowerCase().indexOf('set-cookie') < 0) {
        // ignore, it's a duplicate
      } else if (connection.rawConnection.method === 'HEAD' && key === 'Transfer-Encoding') {
        // ignore, we can't send this header for HEAD requests
      } else {
        foundHeaders.push(key.toLowerCase());
        cleanedHeaders.push([key, value]);
      }
    }

    // set the clean headers on the connection
    connection.rawConnection.responseHeaders = cleanedHeaders;
  }

  /**
   * Respond to an option request.
   *
   * @param connection  Connection object.
   * @private
   */
  _respondToOptions(connection = null) {
    let self = this;

    // inform the allowed methods
    if (!self.api.config.servers.web.httpHeaders['Access-Control-Allow-Methods'] && !self._extractHeader(connection, 'Access-Control-Allow-Methods')) {
      let methods = 'HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE';
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Methods', methods]);
    }

    // inform the allowed origins
    if (!self.api.config.servers.web.httpHeaders['Access-Control-Allow-Origin'] && !self._extractHeader(connection, 'Access-Control-Allow-Origin')) {
      var origin = '*';
      connection.rawConnection.responseHeaders.push(['Access-Control-Allow-Origin', origin]);
    }

    // send the message to client
    self.sendMessage(connection, '');
  }

  /**
   * Respond to a trace request.
   *
   * @param connection  Client connection object.
   * @private
   */
  _respondToTrace(connection) {
    let self = this;

    // build the request information
    let data = self._buildRequesterInformation(connection);

    // build the response string and send it to the client
    let stringResponse = JSON.stringify(data, null, self.api.config.servers.web.padding);
    self.sendMessage(connection, stringResponse);
  }

  /**
   * Try remove the stale unix socket.
   *
   * @param bindIP
   * @param port
   * @private
   */
  _cleanSocket(bindIP, port) {
    let self = this;

    if (!bindIP && port.indexOf('/') >= 0) {
      _fs2.default.unlink(port, error => {
        if (error) {
          self.log(`cannot remove stale socket @${port}:${error}`);
        } else {
          self.log(`removed stale unix socket @${port}`);
        }
      });
    }
  }
}
exports.default = Web;