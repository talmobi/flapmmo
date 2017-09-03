var port = 16400;

var path = require( 'path' )

var express = require( 'express' )
var app = express()
var server = require( 'http' ).createServer( app )
var io = require('socket.io')( server );

var cors = require( 'cors' )

// allow cors
app.use( cors() )

// server static frontend files
app.use( express.static( path.join( __dirname, '../client' ) ) )

server.listen( port, '127.0.0.1', function () {
		console.log( 'server listening on *:' + server.address().port )
})

// list of all sockets
var sockets = [];
var socketIdCounter = 0;

function HighScore (data) {
  this.name = data.name || 'Anonymous';
  this.data = {
    startPosition: {
      x: data.startPosition.x,
      y: data.startPosition.y
    },
    events: data.events,
    id: data.id
  };
};

var highScores = [];
var recentAttempts = [];

// create pipes
var height = 256;
var landHeight = 56;
var pipes = [];
var pipeInterval = 100;
var startGap = 35;
var gap = 30;
var offX = 200;
var lastd = 0;
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
  lastd = d;
}

// add finishing pipes
for (var i = 0; i < 13; i++) {
  var d = lastd;
  var h = pipes[34].h;

  var pipe = {
    x:  (34 * pipeInterval + 30) + i * 30 + offX,
    h: h,
    gap: 30 + i * 3,
  }

  if (i >= 9) {
    pipe.gap = Math.max(0, pipes[pipes.length - 1].gap - 16);
  }

  pipes.push( pipe );
}

function log(type, str) {
  console.log(type + ": " +str);
}

io.on('connection', function (socket) {
  // Greet the new user
  log('status', " + user connected");
  socket.id = socketIdCounter++;
  sockets.push( socket );

  // send HELLO message to client immediately on connect
  socket.emit('HELLO', {
    message: "Hi, sending pipes!",
    id: socket.id,
    pipes: pipes
  });

  // TEST send all highscore puppets to client on connect
  socket.emit('STATUS', {
    highScores: highScores
  });

  socket.emit('LAST', {
    recentAttempts: recentAttempts
  });

  // listen for HELLO response
  socket.on('HELLO', function (data) {
    log('user', data.message || "HELLO");
    log('user', "user id: " + data.id + ", -> " + socket.id);
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
      events: data.events,
      id: data.id
    };

    // save to recent attempts
    recentAttempts.push(d);
    recentAttempts.splice(20, recentAttempts.length);

    // save to highscores
    var hs = new HighScore(d);
    highScores.push( hs );
    // sort highscores
    highScores.sort(function (a, b) {
      var ax = a.data.events[a.data.events.length - 1].position.x;
      var bx = b.data.events[b.data.events.length - 1].position.x;
      if (ax === bx) return 0;
      if (ax > bx) {
        // ax is a better score
        return -1;
      }
      return 1; // b is better
    });
    // store max 10 highscores
    highScores.splice(10, highScores.length);
    log('score', "highscores.length: " + highScores.length);


    io.emit('PUPPET', d);

    /*socket.emit('PUPPET', data); - this line doesn't send it to yourself*/
  });


  socket.on('disconnect', function () {
    // remove the disconnected socket from the list
    var index = sockets.indexOf( socket );
    sockets.splice( index, 1 );
  });

});
