module.exports = [{
    name: 'callAction',
    description: 'Testa a chamada de uma action dentro de uma action.',

    run: function(engine, data, next) {
        // define a response var
        data.response.string = "overwrite";

        // end the action execution
        next();
    }
}];
