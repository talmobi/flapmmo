var port = 4004;
var io = require('socket.io')(port);


// list of all sockets
var sockets = [];

// create pipes
var height = 256;
var landHeight = 56;
var pipes = [];
var pipeInterval = 100;
var gap = 30;
var offX = 100;
for (var i = 0; i < 30; i++) {
  var d = (height - landHeight) * 0.4;
  var h = (Math.random() * d + 60) | 0;

  var pipe = {
    x:  i * pipeInterval + offX,
    h: h,
    gap: gap,
  }

  pipes.push( pipe );
}

function log(type, str) {
  console.log(type + ": " +str);
}

io.on('connection', function (socket) {
  // Greet the new user
  log('status', " + user connected");
  sockets.push( socket );
  socket.emit('HELLO', {
    message: "Hi, sending pipes!",
    pipes: pipes
  });

  // listen for HELLO response
  socket.on('HELLO', function (data) {
    log('user', data.message || "HELLO");
  });


  // receive a puppet from a user
  socket.on('PUPPET', function (data) {
    log('puppet', "Got a puppet! length: " + data.events.length);
    // broadcast the puppet to all other connected clients
    io.emit('PUPPET', data);
  });


  socket.on('disconnect', function () {
    // remove the disconnected socket from the list
    var index = sockets.indexOf( socket );
    sockets.splice( index, 1 );
  });

});
