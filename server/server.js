var port = 4004;
var io = require('socket.io')(port);


// list of all sockets
var sockets = [];

function HighScore (data) {
  this.name = data.name || 'Anonymous';
  this.data = {
    startPosition: {
      x: data.startPosition.x,
      y: data.startPosition.y
    },
    events: data.events
  };
};
function handlePuppet (data) {
};
var highScores = [];

// create pipes
var height = 256;
var landHeight = 56;
var pipes = [];
var pipeInterval = 100;
var startGap = 35;
var gap = 30;
var offX = 200;
for (var i = 0; i < 35; i++) {
  var d = (height - landHeight) * 0.1;
  var h = (Math.random() * d * 4 + 60) | 0;

  var pipe = {
    x:  i * pipeInterval + offX,
    h: h,
    gap: gap,
  }

  var newGap = (startGap - (i / 2)) | 0;
  gap = Math.max(20, newGap);

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
    // broadcast the puppet to all connected clients, including yourself (for debugging)

    var d = {
      startPosition: {
        x: data.startPosition.x,
        y: data.startPosition.y
      },
      events: data.events
    };

    io.emit('PUPPET', d);

    /*socket.emit('PUPPET', data); - this line doesn't send it to yourself*/
  });


  socket.on('disconnect', function () {
    // remove the disconnected socket from the list
    var index = sockets.indexOf( socket );
    sockets.splice( index, 1 );
  });

});
