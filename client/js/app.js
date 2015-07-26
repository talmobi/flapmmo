(function () {

  /* Setup stats.js */
  var stats = new Stats();
  stats.setMode( 0 );
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = '0px';
  stats.domElement.style.top = '0px';
  document.body.appendChild( stats.domElement );


  var height = 256;
  var width = (height * 16 / 9) | 0;

  var GLOBALS = {
    width: width,
    height: height,
    gravity: 0.3,
  };

  var renderer = new PIXI.autoDetectRenderer(width, height);

  var texFrames = {
    bg: { x: 0, y: 0, width: 144, height: 256 },
    land: { x: 146, y: 0, width: 154, height: 56 },
    pipe: { x: 302, y: 0, width: 26, height: 135 },
    birds: [
      { x: 221, y: 122, width: 19, height: 16 },
      { x: 262, y: 62, width: 19, height: 16 },
      { x: 262, y: 88, width: 19, height: 16 }
    ]
  };

  // scale image to fith browser width
  renderer.view.style.width = "100%";

  document.body.appendChild(renderer.view);

  var stages = {
    main: new PIXI.Container(),
    bg: new PIXI.Container(),
    pipes: new PIXI.Container(),
    land: new PIXI.Container(),
    birds: new PIXI.Container(),
  };

  stages.main.addChild( stages.bg );
  stages.main.addChild( stages.pipes );
  stages.main.addChild( stages.land );
  stages.main.addChild( stages.birds );

  var birds = [];
  var pipes = [];
  var puppets = [];
  var player = null;

  // mouse events
  document.body.addEventListener('mousedown', function (e) {
    console.log("MOUSE CLICKED!");

    // make player character jump on mouse click
    if (player) {
      player.handleClick();
    }

    return e.preventDefault();
  });


  PIXI.loader.add('sheet', 'sheet.png').load(function (loader, assets) {
    /* Socket Client
     * */
    var url = "http://localhost:4004";
    var socket = io(url);
    socket.on('HELLO', function (data) {
      console.log("Server says: " + data.message);

      pipes = data.pipes;
      stages.pipes.removeChildren();
      drawPipes( pipes );

      // send a hello back tot the server
      socket.emit('HELLO', { message: "Hi server! Thanks for pipes!" });
    });

    // receive a puppet from the server
    socket.on('PUPPET', function (data) {
      // create a puppet based on the received events
      var puppet = new Puppet({
        x: data.startPosition.x,
          y: data.startPosition.y
      }, data.events );
      puppets.push( puppet );
    });

    var baseTex = assets.sheet.texture;

    var textures = {
      bg: new PIXI.Texture(baseTex, texFrames.bg),
      land: new PIXI.Texture(baseTex, texFrames.land),
      pipe: new PIXI.Texture(baseTex, texFrames.pipe)
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
    for (var i = 0; i < 4; i++) {
      var spr = new PIXI.Sprite(textures.bg);
      spr.position.x = i * texFrames.bg.width;
      spr.position.y = 0;
      stages.bg.addChild( spr );
    }

    // create land sprites
    for (var i = 0; i < 3; i++) {
      var spr = new PIXI.Sprite(textures.land);
      spr.position.x = i * texFrames.land.width;
      spr.position.y = GLOBALS.height - texFrames.land.height;
      stages.land.addChild( spr );
    }

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
      this.speed = { x: 0, y: 0};

      this.states = {
        FLY: 'FLY',
        DEAD: 'DEAD'
      };
      this.state = this.states.FLY;
      this.deadAt = 0;

      this.startX = this.position.x;
      this.startY = this.position.y;

      this.reset = function () {
        this.position.x = this.startX;
        this.position.y = this.startY;
        this.state = this.states.FLY;
        this.speed = { x: 0, y: 0};
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
          if (this.position.y > GLOBALS.height - texFrames.land.height) {
            this.speed.y = -8;
          }
          // check pipes
          for (var i = 0; i < pipes.length; i++) {
            var pipe = pipes[i];

            var x = this.position.x;
            var y = this.position.y;
            var bw = 5; // bird width
            var bh = 5; // bird height
            var pipeWidth = texFrames.pipe.width;

            if (x >= pipe.x - bw && x <= (pipe.x + bw  + pipeWidth)) {
              // within a pipe, now we check if we are in the gap
              if (!(y >= (pipe.h - pipe.gap + bh) && 
                    (y <= (pipe.h + pipe.gap - bh)))) {
                      this.collides();
                    }

              // no need to check other pipes
              break;
            }
          }
        }


        /* animation
         * */
        if (this.state === this.states.FLY) {
          this.flapCounter++;
          if (this.flapCounter > this.flapInterval) {
            console.log("flapping");
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
        this.speed.y = -5;
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
            startPosition: {
              x: this.startX,
              y: this.startY
            }
          });
          player.events = [];
        }
      }

      // add it to the stage
      stages.birds.addChild( this.sprite );
    }

    function Player (pos) {
      this.bird = new Bird(pos);

      // save all player events that will be
      // simulated for other players
      this.events = [];

      this.tick = function () {
        this.bird.tick();
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
        }
      }

      this.handleClick = function () {
        switch (this.bird.state) {
          case 'DEAD':
            // reset the game
            this.reset();
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
            console.log("puppet event triggered!");

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
            var self = this;
            setTimeout(function () {
              console.log("Puppet removed!");
              var ind = puppets.indexOf( self );
              puppets.splice( ind, 1 );
              stages.birds.removeChild( self.bird.remove() );
            }, 4000)
          }
        }

      }
    }

    player = new Player();

    // kick off animation
    animate();
  });

  function update() {
    for (var i = 0; i < birds.length; i++) {
      var bird = birds[i];
      bird.tick();
    }

    if (player) {
      player.tick();
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
