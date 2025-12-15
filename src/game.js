class Game {
  constructor(state) {
    this.state = state;
    this.spawnedObjects = [];
    this.collidableObjects = [];
    this.activeEnemies = [];
    this.enemyPool = [];
    this.currentLevel = 1;
    this.spawnPos = vec3.create();
    this.spawnFront = vec3.create();
    this.spawnUp = vec3.create();
  }

  // example - we can add our own custom method to our game and call it using 'this.customMethod()'
  customMethod() {
    console.log("Custom method!");
  }

  // example - create a collider on our object with various fields we might need (you will likely need to add/remove/edit how this works)
  createSphereCollider(object, radius, onCollide = null) {
    object.collider = {
      type: "SPHERE",
      radius: radius,
      onCollide: onCollide ? onCollide : (otherObject) => {
        console.log(`Collided with ${otherObject.name}`);
      }
    };
    this.collidableObjects.push(object);
  }

  // Box collider is sizes of the objects X Y Z
  // Will be used for the WALLS
  createBoxCollider(object, width, height, length, onCollide = null) {
    // NOTE: These are not exact and only make a box with respect to XYZ. thats right, theres no account for rotation. This is a problem that shouldnt need fixing but might.
    object.collider = {
      type: "BOX",
      width: width,
      height: height,
      length: length,
      onCollide: onCollide ? onCollide : (otherObject) => {
        console.log(`${object.name} Collided with ${otherObject.name}`);
      }
    };
    this.collidableObjects.push(object);
  }
  
  async spawnEnemy() {
    // Spawn enemies
    await spawnObject({
      name: `enemy${this.enemyPool.length}`,
      type: "mesh",
      material: {
        diffuse: vec3.fromValues(0.3, 0, 0),
        ambient: vec3.fromValues(1,1,1)
      },
      fileName: "15792_Novelty_Head-Full-Demon_v1.obj",
      position: vec3.fromValues(0,0,0),
      scale: vec3.fromValues(0.05, 0.05, 0.05),
        }, this.state);
    
    let enemy = getObject(this.state, `enemy${this.enemyPool.length}`);

    let e = new Enemy({
      name: `enemy${this.enemyPool.length}`,
      health: 3
    }, enemy);
    this.enemyPool.push(e);

    var width = 2.5;
    var height = 2.5;
    var length = 2.5;
    this.createBoxCollider(enemy, width, height, length, (otherObject) => {
      if (otherObject == this.state.camera) {
        // LOSE GAME
        this.state.gameOver = true;
        if (!this.state.isTopDownView) {
          toggleCameraView(this.state);
          let p = document.getElementById("gameOverText");
          p.textContent = "GAME OVER";
        }
      }
      else if (otherObject.collider.type == "BOX") {
        // find the closest values of X,Y,Z with respect to the other object
        // X
        var a = enemy.model.position[0] + enemy.centroid[0] + enemy.collider.width / 2.0 - (otherObject.model.position[0] + otherObject.centroid[0] - otherObject.collider.width / 2.0);
        var b = enemy.model.position[0] + enemy.centroid[0] - enemy.collider.width / 2.0 - (otherObject.model.position[0] + otherObject.centroid[0] + otherObject.collider.width / 2.0);
        // Y
        var c = enemy.model.position[1] + enemy.centroid[1] + enemy.collider.height / 2.0 - (otherObject.model.position[1] + otherObject.centroid[1] - otherObject.collider.height / 2.0);
        var d = enemy.model.position[1] + enemy.centroid[1] - enemy.collider.height / 2.0 - (otherObject.model.position[1] + otherObject.centroid[1] + otherObject.collider.height / 2.0);
        // Z
        var e = enemy.model.position[2] + enemy.centroid[2] + enemy.collider.length / 2.0 - (otherObject.model.position[2] + otherObject.centroid[2] - otherObject.collider.length / 2.0);
        var f = enemy.model.position[2] + enemy.centroid[2] - enemy.collider.length / 2.0 - (otherObject.model.position[2] + otherObject.centroid[2] + otherObject.collider.length / 2.0);

        switch (Math.min(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d), Math.abs(e), Math.abs(f))) {
          case Math.abs(a):
            vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(-a, 0, 0));
            break;
          case Math.abs(b):
            vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(-b, 0, 0));
            break;
          case Math.abs(c):
            vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(0, -c, 0));
            break;
          case Math.abs(d):
            vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(0, -d, 0));
            break;
          case Math.abs(e):
            vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(0, 0, -e));
            break;
          case Math.abs(f):
            vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(0, 0, -f));
            break;
        }
      }
    });
    this.collidableObjects.push(enemy);
    enemy.rotate('x', -Math.PI/2)
    enemy.forward = vec3.fromValues(1,0,0);
    
  }

  async respawnEnemies() {
    // Will only create as many enemies at a max of 8 since there are only 9 spawnpoints
    if (this.enemyPool.length < 8) {
      await this.spawnEnemy();
    }
    let locations = getPossibleSpawnLocations(this.enemyPool.length);
    var i = 0;
    this.enemyPool.forEach(enemy => {
      vec3.copy(enemy.object.model.position, locations[i]);
      enemy.health = this.currentLevel + 2;
      this.activeEnemies.push(enemy);
      i = i + 1;
    });
  }

  // example - function to check if an object is colliding with collidable objects
  checkCollision(object) {
    // loop over all the other collidable objects 
    this.collidableObjects.forEach(otherObject => {
      // probably don't need to collide with ourselves
      if (object.name === otherObject.name) {
        return;
      }

      // do a check to see if we have collided, if we have we can call object.onCollide(otherObject) which will
      // call the onCollide we define for that specific object. This way we can handle collisions identically for all
      // objects that can collide but they can do different things (ie. player colliding vs projectile colliding)
      // use the modeling transformation for object and otherObject to transform position into current location
      // ie: 
      // if (collide){ object.collider.onCollide(otherObject) } // fires what we defined our object should do when it collides
      // BOX TO BOX COLLISION
      if (object.collider.type == "BOX" && otherObject.collider.type == "BOX") {
        // Made these variables for testing, can remove later if needed
        var a = object.model.position[0] + object.centroid[0] + object.collider.width / 2.0 >= otherObject.model.position[0] + otherObject.centroid[0] - otherObject.collider.width / 2.0;
        var b = object.model.position[0] + object.centroid[0] - object.collider.width / 2.0 <= otherObject.model.position[0] + otherObject.centroid[0] + otherObject.collider.width / 2.0;
        var c = object.model.position[1] + object.centroid[1] + object.collider.height / 2.0 >= otherObject.model.position[1] + otherObject.centroid[1] - otherObject.collider.height / 2.0;
        var d = object.model.position[1] + object.centroid[1] - object.collider.height / 2.0 <= otherObject.model.position[1] + otherObject.centroid[1] + otherObject.collider.height / 2.0;
        var e = object.model.position[2] + object.centroid[2] + object.collider.length / 2.0 >= otherObject.model.position[2] + otherObject.centroid[2] - otherObject.collider.length / 2.0;
        var f = object.model.position[2] + object.centroid[2] - object.collider.length / 2.0 <= otherObject.model.position[2] + otherObject.centroid[2] + otherObject.collider.length / 2.0;
        // MaxX to MinX
        if (a && b) {
          // MaxY to MinY
          if (c && d) {
            // MaxZ to MinZ
            if (e && f) {
              object.collider.onCollide(otherObject);
            }
          }
        }
      }
    });
  }

  // runs once on startup after the scene loads the objects
  async onStart() {
    console.log("On start");
    vec3.copy(this.spawnPos, state.camera.position);
    vec3.copy(this.spawnFront, state.camera.front);
    vec3.copy(this.spawnUp, state.camera.up);

    // Set up our own superior input system (allows for holding)
    document.addEventListener('keydown', (event) => {
      if (!event.repeat) {
        state.keysPressed[event.key.toLowerCase()] = true;
      }
    });

    document.addEventListener('keyup', (event) => {
      delete state.keysPressed[event.key.toLowerCase()];
    });

    // this just prevents the context menu from popping up when you right click
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    }, false);

    document.addEventListener('mousedown', (event) => {
      // shoot code
      // shoot animation
      this.state.betweenShotsRecharge = 0;
      this.state.shootDuration = 0;
      // code
      // Ray direction: D = P-E = "at" in our case
      // Ray origin: P = camera.pos or enemy.pos
      // onshoot:
      var rayPos = this.state.camera.position;
      var rayDir = vec3.create();
      vec3.normalize(rayDir, state.camera.front);
      var nearestObject = null;
      var closestDistance;
      this.collidableObjects.forEach(otherObject => {
        if (otherObject.collider.type == "BOX" && otherObject.name != "Camera") {
          // MinX
          var a = ((otherObject.model.position[0] + otherObject.centroid[0] - otherObject.collider.width / 2.0) - rayPos[0]) / rayDir[0];
          // MaxX
          var b = ((otherObject.model.position[0] + otherObject.centroid[0] + otherObject.collider.width / 2.0) - rayPos[0]) / rayDir[0];
          // MinY
          var c = ((otherObject.model.position[1] + otherObject.centroid[1] - otherObject.collider.height / 2.0) - rayPos[1]) / rayDir[1];
          // MaxY
          var d = ((otherObject.model.position[1] + otherObject.centroid[1] + otherObject.collider.height / 2.0) - rayPos[1]) / rayDir[1];
          // MinZ
          var e = ((otherObject.model.position[2] + otherObject.centroid[2] - otherObject.collider.length / 2.0) - rayPos[2]) / rayDir[2];
          // MaxZ
          var f = ((otherObject.model.position[2] + otherObject.centroid[2] + otherObject.collider.length / 2.0) - rayPos[2]) / rayDir[2];

          var tnear = Math.max(Math.min(a, b), Math.min(c, d), Math.min(e, f))
          var tfar = Math.min(Math.max(a, b), Math.max(c, d), Math.max(e, f))

          // Hit
          if (tnear >= 0 && tnear <= tfar) {
            if (closestDistance > tnear || nearestObject == null) {
              closestDistance = tnear;
              nearestObject = otherObject;
            }
          }
        }
      });
      if (nearestObject != null) {
        // Handle player shoot here
        var possibleIndex = this.activeEnemies.findIndex(a => a.object == nearestObject);
        if (possibleIndex != -1) {
          let enemy = this.activeEnemies[possibleIndex];
          // Temporary work-around for no health data on enemies
          enemy.health -= 1;
          if (enemy.health <= 0) {
            // send them to the abyss!
            enemy.object.model.position = vec3.fromValues(0, -100, 0);
            // remove from spawned enemies list
            this.activeEnemies[possibleIndex] = enemy;
            this.activeEnemies.splice(possibleIndex, 1);

            if (this.activeEnemies.length == 0) {
              // all enemies are die.
              console.log("All enemies clear, moving on to next level! : " + this.currentLevel.toString())
              this.currentLevel += 1;
              vec3.copy(this.state.camera.position, this.spawnPos);
              vec3.copy(this.state.camera.front, this.spawnFront);
              vec3.copy(this.state.camera.up, this.spawnUp);
              this.respawnEnemies();
            }
          }
        }
      }
    });

    // create the player collider
    this.createBoxCollider(this.state.camera, 1, 1, 1, (otherObject) => {
      if (otherObject.collider.type == "BOX") {
        // find the closest values of X,Y,Z with respect to the other object
        // X
        var a = this.state.camera.model.position[0] + this.state.camera.collider.width / 2.0 - (otherObject.model.position[0] + otherObject.centroid[0] - otherObject.collider.width / 2.0);
        var b = this.state.camera.model.position[0] - this.state.camera.collider.width / 2.0 - (otherObject.model.position[0] + otherObject.centroid[0] + otherObject.collider.width / 2.0);
        // Y
        var c = this.state.camera.model.position[1] + this.state.camera.collider.height / 2.0 - (otherObject.model.position[1] + otherObject.centroid[1] - otherObject.collider.height / 2.0);
        var d = this.state.camera.model.position[1] - this.state.camera.collider.height / 2.0 - (otherObject.model.position[1] + otherObject.centroid[1] + otherObject.collider.height / 2.0);
        // Z
        var e = this.state.camera.model.position[2] + this.state.camera.collider.length / 2.0 - (otherObject.model.position[2] + otherObject.centroid[2] - otherObject.collider.length / 2.0);
        var f = this.state.camera.model.position[2] - this.state.camera.collider.length / 2.0 - (otherObject.model.position[2] + otherObject.centroid[2] + otherObject.collider.length / 2.0);

        switch (Math.min(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d), Math.abs(e), Math.abs(f))) {
          case Math.abs(a):
            vec3.add(this.state.camera.position, this.state.camera.position, vec3.fromValues(-a, 0, 0));
            break;
          case Math.abs(b):
            vec3.add(this.state.camera.position, this.state.camera.position, vec3.fromValues(-b, 0, 0));
            break;
          case Math.abs(c):
            vec3.add(this.state.camera.position, this.state.camera.position, vec3.fromValues(0, -c, 0));
            break;
          case Math.abs(d):
            vec3.add(this.state.camera.position, this.state.camera.position, vec3.fromValues(0, -d, 0));
            break;
          case Math.abs(e):
            vec3.add(this.state.camera.position, this.state.camera.position, vec3.fromValues(0, 0, -e));
            break;
          case Math.abs(f):
            vec3.add(this.state.camera.position, this.state.camera.position, vec3.fromValues(0, 0, -f));
            break;
        }
      }
    });
    this.collidableObjects.push(this.state.camera);

    // create the wall colliders
    this.state.objects.forEach(object => {
      if (object.type == "plane" || object.type == "cube") {
        // NOTE: ALL PLANES ARE 0.5 IN LENGTH HEIGHT AND WIDTH BY DEFAULT
        // So just apply default size * scale
        var scaleMatrix = vec4.fromValues(object.model.scale[0], object.model.scale[1], object.model.scale[2], 1.0);
        vec4.transformMat4(scaleMatrix, scaleMatrix, object.model.rotation);
        var width = 0.5 * Math.abs(scaleMatrix[0]);
        var height = 0.5 * Math.abs(scaleMatrix[1]);
        var length = 0.5 * Math.abs(scaleMatrix[2]);

        this.createBoxCollider(object, width, height, length);
        this.collidableObjects.push(object);
      }
    });

    // let totalEnemies = 2;
    // // Spawn enemies
    // let locations = getPossibleSpawnLocations(totalEnemies);
    // for (let i = 0; i < totalEnemies; i++) {
    //   console.log(locations[i]);
    //   await spawnObject({
    //     name: `enemy${i}`,
    //     type: "mesh",
    //     material: {
    //       diffuse: vec3.fromValues(0.3, 0, 0),
    //       ambient: vec3.fromValues(1,1,1)
    //     },
    //     fileName: "15792_Novelty_Head-Full-Demon_v1.obj",
    //     position: locations[i],
    //     scale: vec3.fromValues(0.05, 0.05, 0.05),
    //       }, this.state);
      
    //   let enemy = getObject(this.state, `enemy${i}`);

    //   let e = new Enemy({
    //     name: `enemy${i}`,
    //     health: 3
    //   }, enemy);
    //   this.activeEnemies.push(e);
    //   this.enemyPool.push(e);

    //   var width = 2.5;
    //   var height = 2.5;
    //   var length = 2.5;
    //   this.createBoxCollider(enemy, width, height, length, (otherObject) => {
    //     if (otherObject == this.state.camera) {
    //       // LOSE GAME
    //       // Death state
    //       this.state.gameOver = true;
    //       if (!this.state.isTopDownView) {
    //         toggleCameraView(this.state);
    //         let p = document.getElementById("gameOverText");
    //         p.textContent = "GAME OVER";
    //       }
    //     }
    //     else if (otherObject.collider.type == "BOX") {
    //       // find the closest values of X,Y,Z with respect to the other object
    //       // X
    //       var a = enemy.model.position[0] + enemy.centroid[0] + enemy.collider.width / 2.0 - (otherObject.model.position[0] + otherObject.centroid[0] - otherObject.collider.width / 2.0);
    //       var b = enemy.model.position[0] + enemy.centroid[0] - enemy.collider.width / 2.0 - (otherObject.model.position[0] + otherObject.centroid[0] + otherObject.collider.width / 2.0);
    //       // Y
    //       var c = enemy.model.position[1] + enemy.centroid[1] + enemy.collider.height / 2.0 - (otherObject.model.position[1] + otherObject.centroid[1] - otherObject.collider.height / 2.0);
    //       var d = enemy.model.position[1] + enemy.centroid[1] - enemy.collider.height / 2.0 - (otherObject.model.position[1] + otherObject.centroid[1] + otherObject.collider.height / 2.0);
    //       // Z
    //       var e = enemy.model.position[2] + enemy.centroid[2] + enemy.collider.length / 2.0 - (otherObject.model.position[2] + otherObject.centroid[2] - otherObject.collider.length / 2.0);
    //       var f = enemy.model.position[2] + enemy.centroid[2] - enemy.collider.length / 2.0 - (otherObject.model.position[2] + otherObject.centroid[2] + otherObject.collider.length / 2.0);

    //       switch (Math.min(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d), Math.abs(e), Math.abs(f))) {
    //         case Math.abs(a):
    //           vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(-a, 0, 0));
    //           break;
    //         case Math.abs(b):
    //           vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(-b, 0, 0));
    //           break;
    //         case Math.abs(c):
    //           vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(0, -c, 0));
    //           break;
    //         case Math.abs(d):
    //           vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(0, -d, 0));
    //           break;
    //         case Math.abs(e):
    //           vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(0, 0, -e));
    //           break;
    //         case Math.abs(f):
    //           vec3.add(enemy.model.position, enemy.model.position, vec3.fromValues(0, 0, -f));
    //           break;
    //       }
    //     }
    //   });
    //   this.collidableObjects.push(enemy);
    //   enemy.rotate('x', -Math.PI/2)
    //   enemy.forward = vec3.fromValues(1,0,0);
    // }


    // example: spawn in objects, set constantRotate to true for them (used below) and give them a collider
    //   for (let i = 0; i < 2; i++) {
    //     let tempObject = await spawnObject({
    //       name: `new-Object${i}`,
    //       type: "cube",
    //       material: {
    //         diffuse: randomVec3(0, 1)
    //       },
    //       position: vec3.fromValues(4 - i, 0, 0),
    //       scale: vec3.fromValues(0.5, 0.5, 0.5)
    //     }, this.state);


    //     tempObject.constantRotate = true;         // lets add a flag so we can access it later
    //     this.spawnedObjects.push(tempObject);     // add these to a spawned objects list
    //     this.collidableObjects.push(tempObject);  // say these can be collided into
    //   }
    await this.respawnEnemies();
  }

  // Runs once every frame non stop after the scene loads
  onUpdate(deltaTime) {
    // TODO - Here we can add game logic, like moving game objects, detecting collisions, you name it. Examples of functions can be found in sceneFunctions
    if (this.state.betweenShotsRecharge < TIME_BETWEEN_GUNFIRE) {
      this.state.betweenShotsRecharge += deltaTime;
      this.state.shootDuration += deltaTime;
    }
    // example: Rotate a single object we defined in our start method
    // this.cube.rotate('x', deltaTime * 0.5);

    // example: Rotate all objects in the scene marked with a flag
    // this.state.objects.forEach((object) => {
    //   if (object.constantRotate) {
    //     object.rotate('y', deltaTime * 0.5);
    //   }
    // });

    // simulate a collision between the first spawned object and 'cube' 
    // if (this.spawnedObjects[0].collidable) {
    //     this.spawnedObjects[0].onCollide(this.cube);
    // }

    // example: Rotate all the 'spawned' objects in the scene
    // this.spawnedObjects.forEach((object) => {
    //     object.rotate('y', deltaTime * 0.5);
    // });

    // Only check collisions when NOT in top-down view
    if (!this.state.isTopDownView && this.state.camera.collider) {
      this.checkCollision(this.state.camera);

      // Find player scripts
      this.activeEnemies.forEach(enemy => {        
        // create a raycast from enemy to player to check if there is a sightline
        // because no way in hell am i coding pathfinding
        var object = enemy.object;
        var rayPos = vec3.create();
        vec3.add(rayPos, object.model.position, object.centroid);
        var rayDir = vec3.create();
        vec3.subtract(rayDir, this.state.camera.position, rayPos);
        vec3.normalize(rayDir, rayDir);
        var nearestObject = null;
        var closestDistance;
        this.collidableObjects.forEach(otherObject => {
          if (otherObject.collider.type == "BOX") {
            // MinX
            var a = ((otherObject.model.position[0] + otherObject.centroid[0] - otherObject.collider.width / 2.0) - rayPos[0]) / rayDir[0];
            // MaxX
            var b = ((otherObject.model.position[0] + otherObject.centroid[0] + otherObject.collider.width / 2.0) - rayPos[0]) / rayDir[0];
            // MinY
            var c = ((otherObject.model.position[1] + otherObject.centroid[1] - otherObject.collider.height / 2.0) - rayPos[1]) / rayDir[1];
            // MaxY
            var d = ((otherObject.model.position[1] + otherObject.centroid[1] + otherObject.collider.height / 2.0) - rayPos[1]) / rayDir[1];
            // MinZ
            var e = ((otherObject.model.position[2] + otherObject.centroid[2] - otherObject.collider.length / 2.0) - rayPos[2]) / rayDir[2];
            // MaxZ
            var f = ((otherObject.model.position[2] + otherObject.centroid[2] + otherObject.collider.length / 2.0) - rayPos[2]) / rayDir[2];

            var tnear = Math.max(Math.min(a, b), Math.min(c, d), Math.min(e, f))
            var tfar = Math.min(Math.max(a, b), Math.max(c, d), Math.max(e, f))

            // Hit
            if (tnear >= 0 && tnear <= tfar) {
              if (closestDistance > tnear || nearestObject == null) {
                closestDistance = tnear;
                nearestObject = otherObject;
              }
            }
          }
        });
        if (nearestObject != null) {
          if (nearestObject == this.state.camera) {
            // Angle enemy to player
            var cross = vec3.create();
            vec3.cross(cross, vec3.fromValues(enemy.forward[0], 0, enemy.forward[2]), vec3.fromValues(rayDir[0], 0, rayDir[2]));
            var angle = vec3.angle(vec3.fromValues(enemy.forward[0], 0, enemy.forward[2]), vec3.fromValues(rayDir[0], 0, rayDir[2]));

            // Sign of cross tells which way to turn, angle tells how much
            enemy.object.rotate('z', Math.sign(cross[1])*angle);
            vec3.copy(enemy.forward, rayDir);

            // Move enemy to player
            vec3.scale(rayDir, rayDir, deltaTime * this.currentLevel);
            vec3.add(enemy.object.model.position, enemy.object.model.position, rayDir);
            // Make it so enemy doesnt phase thru walls
            this.checkCollision(enemy.object);
          }
        }
      });
    }
  }
}