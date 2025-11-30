class Game {
  constructor(state) {
    this.state = state;
    this.spawnedObjects = [];
    this.collidableObjects = [];
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
        if (object.name == "Camera" && otherObject.name == "Mazewall-copy-copy") {
          const potato = 1;
        }
        var a = object.model.position[0] + object.collider.width / 2.0 >= otherObject.model.position[0] - otherObject.collider.width / 2.0;
        var b = object.model.position[0] - object.collider.width / 2.0 <= otherObject.model.position[0] + otherObject.collider.width / 2.0;
        var c = object.model.position[1] + object.collider.height / 2.0 >= otherObject.model.position[1] - otherObject.collider.height / 2.0;
        var d = object.model.position[1] - object.collider.height / 2.0 <= otherObject.model.position[1] + otherObject.collider.height / 2.0;
        var e = object.model.position[2] + object.collider.length / 2.0 >= otherObject.model.position[2] - otherObject.collider.length / 2.0;
        var f = object.model.position[2] - object.collider.length / 2.0 <= otherObject.model.position[2] + otherObject.collider.length / 2.0;
        // MaxX to MinX
        if (a && b) {
          // MaxY to MinY
          if (c && d) { 
            // MaxZ to MinZ
            if (e && f) {
              console.log("IT WORKS FIRST TRY??");
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
    });

    // create the player collider
    this.createBoxCollider(this.state.camera, 0.1, 0.1, 0.1);
    this.collidableObjects.push(this.state.camera);

    // create the wall colliders
    this.state.objects.forEach(object => {
    if (object.type == "plane") {
      // NOTE: ALL PLANES ARE 0.5 IN LENGTH HEIGHT AND WIDTH BY DEFAULT
      // So just apply default size * scale
      var scaleMatrix = vec4.fromValues(object.model.scale[0],object.model.scale[1],object.model.scale[2], 1.0);
      vec4.transformMat4(scaleMatrix, scaleMatrix, object.model.rotation);
      var width = 0.5 * Math.abs(scaleMatrix[0]);
      var height = 0.5 * Math.abs(scaleMatrix[1]);
      var length = 0.5 * Math.abs(scaleMatrix[2]);

      console.log(object.name, width, height, length);
      this.createBoxCollider(object, width, height, length);
      this.collidableObjects.push(object);
      }
    });
    

    // example - set an object in onStart before starting our render loop!
    // this.cube = getObject(this.state, "cube1");
    // const otherCube = getObject(this.state, "cube2"); // we wont save this as instance var since we dont plan on using it in update

    // example - create sphere colliders on our two objects as an example, we give 2 objects colliders otherwise
    // no collision can happen
    // this.createSphereCollider(this.cube, 0.5, (otherObject) => {
    //   console.log(`This is a custom collision of ${otherObject.name}`)
    // });
    // this.createSphereCollider(otherCube, 0.5);



    //this.customMethod(); // calling our custom method! (we could put spawning logic, collision logic etc in there ;) )

    // example: spawn some stuff before the scene starts
    // for (let i = 0; i < 10; i++) {
    //     for (let j = 0; j < 10; j++) {
    //         for (let k = 0; k < 10; k++) {
    //             spawnObject({
    //                 name: `new-Object${i}${j}${k}`,
    //                 type: "cube",
    //                 material: {
    //                     diffuse: randomVec3(0, 1)
    //                 },
    //                 position: vec3.fromValues(4 - i, 5 - j, 10 - k),
    //                 scale: vec3.fromValues(0.5, 0.5, 0.5)
    //             }, this.state);
    //         }
    //     }
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


    // example - call our collision check method on our cube
    this.checkCollision(this.state.camera);
  }
}