'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Class to manage events.
 *
 * The developers can use this to manipulate data during the
 * execution or to extend functionalities adding new behaviours
 * to existing logic. The listeners must be stored in
 * <moduleName>/listeners.
 */

var EventsManager = function () {

  /**
   * Create a new instance.
   *
   * @param api   API reference object.
   */


  /**
   * API reference object.
   *
   * @type {null}
   */

  function EventsManager(api) {
    _classCallCheck(this, EventsManager);

    this.api = null;
    this.events = new Map();
    this.api = api;
  }

  // -------------------------------------------------------------------------------------------------------- [Commands]

  /**
   * Fire an event.
   *
   * @param eventName   Event to fire.
   * @param data        Params to pass to the listeners.
   * @param callback    Callback function.
   */


  /**
   * Map with all registered events and listeners.
   *
   * @type {Map}
   */


  _createClass(EventsManager, [{
    key: 'fire',
    value: function fire(eventName, data) {
      var callback = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

      var self = this;

      // variable to store listener response data
      var responseData = data;

      // check if exists listeners for this event
      if (self.events.has(eventName)) {
        // execute the listeners async in series
        _async2.default.each(self.events.get(eventName), function (listener, callback) {
          return listener.run(self.api, responseData, callback);
        }, function () {
          // execute the callback function
          if (typeof callback === 'function') {
            return callback(responseData);
          }
        });

        return;
      }

      // execute the callback function
      if (typeof callback === 'function') {
        return callback(responseData);
      }
    }

    /**
     * Register a new listener for an event.
     *
     * Build the new listener object.
     *
     * @param event     Event name.
     * @param fn        Listener handler.
     * @param priority  Priority.
     */

  }, {
    key: 'listener',
    value: function listener(event, fn, priority) {
      var self = this;

      // build a listener object
      var listener = {
        event: event,
        run: fn,
        priority: priority
      };

      // insert the listener
      self._listenerObj(listener);
    }

    /**
     * Insert the listener object into the Map.
     *
     * The error messages are logged to the console, like warnings.
     *
     * @param listenerObj   Listener object.
     * @return boolean      True if is all okay, false otherwise.
     */

  }, {
    key: '_listenerObj',
    value: function _listenerObj(listenerObj) {
      var self = this;

      // validate event name
      if (listenerObj.event === undefined) {
        self.api.log('invalid listener - missing event name', 'warning');
        return false;
      }

      // validate run
      if (listenerObj.run === undefined || typeof listenerObj.run !== 'function') {
        self.api.log('invalid listener - missing run property or not a function', 'warning');
        return false;
      }

      // if priority are not defined
      if (listenerObj.priority === undefined) {
        listenerObj.priority = self.api.config.general.defaultListenerPriority;
      }

      // if there is no listener for this event, create a new entry
      // with an empty array
      if (!self.events.has(listenerObj.event)) {
        self.events.set(listenerObj.event, []);
      }

      // get the array with all registered listeners for this event
      var listeners = self.events.get(listenerObj.event);

      // register the new listener
      listeners.push(listenerObj);

      // order the listeners by priority
      listeners.sort(function (l1, l2) {
        return l1.priority - l2.priority;
      });

      return true;
    }

    // --------------------------------------------------------------------------------------------------- [Other Methods]

    /**
     * Iterate over all active modules and
     *
     * @param next
     */

  }, {
    key: 'loadListeners',
    value: function loadListeners(next) {
      var self = this;

      // iterate all active modules
      self.api.modules.modulesPaths.forEach(function (modulePath) {
        // build path for the module listeners folder
        var listenersFolderPath = modulePath + '/listeners';

        // check if the listeners
        if (!_utils2.default.directoryExists(listenersFolderPath)) {
          return;
        }

        // get all listeners files
        _utils2.default.recursiveDirectoryGlob(listenersFolderPath, 'js').forEach(function (listenerPath) {
          // require listener file
          var collection = require(listenerPath);

          for (var i in collection) {
            // get action object
            var listener = collection[i];

            // insert the listener on the map
            self._listenerObj(listener);
          }
        });
      });

      // end listeners loading
      next();
    }
  }]);

  return EventsManager;
}();

/**
 * Satellite to load the event manager.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 300;
  }

  /**
   * Satellite load priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Satellite loading function.
     *
     * @param api   API reference object.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // make events api available in all platform
      api.events = new EventsManager(api);

      // load listeners
      api.events.loadListeners(next);
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=events.js.map
