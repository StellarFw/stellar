module.exports = [{
    name: 'test',
    description: 'Isto é para testar a protecção conta overwrite está a funcionar.',

    run: function(engine, data, next) {
        // define a response var
        data.response.string = "overwrite";

        // end the action execution
        next();
    }
}];
