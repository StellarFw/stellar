'use strict';

/**
 * Interface for WebSocket client interact with the server.
 *
 * @param opts    Connections parameters.
 * @param client  Client object (if exists).
 * @constructor
 */
var StellarClient = function StellarClient(opts, client) {
  var self = this;

  self.callbacks = {};
  self.id = null;
  self.events = {};
  self.rooms = [];
  self.state = 'disconnected';

  self.options = self.defaults() || {};

  // override default options
  for (var i in opts) {
    self.options[i] = opts[i];
  }

  if (client) {
    self.externalClient = true;
    self.client = client;
  }
};

if (typeof Primus === 'undefined') {
  var util = require('util');
  var EventEmitter = require('events').EventEmitter;
  util.inherits(StellarClient, EventEmitter);
} else {
  StellarClient.prototype = new Primus.EventEmitter();
}

StellarClient.prototype.defaults = function () {
  return '%%DEFAULTS%%';
};

StellarClient.prototype.connect = function (callback) {
  var self = this;
  self.messageCount = 0;

  if (self.client && self.externalClient !== true) {
    self.client.end();
    self.client.removeAllListeners();
    self.client = Primus.connect(self.options.url, self.options);
  } else if (self.client !== null && self.externalClient === true) {
    self.client.end();
    self.client.open();
  } else {
    self.client = Primus.connect(self.options.url, self.options);
  }

  /// define client event handlers

  // open
  self.client.on('open', function () {
    self.configure(function (details) {
      if (self.state !== 'connected') {
        self.state = 'connected';
        if (typeof callback === 'function') {
          callback(null, details);
        }
      }

      self.emit('connected');
    });
  });

  // error
  self.client.on('error', function (err) {
    self.emit('error', err);
  });

  // reconnect
  self.client.on('reconnect', function () {
    self.messageCount = 0;
    self.emit('reconnect');
  });

  // reconnecting
  self.client.on('reconnecting', function () {
    self.emit('reconnecting');
    self.state = 'reconnecting';
    self.emit('disconnected');
  });

  // timeout
  self.client.on('timeout', function () {
    self.state = 'timeout';
    self.emit('timeout');
  });

  // end
  self.client.on('end', function () {
    self.messageCount = 0;

    if (self.state !== 'disconnected') {
      self.state = 'disconnected';
      self.emit('disconnected');
    }
  });

  // data
  self.client.on('data', function (data) {
    self.handleMessage(data);
  });
};

StellarClient.prototype.configure = function (callback) {
  var self = this;

  self.rooms.forEach(function (room) {
    self.send({ event: 'roomAdd', room: room });
  });

  self.detailsView(function (details) {
    self.id = details.data.id;
    self.fingerprint = details.data.fingerprint;
    self.rooms = details.data.rooms;
    callback(details);
  });
};

// --------------------------------------------------------------------------------------------------------- [Messaging]

/**
 * Send a message.
 *
 * @param args
 * @param callback
 */
StellarClient.prototype.send = function (args, callback) {
  // primus will buffer messages when nor connected
  var self = this;
  self.messageCount++;

  if (typeof callback == 'function') {
    self.callbacks[self.messageCount] = callback;
  }

  self.client.write(args);
};

/**
 * Handle message.
 *
 * @param message
 */
StellarClient.prototype.handleMessage = function (message) {
  var self = this;

  self.emit('message', message);

  if (message.context === 'response') {
    if (typeof self.callbacks[message.messageCount] === 'function') {
      self.callbacks[message.messageCount](message);
    }

    delete self.callbacks[message.messageCount];
  } else if (message.context === 'user') {
    self.emit('say', message);
  } else if (message.context === 'alert') {
    self.emit('alert', message);
  } else if (message.welcome && message.context === 'api') {
    self.welcomeMessage = message.welcome;
    self.emit('welcome', message);
  } else if (message.context === 'api') {
    self.emit('api', message);
  }
};

// ----------------------------------------------------------------------------------------------------------- [Actions]

/**
 * Call an action.
 *
 * If this client instance are connected use WebSocket, otherwise use a normal
 * HTTP request. This makes possible call actions as soon as the web app is
 * loaded.
 *
 * @param action   Name of the action to be called.
 * @param params   Action parameters.
 * @param callback Function who will be called when we receive the response.
 */
StellarClient.prototype.action = function (action) {
  var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
  var callback = arguments[2];

  var self = this;

  if (!callback && typeof params === 'function') {
    callback = params;
    params = null;
  }

  // define params to be a Map if it is null
  if (!params) {
    params = {};
  }

  // sets the parameter action, in case of the action call be done over HTTP.
  params.action = action;

  // if the client is connected the connection should be done by WebSocket
  // otherwise we need to use HTTP
  if (self.state !== 'connected') {
    self._actionWeb(params, callback);
  } else {
    self._actionWebSocket(params, callback);
  }
};

/**
 * Call a action using a normal HTTP connection.
 *
 * @param params    Call parameters.
 * @param callback  Function to be executed after the response be received.
 * @private
 */
StellarClient.prototype._actionWeb = function (params, callback) {
  var self = this;

  // create a new XMLHttpRequest instance
  var xmlhttp = new XMLHttpRequest();

  // define the action to be executed at the end of the request
  xmlhttp.onreadystatechange = function () {
    var response = void 0;

    // the response only are received if the readyState is equals to 4
    if (xmlhttp.readyState === 4) {

      // if the HTTP status code is equals to 200 make a JSON parser.
      // in case of the request code be different of 200 we try make
      // a JSON parser too, but it can fail so we catch the exception
      // and we make our own error message
      if (xmlhttp.status === 200) {
        response = JSON.parse(xmlhttp.responseText);
      } else {
        try {
          response = JSON.parse(xmlhttp.responseText);
        } catch (e) {
          response = { error: { statusText: xmlhttp.statusText, responseText: xmlhttp.responseText } };
        }
      }

      // execute the callback function
      callback(response);
    }
  };

  // define the HTTP method to be used (by default we use POST)
  var method = (params.httpMethod || 'POST').toUpperCase();

  // define the URL to be called and append the action on the query params
  var url = self.options.url + self.options.apiPath + '?action=' + params.action;

  if (method === 'GET') {
    for (var param in params) {
      if (~['action', 'httpMethod'].indexOf(param)) {
        continue;
      }
      url += '&' + param + '=' + params[param];
    }
  }

  // open a new connection
  xmlhttp.open(method, url, true);

  // det the content type to JSON
  xmlhttp.setRequestHeader('Content-Type', 'application/json');

  // send the request
  xmlhttp.send(JSON.stringify(params));
};

/**
 * Send an action call request by WebSocket.
 *
 * @param params    Call parameters.
 * @param callback  Function to be executed at the end do the request.
 * @private
 */
StellarClient.prototype._actionWebSocket = function (params, callback) {
  var self = this;
  self.send({ event: 'action', params: params }, callback);
};

// ---------------------------------------------------------------------------------------------------------- [Commands]

/**
 * Send a message to a room.
 *
 * @param room      Room name.
 * @param message   Message to be sent.
 * @param callback  Function to be executed to receive the server response.
 */
StellarClient.prototype.say = function (room, message, callback) {
  this.send({ event: 'say', room: room, message: message }, callback);
};

/**
 * Make a file request.
 *
 * @param file      File to be requested.
 * @param callback  Function to be executed to receive the server response.
 */
StellarClient.prototype.file = function (file, callback) {
  this.send({ event: 'file', file: file }, callback);
};

/**
 * Request the details view.
 *
 * @param callback  Function to be executed when the server respond.
 */
StellarClient.prototype.detailsView = function (callback) {
  this.send({ event: 'detailsView' }, callback);
};

/**
 * Request a room state.
 *
 * @param room      Room name.
 * @param callback  Function to be executed to receive the server response.
 */
StellarClient.prototype.roomView = function (room, callback) {
  var self = this;
  self.send({ event: 'roomView', room: room }, callback);
};

/**
 * Create a new room.
 *
 * @param room      Name for the room to be created.
 * @param callback  Function to be executed to receive the server response.
 */
StellarClient.prototype.roomAdd = function (room, callback) {
  var self = this;

  self.send({ event: 'roomAdd', room: room }, function (data) {
    self.configure(function () {
      if (typeof callback === 'function') {
        callback(data);
      }
    });
  });
};

/**
 * Leave a room.
 *
 * @param room      Name the to leave.
 * @param callback  Function to be executed to receive the server response.
 */
StellarClient.prototype.roomLeave = function (room, callback) {
  var self = this;

  // get the position of the room on the client rooms list
  var index = self.rooms.indexOf(room);

  // remove the room from the client room list
  if (index > -1) {
    self.rooms.splice(index, 1);
  }

  // make a server request to remove the client from the room
  self.send({ event: 'roomLeave', room: room }, function (data) {
    self.configure(function () {
      if (typeof callback === 'function') {
        callback(data);
      }
    });
  });
};

/**
 * Disconnect client from the server.
 */
StellarClient.prototype.disconnect = function () {
  var self = this;

  // change the connection state to disconnected
  self.state = 'disconnected';

  // finish the connection between the client and the server
  self.client.end();

  // emit the 'disconnected' event
  self.emit('disconnected');
};

exports.StellarClient = StellarClient;
//# sourceMappingURL=client.js.map
