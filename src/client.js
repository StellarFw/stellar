var StellarClient = function (opts, client) {
  var self = this;

  self.callbacks = {};
  self.id = null;
  self.events = {};
  self.rooms = [];
  self.state = 'disconnected';

  self.options = self.defaults() || {};

  // override default options
  for (var i in opts) {
    self.options[ i ] = opts[ i ];
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
  self.client.on('open', () => {
    self.configure((details) => {
      if (self.state !== 'connected') {
        self.state = 'connected';
        if (typeof  callback === 'function') {
          callback(null, details);
        }
      }

      self.emit('connected');
    });
  });

  // error
  self.client.on('error', (err) => {
    self.emit('error', err);
  });

  // reconnect
  self.client.on('reconnect', () => {
    self.messageCount = 0;
    self.emit('reconnect');
  });

  // reconnecting
  self.client.on('reconnecting', () => {
    self.emit('reconnecting');
    self.state = 'reconnecting';
    self.emit('disconnected');
  });

  // timeout
  self.client.on('timeout', () => {
    self.state = 'timeout';
    self.emit('timeout');
  });

  // end
  self.client.on('end', () => {
    self.messageCount = 0;

    if (self.state !== 'disconnected') {
      self.state = 'disconnected';
      self.emit('disconnected');
    }
  });

  // data
  self.client.on('data', (data) => {
    self.handleMessage(data);
  });

};

StellarClient.prototype.configure = function (callback) {
  var self = this;

  self.rooms.forEach((room) => {
    self.send({event: 'roomAdd', room: room});
  });

  self.detailsView((details) => {
    self.id = details.data.id;
    self.fingerprint = details.data.fingerprint;
    self.rooms = details.data.rooms;
    callback(details);
  });
};

// ---------------------------------------------------------------------------------------------------------- [Messages]

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
    self.callbacks[ self.messageCount ] = callback;
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
    if (typeof self.callbacks[ message.messageCount ] === 'function') {
      self.callbacks[ message.messageCount ](message);
    }

    delete self.callbacks[ message.messageCount ];
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
 * @param action   name of the action to be called.
 * @param params
 * @param callback function who will be called when we receive the response.
 */
StellarClient.prototype.action = function (action, params, callback) {
  let self = this;

  if (!callback && typeof params === 'function') {
    callback = params;
    params = null;
  }

  if (!params) {
    params = {};
  }
  params.action = action;

  if (self.state !== 'connected') {
    self.actionWeb(params, callback);
  } else {
    self.actionWebSocket(params, callback);
  }
};

StellarClient.prototype.actionWeb = function (params, callback) {
  let self = this;
  var xmlhttp = new XMLHttpRequest();

  xmlhttp.onreadystatechange = function () {
    var response;
    if (xmlhttp.readyState === 4) {
      if (xmlhttp.status === 200) {
        response = JSON.parse(xmlhttp.responseText);
      } else {
        try {
          response = JSON.parse(xmlhttp.responseText);
        } catch (e) {
          response = {error: {statusText: xmlhttp.statusText, responseText: xmlhttp.responseText}};
        }
      }

      callback(response);
    }
  };

  let method = (params.httpMethod || 'POST').toUpperCase();
  let url = self.options.url + self.options.apiPath + '?action=' + params.action;

  if (method === 'GET') {
    for (let param in params) {
      if (~[ 'action', 'httpMethod' ].indexOf(param)) {
        continue;
      }
      url += `&${param}=${params[ param ]}`;
    }
  }

  xmlhttp.open(method, url, true);
  xmlhttp.setRequestHeader('Content-Type', 'application/json');
  xmlhttp.send(JSON.stringify(params));
};

StellarClient.prototype.actionWebSocket = function (params, callback) {
  this.send({event: 'action', params: params}, callback);
};

// ---------------------------------------------------------------------------------------------------------- [Commands]

/**
 * Send a message to a room.
 *
 * @param room
 * @param message
 * @param callback
 */
StellarClient.prototype.say = function (room, message, callback) {
  this.send({event: 'say', room: room, message: message}, callback);
};

/**
 * Request a file.
 *
 * @param file
 * @param callback
 */
StellarClient.prototype.file = function (file, callback) {
  this.send({event: 'file', file: file}, callback);
};

/**
 * Request the details view.
 */
StellarClient.prototype.detailsView = function (callback) {
  this.send({event: 'detailsView'}, callback);
};

StellarClient.prototype.roomView = function (callback) {
  this.send({event: 'roomView', room: room}, callback);
};

StellarClient.prototype.roomAdd = function (room, callback) {
  var self = this;
  self.send({event: 'roomAdd', room: room}, function (data) {
    self.configure(function () {
      if (typeof callback === 'function') {
        callback(data);
      }
    });
  });
};

StellarClient.prototype.roomLeave = function (room, callback) {
  var self = this;
  var index = self.rooms.indexOf(room);
  if (index > -1) {
    self.rooms.splice(index, 1);
  }
  this.send({event: 'roomLeave', room: room}, function (data) {
    self.configure(function () {
      if (typeof callback === 'function') {
        callback(data);
      }
    });
  });
};

StellarClient.prototype.disconnect = function () {
  this.state = 'disconnected';
  this.client.end();
  this.emit('disconnected');
};
