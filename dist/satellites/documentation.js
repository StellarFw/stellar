'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

var _handlebars = require('handlebars');

var _handlebars2 = _interopRequireDefault(_handlebars);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DocumentationGenerator = function () {

  /**
   * Constructor.
   *
   * @param api
   */


  /**
   * Docs folder path.
   *
   * @type {string}
   */

  function DocumentationGenerator(api) {
    _classCallCheck(this, DocumentationGenerator);

    this.api = null;
    this.docsFolder = '';
    this.staticFolder = '';

    var self = this;

    // save API reference object
    self.api = api;

    // unsure the public folder exists
    _utils2.default.createFolder(self.api.config.general.paths.public);

    // build docs folder path
    self.docsFolder = self.api.config.general.paths.public + '/docs';

    // build static folder path
    self.staticFolder = __dirname + '/../../staticFiles/docs';
  }

  /**
   * Get all actions who have toDocument different than false.
   *
   * @returns {{}}  Actions to generate documentation.
   * @private
   */


  /**
   * Static folder path.
   *
   * @type {string}
   */


  /**
   * API reference object.
   *
   * @type {null}
   */


  _createClass(DocumentationGenerator, [{
    key: '_getActionToGenerateDoc',
    value: function _getActionToGenerateDoc() {
      var self = this;

      // array to store the actions
      var actions = {};

      // iterate all actions
      for (var actionName in self.api.actions.actions) {
        var count = 0;

        actions[actionName] = {};

        // iterate all action versions
        for (var versionNumber in self.api.actions.actions[actionName]) {
          if (self.api.actions.actions[actionName][versionNumber].toDocument !== false) {
            count++;
            actions[actionName][versionNumber] = self.api.actions.actions[actionName][versionNumber];
          }
        }

        if (count === 0) {
          delete actions[actionName];
        }
      }

      return actions;
    }

    /**
     * Generate the documentation.
     */

  }, {
    key: 'generateDocumentation',
    value: function generateDocumentation() {
      var self = this;

      // remove docs directory
      _utils2.default.removeDirectory(self.docsFolder);

      // create the directory again
      _utils2.default.createFolder(self.docsFolder);

      // get actions to generate documentation
      var actions = self._getActionToGenerateDoc();

      // object with the template data
      var data = { actions: Object.keys(actions) };

      // get base template
      var source = _fs2.default.readFileSync(self.staticFolder + '/action.html').toString();

      // iterate all loaded actions
      for (var actionName in actions) {
        // set action name
        data.actionName = actionName;

        // initialize array
        data.actionVersions = [];

        // iterate all versions
        for (var versionNumber in actions[actionName]) {
          // get action object
          var action = self._prepareActionToPrint(actions[actionName][versionNumber]);

          // push the version number
          action.version = versionNumber;

          // push the new action to the actionVersions array
          data.actionVersions.push(action);
        }

        // build the template
        var template = _handlebars2.default.compile(source);

        // output the result to the temp folder
        _fs2.default.writeFileSync(self.docsFolder + '/action_' + actionName + '.html', template(data), 'utf8');
      }

      // build the index.html
      self._buildIndexFile();

      // copy resource files
      this._copyResourceFiles();
    }

    /**
     * Build the index.html file.
     *
     * @private
     */

  }, {
    key: '_buildIndexFile',
    value: function _buildIndexFile() {
      var self = this;

      // build data object
      var data = {
        actions: Object.keys(self._getActionToGenerateDoc()),
        project: {}
      };
      data.project.name = self.api.config.name;
      data.project.description = self.api.config.description;
      data.project.version = self.api.config.version;

      // get template source
      var source = _fs2.default.readFileSync(self.staticFolder + '/index.html').toString();

      // compile source
      var template = _handlebars2.default.compile(source);

      // save index.html file on final docs folder
      _fs2.default.writeFileSync(self.docsFolder + '/index.html', template(data), 'utf8');
    }

    /**
     * Prepare the action to be printed.
     *
     * @param action
     * @returns {{}}
     * @private
     */

  }, {
    key: '_prepareActionToPrint',
    value: function _prepareActionToPrint(action) {
      // create a new object with the data prepared to be printed
      var output = {};

      // action name
      output.name = action.name;

      // action description
      output.description = action.description;

      // action output example
      if (action.outputExample !== undefined) {
        output.outputExample = JSON.stringify(action.outputExample, null, 4);
      }

      // action inputs
      if (action.inputs !== undefined) {
        output.inputs = [];

        // iterate all inputs
        Object.keys(action.inputs).forEach(function (inputName) {
          var newInput = {};
          var input = action.inputs[inputName];

          newInput.name = inputName;
          newInput.description = input.description || 'N/A';
          newInput.default = input.default || 'N/A';

          newInput.validators = [];

          if (!(input.required === undefined || input.required === false)) {
            newInput.validators.push({ type: 'required', value: 'required' });
          }

          // validators
          if (typeof input.validator === 'function') {
            newInput.validators.push({ type: 'function', value: 'function' });
          } else if (input.validator instanceof RegExp) {
            newInput.validators.push({ type: 'regex', value: String(input.validator) });
          } else if (typeof input.validator === 'string') {
            // the validator string can have many validators separated by '|', we need to split them
            var validators = input.validator.split('|');

            for (var index in validators) {
              newInput.validators.push({ type: 'validator', value: validators[index] });
            }
          }

          // push the new input
          output.inputs.push(newInput);
        });
      }

      return output;
    }

    /**
     * Copy resource files to final docs folder.
     *
     * @private
     */

  }, {
    key: '_copyResourceFiles',
    value: function _copyResourceFiles() {
      var self = this;
      _utils2.default.copyFile(self.staticFolder + '/reset.css', self.docsFolder + '/reset.css');
      _utils2.default.copyFile(self.staticFolder + '/style.css', self.docsFolder + '/style.css');
      _utils2.default.copyFile(self.staticFolder + '/highlight.js', self.docsFolder + '/highlight.js');
    }
  }]);

  return DocumentationGenerator;
}();

/**
 * This satellite is responsible to generate the documentation
 * for all project actions.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 510;
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
      // if the documentation generation was disabled finish now
      if (api.config.general.generateDocumentation !== true) {
        next();
        return;
      }

      // build the documentation
      new DocumentationGenerator(api).generateDocumentation();

      // finish the satellite loading
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=documentation.js.map
