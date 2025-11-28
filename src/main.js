var state = {};
var game;
var sceneFile = "gamescene.json"; // can change this to be the name of your scene
var uiFile = "ui1.json"; // can change this to be the name of your scene

// This function loads on window load, uses async functions to load the scene then try to render it
window.onload = async () => {
  try {
    console.log("Starting to load scene file");
    await parseSceneFile(`./statefiles/${sceneFile}`, state);
    await parseUIFile(`./statefiles/${uiFile}`, state);
    main();
  } catch (err) {
    console.error(err);
    alert(err);
  }
}

/**
 * 
 * @param {object - contains vertex, normal, uv information for the mesh to be made} mesh 
 * @param {object - the game object that will use the mesh information} object 
 * @purpose - Helper function called as a callback function when the mesh is done loading for the object
 */
async function createMesh(mesh, object, vertShader, fragShader) {
  let testModel = new Model(state.gl, object, mesh);
  testModel.vertShader = vertShader ? vertShader : state.vertShaderSample;
  testModel.fragShader = fragShader ? fragShader : state.fragShaderSample;
  await testModel.setup();
  addObjectToScene(state, testModel);
  return testModel;
}

/**
 * Main function that gets called when the DOM loads
 */
async function main() {
  //document.body.appendChild( stats.dom );
  const canvas = document.querySelector("#glCanvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Initialize the WebGL2 context
  var gl = canvas.getContext("webgl2");

  // Only continue if WebGL2 is available and working
  if (gl === null) {
    printError('WebGL 2 not supported by your browser',
      'Check to see you are using a <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API#WebGL_2_2" class="alert-link">modern browser</a>.');
    return;
  }

  canvas.addEventListener("click", async () => {
      if (!document.pointerLockElement) {
          try {
              await canvas.requestPointerLock({
                  unadjustedMovement: true,
              });
          } catch (error) {
              if (error.name === "NotSupportedError") {
                  // Some platforms may not support unadjusted movement.
                  await canvas.requestPointerLock();
              } else {
                  throw error;
              }
          }
      }
  });

  /**
   * Sample vertex and fragment shader here that simply applies MVP matrix 
   * and diffuse colour of each object
   */
  const vertShaderSample =
    `#version 300 es
        in vec3 aPosition;
        in vec3 aNormal;

        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;

        out vec3 oNormal;

        void main() {
            // Simply use this normal so no error is thrown
            oNormal = aNormal;

            // Postion of the fragment in world space
            gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
        }
        `;

  const vertShaderUI =
    `#version 300 es
    in vec3 aPosition;

    void main() {
        // Position needs to be a vec4 with w as 1.0
        gl_Position = vec4(aPosition, 1.0);        
    }
    `;

  const fragShaderSample =
    `#version 300 es
        #define MAX_LIGHTS 20
        precision highp float;

        uniform vec3 diffuseVal;

        out vec4 fragColor;
        void main() {
            fragColor = vec4(diffuseVal, 1.0);
        }
        `;

  /**
   * Initialize state with new values (some of these you can replace/change)
   */
  state = {
    ...state, // this just takes what was already in state and applies it here again
    gl,
    vertShaderSample,
    fragShaderSample,
    vertShaderUI,
    canvas: canvas,
    objectCount: 0,
    lightIndices: [],
    keyboard: {},
    mouse: { sensitivity: 0.007 },
    meshCache: {},
    samplerExists: 0,
    samplerNormExists: 0,
    keysPressed: {}
  };

  state.numLights = state.pointLights.length;

  const now = new Date();
  for (let i = 0; i < state.loadObjects.length; i++) {
    const object = state.loadObjects[i];

    if (object.type === "mesh") {
      await addMesh(object);
    } else if (object.type === "cube") {
      addCube(object, state);
    } else if (object.type === "plane") {
      addPlane(object, state);
    } else if (object.type.includes("Custom")) {
      addCustom(object, state);
    }
    //console.log(`loaded ${object.name};`);
  }
  
  for (var i = 0; i < state.loadUIObjects.length; i++) {
    const element = state.loadUIObjects[i];
    addUIElement(element, state, vertShaderUI, fragShaderSample);
  }

  const then = new Date();
  const loadingTime = (then.getTime() - now.getTime()) / 1000;
  console.log(`Scene file loaded in ${loadingTime} seconds.`);

  game = new Game(state);
  await game.onStart();
  loadingPage.remove();

  /************************************
 * MOUSE STUFF (I THINK I JUST COPY AND PASTED THIS FROM ONLINE, NO IDEA HOW IT WORKS JSUT DONT TOUCH IT)
 ************************************/
    document.addEventListener("pointerlockchange", lockChangeAlert, false);
    function lockChangeAlert() {
        if (document.pointerLockElement === canvas) {
            console.log("The pointer lock status is now locked");
            document.addEventListener("mousemove", updatePosition, false);
        } else {
            console.log("The pointer lock status is now unlocked");
            document.removeEventListener("mousemove", updatePosition, false);
        }
    }

    const tracker = document.getElementById("tracker");

    function updatePosition(e) {
        // update at = normalize(center - pos)
        let camFront = vec3.fromValues(0, 0, 0);
        vec3.add(camFront, state.camera.position, state.camera.front);
        if (e.movementX != 0) {
            var at = vec3.create();
            vec3.subtract(at, camFront, state.camera.position);
            vec3.normalize(at, at);

            // right = at X up
            var right = vec3.create();
            vec3.cross(right, at, state.camera.up);

            // center +- e * right
            vec3.scale(right, right, e.movementX * state.mouse.sensitivity)
            vec3.add(camFront, camFront, right)
            vec3.subtract(state.camera.front, camFront, state.camera.position);
            state.camera.up[1] = 10.0; // removes weird camera tilting
            vec3.normalize(state.camera.up, state.camera.up);
        }
        if (e.movementY != 0) {
            // center +- e * up
            var scaleUp = vec3.create();
            vec3.scale(scaleUp, state.camera.up, e.movementY  * -state.mouse.sensitivity);
            vec3.add(camFront, camFront, scaleUp);
            vec3.subtract(state.camera.front, camFront, state.camera.position);

            // update at = normalize(center - pos)
            var at = vec3.create();
            vec3.subtract(at, camFront, state.camera.position);
            vec3.normalize(at, at);

            // right = at X up
            var right = vec3.create();
            vec3.cross(right, at, state.camera.up);
            // up = right X at
            vec3.cross(state.camera.up, right, at);
            vec3.normalize(state.camera.up, state.camera.up);
            state.camera.up[1] = 10.0; // removes weird camera tilting
            vec3.normalize(state.camera.up, state.camera.up);
        }
    }
// END OF MOUSE STUFF

  startRendering(gl, state); // now that scene is setup, start rendering it
}

/**
 * 
 * @param {object - object containing scene values} state 
 * @param {object - the object to be added to the scene} object 
 * @purpose - Helper function for adding a new object to the scene and refreshing the GUI
 */
function addObjectToScene(state, object) {
  object.name = object.name;
  state.objects.push(object);
}

function addObjectToUI(state, object) {
  object.name = object.name;
  state.uiObjects.push(object);
}

/**
 * 
 * @param {gl context} gl 
 * @param {object - object containing scene values} state 
 * @purpose - Calls the drawscene per frame
 */
function startRendering(gl, state) {
  // A variable for keeping track of time between frames
  var then = 0.0;

  // This function is called when we want to render a frame to the canvas
  function render(now) {
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    then = now;

    state.deltaTime = deltaTime;
    handleMovement(state);
    drawScene(gl, deltaTime, state);
    game.onUpdate(deltaTime); //constantly call our game loop

    // Request another frame when this one is done
    requestAnimationFrame(render);
  }
  // Draw the scene
  requestAnimationFrame(render);
}

// Superior movement
function handleMovement(state) {
    let camFront = vec3.fromValues(0, 0, 0);
    vec3.add(camFront, state.camera.position, state.camera.front);
    if (state.keysPressed["a"]) {
      // Move left
      // at = normalize(center - pos)
      var at = vec3.create();
      vec3.subtract(at, camFront, state.camera.position);
      vec3.normalize(at, at);

      // right = at X up
      var right = vec3.create();
      vec3.cross(right, at, state.camera.up);
      right[1] = 0;
      vec3.normalize(right, right);

      //vec3.add(sta, camFront, vec3.fromValues(-0.01*right[0], 0.0, -0.01*right[2]));
      vec3.add(state.camera.position, state.camera.position, vec3.fromValues(-0.01*right[0], 0.0, -0.01*right[2]));
  }
  if (state.keysPressed["d"]) {
      // Move right
      // at = normalize(center - pos)
      var at = vec3.create();
      vec3.subtract(at, camFront, state.camera.position);
      vec3.normalize(at, at);

      // right = at X up
      var right = vec3.create();
      vec3.cross(right, at, state.camera.up);
      right[1] = 0;
      vec3.normalize(right, right);

      //vec3.add(camFront, camFront, vec3.fromValues(0.01*right[0], 0.0, 0.01*right[2]));
      vec3.add(state.camera.position, state.camera.position, vec3.fromValues(0.01*right[0], 0.0, 0.01*right[2]));
  }
  if (state.keysPressed["w"]) {
      // Move forwards
      var at = vec3.create();
      vec3.subtract(at, camFront, state.camera.position);
      at[1] = 0;
      vec3.normalize(at, at);
      //vec3.add(camFront, camFront, vec3.fromValues(0.01*at[0], 0.0, 0.01*at[2]));
      vec3.add(state.camera.position, state.camera.position, vec3.fromValues(0.01*at[0], 0.0, 0.01*at[2]));
  }
  if (state.keysPressed["s"]) {
      // Move backwards
      var at = vec3.create();
      vec3.subtract(at, camFront, state.camera.position);
      at[1] = 0;
      vec3.normalize(at, at);
      //vec3.add(camFront, camFront, vec3.fromValues(-0.01*at[0], 0.0, -0.01*at[2]));
      vec3.add(state.camera.position, state.camera.position, vec3.fromValues(-0.01*at[0], 0.0, -0.01*at[2]));
  }
}
/**
 * 
 * @param {gl context} gl 
 * @param {float - time from now-last} deltaTime 
 * @param {object - contains the state for the scene} state 
 * @purpose Iterate through game objects and render the objects aswell as update uniforms
 */
function drawScene(gl, deltaTime, state) {
  gl.clearColor(state.settings.backgroundColor[0], state.settings.backgroundColor[1], state.settings.backgroundColor[2], 1.0); // Here we are drawing the background color that is saved in our state
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things
  gl.disable(gl.CULL_FACE); // Cull the backface of our objects to be more efficient
  gl.cullFace(gl.BACK);
  // gl.frontFace(gl.CCW);
  gl.clearDepth(1.0); // Clear everything
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // sort objects by nearness to camera
  let sorted = state.objects.sort((a, b) => {
    let aCentroidFour = vec4.fromValues(a.centroid[0], a.centroid[1], a.centroid[2], 1.0);
    vec4.transformMat4(aCentroidFour, aCentroidFour, a.modelMatrix);

    let bCentroidFour = vec4.fromValues(b.centroid[0], b.centroid[1], b.centroid[2], 1.0);
    vec4.transformMat4(bCentroidFour, bCentroidFour, b.modelMatrix);

    return vec3.distance(state.camera.position, vec3.fromValues(aCentroidFour[0], aCentroidFour[1], aCentroidFour[2]))
      >= vec3.distance(state.camera.position, vec3.fromValues(bCentroidFour[0], bCentroidFour[1], bCentroidFour[2])) ? -1 : 1;
  });

  state.uiObjects.forEach((object) => {
    // Choose to use our shader
    gl.useProgram(object.programInfo.program);
    {
      gl.uniform3fv(object.programInfo.uniformLocations.diffuseVal, object.material.diffuse);
    }
    {
      // Bind the buffer we want to draw
      gl.bindVertexArray(object.buffers.vao);

      // Draw the object
      const offset = 0; // Number of elements to skip before starting
      gl.drawElements(gl.TRIANGLES, object.buffers.numVertices, gl.UNSIGNED_SHORT, offset);
    }
  });

  // iterate over each object and render them
  sorted.map((object) => {
    gl.useProgram(object.programInfo.program);
    {
      // Projection Matrix ....
      let projectionMatrix = mat4.create();
      let fovy = 90.0 * Math.PI / 180.0; // Vertical field of view in radians
      let aspect = state.canvas.clientWidth / state.canvas.clientHeight; // Aspect ratio of the canvas
      let near = 0.1; // Near clipping plane
      let far = 1000000.0; // Far clipping plane

      mat4.perspective(projectionMatrix, fovy, aspect, near, far);
      gl.uniformMatrix4fv(object.programInfo.uniformLocations.projection, false, projectionMatrix);
      state.projectionMatrix = projectionMatrix;

      // View Matrix & Camera ....
      let viewMatrix = mat4.create();
      let camFront = vec3.fromValues(0, 0, 0);
      vec3.add(camFront, state.camera.position, state.camera.front);
      mat4.lookAt(
        viewMatrix,
        state.camera.position,
        camFront,
        state.camera.up,
      );
      gl.uniformMatrix4fv(object.programInfo.uniformLocations.view, false, viewMatrix);
      gl.uniform3fv(object.programInfo.uniformLocations.cameraPosition, state.camera.position);
      state.viewMatrix = viewMatrix;

      // Model Matrix ....
      let modelMatrix = mat4.create();
      let negCentroid = vec3.fromValues(0.0, 0.0, 0.0);
      vec3.negate(negCentroid, object.centroid);
      mat4.translate(modelMatrix, modelMatrix, object.model.position);
      mat4.translate(modelMatrix, modelMatrix, object.centroid);
      mat4.mul(modelMatrix, modelMatrix, object.model.rotation);
      mat4.scale(modelMatrix, modelMatrix, object.model.scale);
      mat4.translate(modelMatrix, modelMatrix, negCentroid);

      if (object.parent) {
        let parent = getObject(state, object.parent);
        if (parent.model && parent.model.modelMatrix) {
          mat4.multiply(modelMatrix, parent.model.modelMatrix, modelMatrix);
        }
      }

      object.model.modelMatrix = modelMatrix;
      gl.uniformMatrix4fv(object.programInfo.uniformLocations.model, false, modelMatrix);

      // Normal Matrix ....
      let normalMatrix = mat4.create();
      mat4.invert(normalMatrix, modelMatrix);
      mat4.transpose(normalMatrix, normalMatrix);
      gl.uniformMatrix4fv(object.programInfo.uniformLocations.normalMatrix, false, normalMatrix);

      // Object material
      gl.uniform3fv(object.programInfo.uniformLocations.diffuseVal, object.material.diffuse);
      gl.uniform3fv(object.programInfo.uniformLocations.ambientVal, object.material.ambient);
      gl.uniform3fv(object.programInfo.uniformLocations.specularVal, object.material.specular);
      gl.uniform1f(object.programInfo.uniformLocations.nVal, object.material.n);

      gl.uniform1i(object.programInfo.uniformLocations.numLights, state.numLights);
      if (state.pointLights.length > 0) {
        for (let i = 0; i < state.pointLights.length; i++) {
          gl.uniform3fv(gl.getUniformLocation(object.programInfo.program, 'pointLights[' + i + '].position'), state.pointLights[i].position);
          gl.uniform3fv(gl.getUniformLocation(object.programInfo.program, 'pointLights[' + i + '].colour'), state.pointLights[i].colour);
          gl.uniform1f(gl.getUniformLocation(object.programInfo.program, 'pointLights[' + i + '].strength'), state.pointLights[i].strength);
          gl.uniform1f(gl.getUniformLocation(object.programInfo.program, 'pointLights[' + i + '].linear'), state.pointLights[i].linear);
          gl.uniform1f(gl.getUniformLocation(object.programInfo.program, 'pointLights[' + i + '].quadratic'), state.pointLights[i].quadratic);
        }
      }

      {
        // Bind the buffer we want to draw
        gl.bindVertexArray(object.buffers.vao);

        //check for diffuse texture and apply it
        if (object.model.texture != null) {
          state.samplerExists = 1;
          gl.activeTexture(gl.TEXTURE0);
          gl.uniform1i(object.programInfo.uniformLocations.samplerExists, state.samplerExists);
          gl.uniform1i(object.programInfo.uniformLocations.sampler, 0);
          gl.bindTexture(gl.TEXTURE_2D, object.model.texture);
        } else {
          gl.activeTexture(gl.TEXTURE0);
          state.samplerExists = 0;
          gl.uniform1i(object.programInfo.uniformLocations.samplerExists, state.samplerExists);
        }

        //check for normal texture and apply it
        if (object.model.textureNorm != null) {
          state.samplerNormExists = 1;
          gl.activeTexture(gl.TEXTURE1);
          gl.uniform1i(object.programInfo.uniformLocations.normalSamplerExists, state.samplerNormExists);
          gl.uniform1i(object.programInfo.uniformLocations.normalSampler, 1);
          gl.bindTexture(gl.TEXTURE_2D, object.model.textureNorm);
        } else {
          gl.activeTexture(gl.TEXTURE1);
          state.samplerNormExists = 0;
          gl.uniform1i(object.programInfo.uniformLocations.normalSamplerExists, state.samplerNormExists);
        }

        // Draw the object
        const offset = 0; // Number of elements to skip before starting

        //if its a mesh then we don't use an index buffer and use drawArrays instead of drawElements
        if (object.type === "mesh" || object.type === "meshCustom") {
          gl.drawArrays(gl.TRIANGLES, offset, object.buffers.numVertices / 3);
        } else {
          gl.drawElements(gl.TRIANGLES, object.buffers.numVertices, gl.UNSIGNED_SHORT, offset);
        }
      }
    }
  });
}
