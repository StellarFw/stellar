var io = require('socket.io')();

module.exports = {

  loadPriority: 1,

  initialize: function (engine, next) {
    io.on('connection', function (socket) {

      // debug msg
      engine.log.info('Client connected...');

      // on action call
      socket.on('call', function (action_id) {
        // connection state
        var data = { response: {} };

        // execute requested action
        engine.actions.call(action_id, data, function () {
          // send response to client
          socket.emit('action_response', data.response);
        });
      });

    });

    io.listen(3000);

    next();
  }

};
