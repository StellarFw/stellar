'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * This class allow developers testes values against a
 * set of validators.
 *
 * This is used by the ActionProcessor to validator the
 * action input params.
 *
 * You can use this manually like this:
 *
 * <code>
 *   api.validator.validate(validatorString, params, keyToValidate)
 * </code>
 */

var Validator = function () {

  /**
   * Create a new Validator instance.
   *
   * @param api API reference object.
   */


  /**
   * Request parameters.
   *
   * @type {{}}
   */

  function Validator(api) {
    _classCallCheck(this, Validator);

    this.api = null;
    this.params = {};
    this.api = api;
  }

  /**
   * Validate a set of parameters using a validator string.
   *
   *
   * @param validatorString   Validator string
   * @param params            Set of params.
   * @param key               Param under validation.
   * @returns {*}             Validator response. True if it's okay
   */


  /**
   * Array with the implicit validators.
   *
   * @type {string[]}
   */


  /**
   * API reference object.
   *
   * @type {null}
   */


  _createClass(Validator, [{
    key: 'validate',
    value: function validate(validatorString, params, key) {
      var self = this;

      // the key must be present, otherwise return an error string
      if (key === undefined || key === null || key === '') {
        return 'a key must be specified';
      }

      // save parameters request parameters
      self.params = params;

      // gets the value of the parameter to be validated
      var value = params[key];

      // the validator string can have many validators separated by '|', we need to split them
      var validators = validatorString.split('|');

      // save the validator response
      var validatorResponse = void 0;

      // iterate all validators and execute them
      for (var index in validators) {
        // split by ':' to get the validator arguments
        var validatorParts = validators[index].split(':');

        // if the property has undefined only implicit validators can be applied
        if (value === undefined && Validator.implicitValidators.indexOf(validatorParts[0]) === -1) {
          continue;
        }

        // call the validator
        validatorResponse = self.execValidator(validatorParts[0], validatorParts[1], value, key);

        // if the response is a string that means we found a invalid validator
        if (typeof validatorResponse === 'string') {
          break;
        }

        // if the validator fails return a fail message
        if (validatorResponse === false) {
          validatorResponse = 'don\'t match with the validator';
          break;
        }
      }

      // clean the parameters property
      self.params = {};

      return validatorResponse;
    }

    /**
     * Execute the request validator and apply it to the passed value.
     *
     * @param validator   Validator name.
     * @param args        Validator arguments.
     * @param value       Value to be validated.
     * @param key         Parameter key name.
     * @returns {*}
     */

  }, {
    key: 'execValidator',
    value: function execValidator(validator, args, value, key) {
      // call the validator function
      var funcName = 'validator_' + validator;

      // check if the validator exists
      if (this[funcName] === undefined) {
        return 'invalid validator';
      }

      // split the arguments by ',' if exists
      if (args !== undefined) {
        args = args.split(',');
      }

      // call the validator function
      return this[funcName](value, args, key);
    }

    // ------------------------------------------------------------------------------------------------------ [Validators]

    /**
     * Check if the value is a string only with alpha characters.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_alpha',
    value: function validator_alpha(value) {
      return (/^[a-zA-Z]*$/.test(value)
      );
    }

    /**
     * Check if the value is a number.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_alpha_num',
    value: function validator_alpha_num(value) {
      return (/^[a-zA-Z0-9]*$/.test(value)
      );
    }

    /**
     * Check if the value is a string only with alpha or (_, -) characters.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_alpha_dash',
    value: function validator_alpha_dash(value) {
      return (/^[a-zA-Z0-9-_]*$/.test(value)
      );
    }

    /**
     * Check if the value is an array.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_array',
    value: function validator_array(value) {
      return Array.isArray(value);
    }

    /**
     * Check if the value is before than the specified date.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_before',
    value: function validator_before(value, args) {
      // check if the developer specify an argument
      if (args === undefined) {
        return 'you need to specify an argument';
      }

      // check if the argument is a date
      if (isNaN(Date.parse(args))) {
        return 'the specified argument is not a valid date';
      }

      // check if the value if a date
      if (isNaN(Date.parse(value))) {
        return 'the specified value is not a valid date';
      }

      // check if the specified date is less than the required date
      return Date.parse(value) < Date.parse(args);
    }

    /**
     * Check if the value is between the two intervals.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_between',
    value: function validator_between(value, args) {
      // check if the developer specify the valid number of arguments
      if (!Array.isArray(args) || args.length !== 2) {
        return 'invalid validator arguments';
      }

      // check if the value is valid
      if (typeof value === 'string') {
        return value.length >= args[0] && value.length <= args[1];
      } else if (typeof value === 'number') {
        return value >= args[0] && value <= args[1];
      } else {
        return 'invalid data type';
      }
    }

    /**
     * Check if the value is a boolean.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_boolean',
    value: function validator_boolean(value) {
      return typeof value === 'boolean';
    }

    /**
     * Check if exists a confirmation fields to the testing key with the same name.
     *
     * @param value
     * @param args
     * @param key
     * @returns {*}
     */

  }, {
    key: 'validator_confirmed',
    value: function validator_confirmed(value, args, key) {
      // build the confirmation field name
      var confirmationFieldName = key + '_confirmation';

      // check if the confirmation field are not present
      if (this.params[confirmationFieldName] === undefined) {
        return 'the confirmation field are not present';
      }

      // check if the values of two fields match
      if (this.params[confirmationFieldName] !== value) {
        return 'the values not match';
      }

      return true;
    }

    /**
     * Check if the param is a date.
     *
     * @param value
     * @returns {*}
     */

  }, {
    key: 'validator_date',
    value: function validator_date(value) {
      if (isNaN(Date.parse(value))) {
        return 'the specified value is not a valid date';
      }
      return true;
    }

    /**
     * Check if the value is different of the other field.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_different',
    value: function validator_different(value, args) {
      // check if the validator has the correct parameter number
      if (args === undefined) {
        return 'the validator need one argument';
      }

      return value !== this.params[args];
    }

    /**
     * Check if the value is an email.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_email',
    value: function validator_email(value) {
      return (/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(value)
      );
    }

    /**
     * Check if the value is filled.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_filled',
    value: function validator_filled(value) {
      return value !== undefined && value !== null && value !== '';
    }

    /**
     * Check if the value are included in the array.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_in',
    value: function validator_in(value, args) {
      // check if the validator have a name
      if (args === undefined && !Array.isArray(args)) {
        return 'validator needs an array';
      }

      // check if the array contains the value
      return args.indexOf(String(value)) > -1;
    }

    /**
     * Check if the value are not included in the array.
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_not_in',
    value: function validator_not_in(value, args) {
      // check if the validator have a name
      if (args === undefined && !Array.isArray(args)) {
        return 'validator needs an array';
      }

      // check if the array not contains the value
      return args.indexOf(String(value)) === -1;
    }

    /**
     * Check if the value is an integer.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_integer',
    value: function validator_integer(value) {
      // try parse to pin
      var parsedValue = Number.parseInt(value);

      // check if is a number
      return Number.isInteger(parsedValue);
    }

    /**
     * Check if the value is an IP.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_ip',
    value: function validator_ip(value) {
      return (/^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(value)
      );
    }

    /**
     * Check if the field is a valid JSON.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_json',
    value: function validator_json(value) {
      try {
        var o = JSON.parse(value);

        if (o && (typeof o === 'undefined' ? 'undefined' : _typeof(o)) === "object" && o !== null) {
          return true;
        }
      } catch (e) {}

      return false;
    }

    /**
     * Check if the parameter match with a max value.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_max',
    value: function validator_max(value, args) {
      // the validator needs one argument
      if (args === undefined) {
        return 'validator need at least one argument';
      }

      if (typeof value === 'string' || value instanceof Array) {
        return value.length <= args[0];
      } else if (typeof value === 'number') {
        return value <= args[0];
      } else {
        return 'invalid type';
      }
    }

    /**
     * Check if the parameter match with a min value.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_min',
    value: function validator_min(value, args) {
      // the validator needs one argument
      if (args === undefined) {
        return 'validator need at least one argument';
      }

      if (typeof value === 'string' || value instanceof Array) {
        return value.length >= args[0];
      } else if (typeof value === 'number') {
        return value >= args[0];
      } else {
        return 'invalid type';
      }
    }

    /**
     * Check if the value exists.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_required',
    value: function validator_required(value) {
      return value !== undefined;
    }

    /**
     * Check if the value is numeric.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_numeric',
    value: function validator_numeric(value) {
      return typeof value === 'number';
    }

    /**
     * Check if the field is required taking into account
     * the parameters.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_required_if',
    value: function validator_required_if(value, args) {
      // check if we have the needs arguments
      if (!(args instanceof Array) || args.length < 2) {
        return 'validator need two arguments';
      }

      // get the parameter to test
      var parameterToCheck = args.shift();

      // if the args[0] param value is present in the values array the value is required
      if (args.indexOf(String(this.params[parameterToCheck])) > -1) {
        return this.validator_filled(value);
      }

      return true;
    }

    /**
     * The field under validation must be present unless
     * the args[0] is equal to any value.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_required_unless',
    value: function validator_required_unless(value, args) {
      // check if we have the needs arguments
      if (!(args instanceof Array) || args.length < 2) {
        return 'validator need two arguments';
      }

      // get the parameter to test
      var parameterToCheck = args.shift();

      // if the parameter not have a valid value the current parameter is required
      if (args.indexOf(String(this.params[parameterToCheck])) === -1) {
        return this.validator_filled(value);
      }

      return true;
    }

    /**
     * The field under validation must be present only if
     * any of the other specified fields are present.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_required_with',
    value: function validator_required_with(value, args) {
      // check if we have the needs arguments
      if (!(args instanceof Array) || args.length < 2) {
        return 'validator need two arguments';
      }

      // check if one of the parameters are present
      for (var index in args) {
        // get parameter name
        var paramName = args[index];

        // check if the value is filled
        if (this.params[paramName] !== undefined) {
          return this.validator_filled(value);
        }
      }

      return true;
    }

    /**
     * The field under validation must be present only if
     * all of the other specified fields are present.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_required_with_all',
    value: function validator_required_with_all(value, args) {
      // check if we have the needs arguments
      if (!(args instanceof Array) || args.length < 2) {
        return 'validator need two arguments';
      }

      // check if all the parameters are present
      for (var index in args) {
        // get parameter name
        var paramName = args[index];

        if (this.params[paramName] === undefined) {
          return true;
        }
      }

      // if all the fields are present the fields under validation is required
      return this.validator_filled(value);
    }

    /**
     * The field under validation must be present only when
     * any of the other specified fields are not present.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_required_without',
    value: function validator_required_without(value, args) {
      // check if we have the needs arguments
      if (!(args instanceof Array) || args.length < 2) {
        return 'validator need two arguments';
      }

      // if one of the fields are not present the field under validation is required
      for (var index in args) {
        // get parameter name
        var paramName = args[index];

        if (this.params[paramName] === undefined) {
          return this.validator_filled(value);
        }
      }

      return true;
    }

    /**
     * The field under validation must be present only when
     * all of the other specified fields are not present.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_required_without_all',
    value: function validator_required_without_all(value, args) {
      // check if we have the needs arguments
      if (!(args instanceof Array) || args.length < 2) {
        return 'validator need two arguments';
      }

      for (var index in args) {
        // get parameter name
        var paramName = args[index];

        // if one of the fields are not present we can stop right here
        if (this.params[paramName] !== undefined) {
          return true;
        }
      }

      return this.validator_filled(value);
    }

    /**
     * The given field must match the field under validation.
     *
     * @param value
     * @param args
     * @returns {*}
     */

  }, {
    key: 'validator_same',
    value: function validator_same(value, args) {
      // check if we have the needs arguments
      if (!(args instanceof Array) || args.length < 1) {
        return 'validator need one argument';
      }

      return this.params[args[0]] === value;
    }

    /**
     * The field under validation must have a size matching the given value.
     *
     * @param value
     * @param args
     */

  }, {
    key: 'validator_size',
    value: function validator_size(value, args) {
      // check if we have the needs arguments
      if (!(args instanceof Array) || isNaN(args[0])) {
        return 'validator need one numeric argument';
      }

      if (typeof value === 'string' || value instanceof Array) {
        return value.length == args[0];
      } else if (typeof value === 'number') {
        return value == args[0];
      } else {
        return 'invalid type';
      }
    }

    /**
     * The field under validation must be a valid URL.
     *
     * @param value
     * @returns {boolean}
     */

  }, {
    key: 'validator_url',
    value: function validator_url(value) {
      return (/^(http|ftp|https):\/\/[\w-]+(\.[\w-]*)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?$/.test(value)
      );
    }
  }]);

  return Validator;
}();

/**
 * Validator satellite.
 */


Validator.implicitValidators = ['required_if', 'required', 'required_unless', 'filled', 'required_with', 'required_with_all', 'required_without', 'required_without_all'];

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 400;
  }

  /**
   * Satellite priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Satellite load function.
     *
     * @param api   API reference object.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // load validator logic into the API object
      api.validator = new Validator(api);

      // finish the load process
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=validator.js.map
