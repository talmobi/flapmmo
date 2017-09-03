(function () {

  /* Setup stats.js */
  var stats = new Stats();
  stats.setMode( 0 );
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = '0px';
  stats.domElement.style.top = '0px';
  window.statsDomElement = stats.domElement;
  if (window.location.hostname === 'localhost') {
    stats.domElement.style.display = 'block';
  } else {
    stats.domElement.style.display = 'none';
  }
  document.body.appendChild( stats.domElement );

  var height = 256;
  var width = (height * 16 / 9) | 0;

  var GLOBALS = {
    width: width,
    height: height,
    gravity: 0.3,
    gui: {
      scoreScreen: {
        base: null,
      },
      scoreDiv: document.createElement('div')
    },
    bestScore: window.localStorage.getItem("flapmmo_high_score"),
    bestRun: window.localStorage.getItem("flapmmo_high_score_run"),
  };

var renderer = new PIXI.autoDetectRenderer(width, height, { resolution: 1 });
//var renderer = new PIXI.WebGLRenderer(width, height, { resolution: 1 });

var texFrames = {
  bg: { x: 0, y: 0, width: 144, height: 256 },
  land: { x: 146, y: 0, width: 154, height: 56 },
  pipe: { x: 302, y: 0, width: 26, height: 135 },
  birds: [
  { x: 221, y: 122, width: 19, height: 16 },
  { x: 262, y: 62, width: 19, height: 16 },
  { x: 262, y: 88, width: 19, height: 16 }
  ],
    gui: {
      scoreScreen: { x: 146, y: 58, width: 113, height: 58 },
      gameOver: { x: 144, y: 198, width: 96, height: 21 },
      getReady: { x: 144, y: 219, width: 92, height: 24 },
      buttons: {
        start: { x: 242, y: 213, width: 40, height: 14 },
        ok: { x: 246, y: 134, width: 40, height: 14 },
        menu: { x: 242, y: 118, width: 40, height: 14 },
      }
    }
};

// scale image to fith browser width
renderer.view.style.width = "100%";

document.body.appendChild(renderer.view);

var stages = {
  main: new PIXI.Container(),
  bg: new PIXI.Container(),
  land: new PIXI.Container(),
  pipes: new PIXI.Container(),
  birds: new PIXI.Container(),
  scoreScreen: new PIXI.Container(),
  startScreen: new PIXI.Container(),
};

stages.main.addChild( stages.bg );
stages.main.addChild( stages.pipes );
stages.main.addChild( stages.land );
stages.main.addChild( stages.birds );
stages.main.addChild( stages.scoreScreen );
stages.main.addChild( stages.startScreen );

var birds = [];
var pipes = [];
var puppets = [];
var player = null;

var camera = {
  offset: { x: 120, y: 0 },
  position: { x: 0, y: 0 },
  e: null
};
window.camera = camera;

// mouse events
document.body.addEventListener('mousedown', function (e) {
  //console.log("MOUSE DOWN CLICKED!");

  if (e.button === 2) { // right mouse button
    camera.e = e;
  } else {
    camera.e = null;
    // make player character jump on mouse click
    if (player) {
      player.handleClick(e);
      if (player.initialized) {
        camera.offset.x = 120;
      }
    }
  }
  e.preventDefault();
});
document.body.addEventListener('mousemove', function (e) {
  if (e.button === 2) { // right mouse button
    camera.e = e;
  }
});
document.body.addEventListener('mouseup', function (e) {
  //console.log("MOUSE UP CLICKED!");

  if (e.button === 2) { // right mouse button
    camera.e = null;
  } else {
  }
  e.preventDefault();
});
window.oncontextmenu = function (e) {
  return false;
};

var ui = null;
var myId = -1;

PIXI.loader.add('sheet', 'sheet.png').load(function (loader, assets) {
  /* Socket Client
   * */
  var url = window.location.href; // "http://localhost:4004";
  var socket = io(url);
  socket.on('HELLO', function (data) {
    console.log("Server says: " + data.message);

    myId = data.id;
    pipes = data.pipes;
    stages.pipes.removeChildren();
    drawPipes( pipes );

    // send a hello back tot the server
    socket.emit('HELLO', { id: myId, message: "Hi server! Thanks for pipes!" });
  });

  // receive a puppet from the server
  socket.on('PUPPET', function (data) {
    // create a puppet based on the received events
    var puppet = new Puppet({
      x: data.startPosition.x,
      y: data.startPosition.y
    }, data.events );
    puppet.id = data.id;
    puppets.push( puppet );
  });

  socket.on('LAST', function (data) {
    console.log("Got LAST from Server!");

    var ra = data.recentAttempts;
    // play out last attempts with random delay
    for (var i = 0; i < ra.length; i++) {
      (function() {
        var d = JSON.parse(JSON.stringify(ra[i]));
        var delay = i * 1000;
        setTimeout(function () {
          var puppet = new Puppet({
            x: d.startPosition.x,
              y: d.startPosition.y
          }, d.events );
          puppet.id = d.id;
          puppets.push( puppet );
        }, delay);
      })();
    }
  });

  // receive status update from server
  socket.on('STATUS', function (data) {
    console.log("Got STATUS from Server!");

    var highScores = data.highScores;

    console.log("Highscores.length: " + highScores.length);

    // create puppets of all the highscores
    for (var i = 0; i < highScores.length; i++) {
      var hs = highScores[i];
      var data = hs.data;

      /*
      var puppet = new Puppet({
        x: data.startPosition.x,
        y: data.startPosition.y
      }, data.events );
      puppet.id = data.id;
      puppets.push( puppet );
      */

      // update highscore view
      var le = ui.highScoreListElements;
      if (i < le.length) {
        var domElement = le[i];
        domElement.data = JSON.parse(JSON.stringify(data));
        var score = data.events[data.events.length - 1].position.x;
        domElement.innerHTML = (hs.name || 'Anon') + ' : ' + score;
        console.log("topscores added");

        domElement.addEventListener('click', function (e) {
          console.log("List Element ON CLICK");

          // spawn a puppet for that highscore
          var data = JSON.parse(JSON.stringify(this.data));
          console.log(data);
          var puppet = new Puppet({
            x: data.startPosition.x,
            y: data.startPosition.y
          }, data.events );
          puppet.id = data.id;
          puppets.push( puppet );

          e.preventDefault();
          return false;
        });
      }
    }
  });

  var baseTex = assets.sheet.texture;

  var gui = texFrames.gui;
  var textures = {
    bg: new PIXI.Texture(baseTex, texFrames.bg),
    land: new PIXI.Texture(baseTex, texFrames.land),
    pipe: new PIXI.Texture(baseTex, texFrames.pipe),
    gui: {
      scoreScreen: new PIXI.Texture(baseTex, gui.scoreScreen),
      gameOver: new PIXI.Texture(baseTex, gui.gameOver),
      getReady: new PIXI.Texture(baseTex, gui.getReady),
      buttons: {
        start: new PIXI.Texture(baseTex, gui.buttons.start),
        ok: new PIXI.Texture(baseTex, gui.buttons.ok),
        menu: new PIXI.Texture(baseTex, gui.buttons.menu),
      }
    }
  }
  // load bird textures
  textures.birds = (function () {
    var arr = [];

    for (var i = 0; i < texFrames.birds.length; i++) {
      var frame = texFrames.birds[i];
      var tex = new PIXI.Texture(baseTex, frame); 
      arr.push(tex);
    }

    return arr;
  })()

  // create bg sprites
  for (var i = 0; i < 5; i++) {
    var spr = new PIXI.Sprite(textures.bg);
    spr.position.x = i * texFrames.bg.width;
    spr.position.y = 0;
    stages.bg.addChild( spr );
  }

  // create land sprites
  for (var i = 0; i < 4; i++) {
    var spr = new PIXI.Sprite(textures.land);
    spr.position.x = i * texFrames.land.width;
    spr.position.y = GLOBALS.height - texFrames.land.height;
    stages.land.addChild( spr );
  }

  // build score screen
  ui = (function () {
    /* build score screen
     * */
    // background sprite
    var bg = new PIXI.Sprite( textures.gui.scoreScreen );
    bg.anchor.x = 0.5;
    bg.position.x = (GLOBALS.width  / 2) | 0;
    bg.position.y = (GLOBALS.height / 4) | 0;
    bg.scale.x = bg.scale.y = 1.5;
    stages.scoreScreen.addChild(bg);

    // game over text sprite
    var sprGO = new PIXI.Sprite( textures.gui.gameOver );
    sprGO.anchor.x = 0.5;
    sprGO.position.x = bg.position.x;
    sprGO.position.y = bg.position.y - 40;
    sprGO.scale.x = sprGO.scale.y = 1.5;
    stages.scoreScreen.addChild(sprGO);

    var topDiv = document.createElement('div');
    document.body.appendChild(topDiv);
    topDiv.style.position = 'absolute';
    topDiv.style['text-align'] = 'center';
    var fontSize = "30px";

    var scoreDiv = document.createElement('div');
    scoreDiv.innerHTML = "";
    scoreDiv.style['font-family'] = "MyFont";
    scoreDiv.style['font-size'] = fontSize;
    scoreDiv.style.position = 'relative';
    topDiv.appendChild(scoreDiv);

    var bestScoreDiv = document.createElement('div');
    bestScoreDiv.innerHTML = "";
    bestScoreDiv.style['font-family'] = "MyFont";
    bestScoreDiv.style['font-size'] = fontSize;
    bestScoreDiv.style.position = 'relative';
    topDiv.appendChild(bestScoreDiv);

    // create server wide top score modal
    var topScoresDiv = document.createElement('div');
    topScoresDiv.style['font-size'] = '24px';
    topScoresDiv.style['z-index'] = '100';
    topScoresDiv.style.position = 'relative';
    var ul = document.createElement('ul');
    var highScoreListElements = [];
    for (var i = 0; i < 6; i++) {
      var li = document.createElement('li');
      li.style['text-align'] = 'left';
      li.style['list-style-type'] = 'none';
      if (i < 5)
        li.style['border-bottom'] = '2px solid';
      li.innerHTML = "TOP SCORER " + i;
      ul.appendChild(li);
      highScoreListElements.push(li);
    }
    topScoresDiv.appendChild(ul);
    topDiv.appendChild(topScoresDiv);

    /* build start screen
     * */
    // background sprite
    var sprGameStart = new PIXI.Sprite( textures.gui.getReady );
    sprGameStart.anchor.x = 0.5;
    sprGameStart.position.x = (GLOBALS.width  / 2) | 0;
    sprGameStart.position.y = (GLOBALS.height / 4) | 0;
    sprGameStart.scale.x = sprGameStart.scale.y = 1.5;
    stages.startScreen.addChild(sprGameStart);

    var gameStartDiv = document.createElement('div');
    document.body.appendChild(gameStartDiv);
    gameStartDiv.innerHTML = "CLICK TO BEGIN!";
    gameStartDiv.style.position = 'absolute';
    gameStartDiv.style['text-align'] = 'center';
    gameStartDiv.style['font-size'] = '30px';

    // onresize
    window.onresize = function () {
      var scale = {
        x: window.innerWidth / GLOBALS.width,
        y: window.innerWidth / GLOBALS.height,
      };

      scale.x /= 2;
      // adjust font sizes
      scoreDiv.style['font-size'] = '' + 30 * scale.x + 'px';
      scoreDiv.style['font-size'] = '' + 30 * scale.x + 'px';
      topScoresDiv.style['font-size'] = '' + 24 * scale.x + 'px';
      gameStartDiv.style['font-size'] = '' + 30 * scale.x + 'px';

      // update relative positions
      topDiv.style.top = (bg.position.y - bg.height / 2) * scale.y;
      topDiv.style.left = (bg.position.x - bg.width / 2) * scale.x * 2;

      var pp = sprGameStart.position;
      var ss = sprGameStart;
      gameStartDiv.style.top = (pp.y - 20) * scale.y * bg.scale.x * 2;
      gameStartDiv.style.left = (pp.x - 120) * scale.x * bg.scale.y * 2;

      scoreDiv.style.top = 28 * scale.y;
      scoreDiv.style.left = 89 * scale.x * 2;

      bestScoreDiv.style.top = (28 + 10) * scale.y;
      bestScoreDiv.style.left = 89 * scale.x * 2;

      topScoresDiv.style.top = 45 * scale.y;
      topScoresDiv.style.left = 20 * scale.x * 2;
    };
    window.onresize();

    var showGameOver = function () {
      hideGameStart();
      stages.scoreScreen.visible = true;
      topDiv.style.display = "block";
    };

    var hideGameOver = function () {
      stages.scoreScreen.visible = false;
      topDiv.style.display = "none";
    };

    var showGameStart = function () {
      hideGameOver();
      stages.startScreen.visible = true;
      gameStartDiv.style.display = "block";
    };

    var hideGameStart = function () {
      stages.startScreen.visible = false;
      gameStartDiv.style.display = "none";
    };

    return {
      showGameOver: showGameOver,
      hideGameOver: hideGameOver,

      showGameStart: showGameStart,
      hideGameStart: hideGameStart,

      setScore: function (score) {
        scoreDiv.innerHTML = score;
      },
      setBestScore: function (score) {
        bestScoreDiv.innerHTML = score;
      },

      highScoreListElements: highScoreListElements
    }
  })();

  //ui.showGameOver();
  ui.hideGameOver();
  ui.setScore(0);
  ui.setBestScore( window.localStorage.getItem("flapmmo_high_score") );
  //ui.hideGameOver();
  //ui.showGameStart();
  ui.showGameStart();

  // create pipes
  /*
     var pipeInterval = 90;
     var gap = 30;
     for (var i = 0; i < 30; i++) {
     var d = (GLOBALS.height - texFrames.land.height) * 0.4;
     var h = (Math.random() * d + 60) | 0;

     var pipe = {
     x:  i * pipeInterval + 100,
     h: h,
     gap: gap,
     }

     pipes.push( pipe );
     }
     */

  function drawPipes(pipes) {
    for (var i = 0; i < pipes.length; i++) {
      var pipe = pipes[i];

      var a = new PIXI.Sprite( textures.pipe );
      a.anchor.y = 1;
      a.position.x = pipe.x;
      a.position.y = pipe.h - pipe.gap;
      stages.pipes.addChild( a );

      var b = new PIXI.Sprite( textures.pipe );
      b.anchor.y = 1;
      b.position.x = pipe.x;
      b.position.y = pipe.h + pipe.gap;
      b.scale.y = -1;
      stages.pipes.addChild( b );
    }
  }


  function Bird (pos) {
    this.sprite = new PIXI.Sprite(textures.birds[0]);
    this.position = this.sprite.position = pos || { x: 40, y: GLOBALS.height / 2 }
    this.startSpeed = { x: 0, y: -4 };
    this.speed = { x: this.startSpeed.x, y: this.startSpeed.y };

    this.lastPipeIndex = 0;

    this.states = {
      FLY: 'FLY',
      DEAD: 'DEAD'
    };
    this.state = this.states.FLY;
    this.deadAt = 0;

    this.score = 0;

    this.startX = this.position.x;
    this.startY = this.position.y;

    this.reset = function () {
      this.position.x = this.startX;
      this.position.y = this.startY;
      this.state = this.states.FLY;
      this.speed = { x: this.startSpeed.x, y: this.startSpeed.y };
      this.lastPipeIndex = 0;
    }

    // set anchor to center
    this.sprite.anchor.x = this.sprite.anchor.y = 0.5;

    // vars to animate flapping
    this.imgs = 
      [textures.birds[0], textures.birds[1], textures.birds[2]];
    this.subImg = 0;
    this.flapCounter = 0;
    this.flapInterval = 8;

    // update method
    this.tick = function () {
      this.sprite.tint = 0xFFFFFF; // no tint

      /* Physics
       * */
      if (this.state === this.states.FLY) {
        this.speed.y += GLOBALS.gravity;
        this.position.y += this.speed.y;

        this.position.x++;

        /* Collision checking
         * */
        // check floor
        var floory = GLOBALS.height - texFrames.land.height - 8;
        if (this.position.y > floory) {
          this.die();
          //this.speed.y = -8;
        }
        // check pipes
        for (var i = this.lastPipeIndex; i < pipes.length; i++) {
          var pipe = pipes[i];

          var x = this.position.x;
          var y = this.position.y;
          var bw = 4; // bird width
          var bh = 4; // bird height
          var pipeWidth = texFrames.pipe.width;

          if (x >= pipe.x - bw && x <= (pipe.x + bw  + pipeWidth)) {
            // within a pipe, now we check if we are in the gap
            if (!(y >= (pipe.h - pipe.gap + bh) && 
                  (y <= (pipe.h + pipe.gap - bh)))) {
                    this.collides();
                  } else {
                    this.score = i + 1;
                    if (player.bird === this && player.score !== this.score) {
                      player.score = this.score;
                      ui.setScore(player.score);
                      console.log("Score: " + this.score);
                    }
                  }

            // no need to check other pipes
            this.lastPipeIndex = i;
            break;
          }
        }
      }


      /* animation
       * */
      if (this.state === this.states.FLY) {
        this.flapCounter++;
        if (this.flapCounter > this.flapInterval) {
          //console.log("flapping");
          this.flapCounter = 0;
          this.subImg = (this.subImg + 1) % this.imgs.length;
          // change texture of out sprite to another one
          this.sprite.texture = this.imgs[ this.subImg ];
        }
        // rotate sprite based on speed.y
        var rads = this.speed.y * Math.PI / 24;
        this.sprite.rotation = rads;
      }
      if (this.state === this.states.DEAD) {
        this.sprite.tint = 0xFF0000; // red tint
      }
    }

    this.jump = function () {
      this.speed.y = -4;
    }

    this.remove = function () {
      stages.birds.removeChild( this.sprite );
    }

    this.collides = function () {
      this.sprite.tint = 0xFF0000; // red tint
      this.die();
    }

    this.die = function () {
      this.sprite.tint = 0xFF0000; // red tint

      this.state = this.states.DEAD;
      this.deadAt = Date.now();

      // trigger a local test puppet of our previos events
      // to send to the server (if the player bird died)
      if (player && player.bird === this) {
        console.log("player bird has died");

        var e = {
          type: "DEAD",
          position: {
            x: this.position.x,
            y: this.position.y
          }
        }
        player.events.push(e);

        // save best score locally
        var best = window.localStorage.getItem("flapmmo_high_score");
        if (this.score > best) {
          GLOBALS.bestScore = this.score;
          window.localStorage.setItem("flapmmo_high_score", this.score);
          window.localStorage.setItem("flapmmo_high_score_run", [].concat(player.events));
          best = window.localStorage.getItem("flapmmo_high_score");
          console.log("best score updated: " + best);
          ui.setBestScore(best);
        }

        /*
           var puppet = new Puppet({
           x: this.startX,
           y: this.startY
           }, player.events );
           player.events = [];
           puppets.push( puppet );
           */

        // instead of a local puppet, push the puppet
        // events to the server
        socket.emit('PUPPET', {
          events: player.events,
          id: myId,
          startPosition: {
            x: this.startX,
            y: this.startY
          }
        });
        player.events = [];

        // show score screen
        ui.showGameOver();
      }
    }

    // add it to the stage
    stages.birds.addChild( this.sprite );
  }

  function Player (pos) {
    this.bird = new Bird(pos);
    this.initialized = false;

    // save all player events that will be
    // simulated for other players
    this.events = [];

    this.tick = function () {
      this.bird.tick();

      if (!this.initialized) {
        if (this.bird.position.y > 120) {
          this.bird.speed.y = -4;
        }
        this.bird.position.x = this.bird.startX;
      }
    }

    this.jump = function () {
      this.bird.jump();

      // save event
      var e = {
        position: {
          x: this.bird.position.x,
          y: this.bird.position.y
        },
        type: 'JUMP'
      };
      this.events.push( e );
    }

    this.reset = function () {
      var now = Date.now();
      if (now > this.bird.deadAt + 500) {
        this.bird.reset();
        this.initialized = false;
        ui.showGameStart();
      }
    }

    this.isAlive = function () {
      return this.bird.state === this.bird.states.FLY;
    };

    this.handleClick = function (e) {
      if (!this.initialized) {
        this.initialized = true;
        ui.hideGameStart();
      }

      switch (this.bird.state) {
        case 'DEAD':
          // reset the game
          // check to make sure we're not selecting from the
          // highscore list
          if (e.clientY < window.innerHeight / 2) {
            this.reset();
            if (this.bird.state === this.bird.states.FLY) {
              // hide score screen
              ui.hideGameOver();
            }
          }
          break;

        case 'FLY':
          // jump
          this.jump();
          break;
      }
    }
  }

  // simulations of other online players
  function Puppet (pos, events) {
    this.bird = new Bird(pos);
    this.events = events || [];

    this.dead = false;

    this.tick = function () {
      var n = this.events[0];

      if (n) {
        this.bird.tick();
        this.bird.sprite.tint = 0x00FFFF; // blue tint

        if (n.position.x <= this.bird.position.x) {
          //console.log("puppet event triggered!");

          this.bird.position.x = n.position.x;
          this.bird.position.y = n.position.y;
          if (n.type === 'JUMP') {
            this.bird.jump();
          }

          // delete the handles event
          this.events.splice(0, 1);
        }
      } else {
        // assume dead, remove after a while
        if (!this.dead) {
          console.log("Puppet died!");
          this.dead = true;
          var ind = puppets.indexOf( this );
          puppets.splice( ind, 1 );
        }
      }

    }
  }

  //startBird = new Bird();
  player = new Player();

  // kick off animation
  animate();
});

function update() {
  for (var i = 0; i < birds.length; i++) {
    var bird = birds[i];
    bird.tick();
  }


  if (camera.e !== null && camera.e.button === 2) {
    camera.offset.x += (-camera.e.clientX + window.innerWidth / 2) * 0.05;
  }

  if (player) {
    player.tick();


    camera.x = player.bird.position.x - camera.offset.x;

    // offset object positions
    stages.birds.position.x = -camera.x;
    stages.pipes.position.x = -camera.x;

    // animate background
    if (player.isAlive()) {
      var cx = camera.x;
      var tf = texFrames;
      stages.land.position.x = (stages.pipes.position.x - tf.land.width) % tf.land.width | 0;
      stages.bg.position.x = (-cx / 2 - tf.bg.width) % tf.bg.width | 0;
    }
  }

  // update puppets
  for (var i = 0; i < puppets.length; i++) {
    var puppet = puppets[i];
    puppet.tick();
  }
};

function animate () {
  stats.begin();

  update();

  renderer.render( stages.main );

  stats.end();

  requestAnimationFrame( animate );
}

console.log("App loaded");
})();
