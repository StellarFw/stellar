module.exports = [{
    name: 'input-require',
    description: 'Test input require property',
    inputs: {
        'value': {
            required: true
        }
    },
    run: function (engine, data, next) {
        data.response.string = "Input > " + data.params.value;
        next();
    }
}, {
    name: 'input-default',
    description: 'Test input default value',
    inputs: {
        'value': {
            default: 'DefaultVal'
        }
    },
    run: function(engine, data, next) {
        data.response.string = "Input > " + data.params.value;
        next();
    }
}, {
    name: 'input-validator-regex',
    description: 'Test input string validator',
    inputs: {
        'value': {
            validator: /^\d{3}$/
        }
    },
    run: function(engine, data, next) {
        data.response.string = "Input > " + data.params.value;
        next();
    }
}, {
    name: 'input-validator-function',
    description: 'Test input function validator',
    inputs: {
        'value': {
            validator: function (param) {
                return param === 'asd';
            }
        }
    },
    run: function(engine, data, next) {
        data.response.string = "Input > " + data.params.value;
        next();
    }
}, {
    name: 'input-validator-predef-alpha',
    description: 'Test pre-defined validator alpha',
    inputs: {
        'value': {
            validator: 'alpha'
        }
    },

    run: function (api, action, next) {
        action.response.string = 'Input > ' + action.params.value
        next()
    }
}, {
    name: 'input-validator-predef-alpha-num',
    description: 'Test pre-defined validator alpha numeric',
    inputs: {
        'value': {
            validator: 'alpha_num'
        }
    },

    run: function (api, action, next) {
        action.response.string = 'Input > ' + action.params.value
        next()
    }
}, {
    name: 'input-validator-predef-test',
    description: 'Test pre-defined validator generic test',
    inputs: {
        'value': {
            validator: 'url'
        }
    },

    run: function (api, action, next) {
        action.response.string = 'Input > ' + action.params.value
        next()
    }
}];
