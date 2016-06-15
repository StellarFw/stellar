module.exports = [{
    name: 'test',
    description: 'Generate a random number',
    outputExample: {
        number: 0.212
    },

    protected: true,

    run: function(engine, data, next) {
        // define a response var
        data.response.string = "LoL";

        // end the action execution
        next();
    }
}];
