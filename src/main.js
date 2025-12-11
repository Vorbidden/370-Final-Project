var state = {};
var game;
var sceneFile = "GameScene2.json"; // can change this to be the name of your scene
var uiFile = "ui.json"; // can change this to be the name of your scene
const WALK_SPEED = 0.02;
const RUN_SPEED = 0.08;
var currentSpeed = 0.01;
const TIME_BETWEEN_GUNFIRE = 0.2;
const SHOOT_ANIMATION_TIME = 0.1;

// This function loads on window load, uses async functions to load the scene then try to render it
window.onload = async () => {
  try {
    console.log("Starting to load scene file");
    await parseSceneFile(`./statefiles/${sceneFile}`, state);
    state.camera.model = {
      "position": state.camera.position
    }
    state.camera.centroid = vec3.fromValues(0,0,0);
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

  // === SAVE ORIGINAL CAMERA STATE RIGHT AWAY ===
  // This should be the VERY FIRST thing you do with the camera
  state.originalCameraState = {
    position: vec3.clone(state.camera.position),
    front: vec3.clone(state.camera.front),
    up: vec3.clone(state.camera.up),
    modelPosition: vec3.clone(state.camera.model.position)
  };

  console.log("Saved original camera state:", state.originalCameraState.position);
  
  // Initialize isTopDownView if not already set
  if (state.isTopDownView === undefined) {
    state.isTopDownView = false;
  }

  // Key listener
  document.addEventListener('keydown', (event) => {
    state.keysPressed[event.key.toLowerCase()] = true;
    
    // Toggle camera view when 'M' is pressed
    if (event.key.toLowerCase() === 'm') {
      toggleCameraView(state);
    }
  });

  document.addEventListener('keyup', (event) => {
    delete state.keysPressed[event.key.toLowerCase()];
  });

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
    in vec2 aUV;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    out vec3 oNormal;
    out vec2 oUV;
    out vec3 oFragPos;

    void main() {
    // Transform position to world space
    vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
    oFragPos = worldPos.xyz;
    
    // Transform normal
    oNormal = mat3(transpose(inverse(uModelMatrix))) * aNormal;
    
    // Pass UV
        oUV = aUV;

    // Position in clip space
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    }
    `;

  const vertShaderUI =
    `#version 300 es
    in vec3 aPosition;
    in vec2 aUV; // Added UV input

    out vec2 oUV; // Added UV output

    void main() {
        // Position needs to be a vec4 with w as 1.0
        gl_Position = vec4(aPosition, 1.0);        
        oUV = aUV; // Pass through UVs    
    }
    `;

  const fragShaderSample =
  `#version 300 es
  #define MAX_LIGHTS 20
  precision highp float;
  in vec2 oUV;
  in vec3 oNormal;
  in vec3 oFragPos;

  struct PointLight {
      vec3 position;
      vec3 colour;
      float strength;
      float linear;
      float quadratic;
  };
  
  uniform PointLight mainLight;
  uniform PointLight pointLights[MAX_LIGHTS];
  uniform int numLights;
  uniform int samplerExists;
  uniform vec3 diffuseVal;
  uniform vec3 ambientVal;
  uniform vec3 specularVal;
  uniform float nVal;
  uniform sampler2D uTexture;
  uniform vec3 cameraPosition;
  uniform float alphaVal;

  out vec4 fragColor;
  
  vec3 calculatePointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir) {
      vec3 lightDir = normalize(light.position - fragPos);
      
      // Diffuse shading
      float diff = max(dot(normal, lightDir), 0.0);
      vec3 diffuse = diff * light.colour * diffuseVal;
      
      // Blinn-Phong specular shading
      vec3 halfwayDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfwayDir), 0.0), nVal * 4.0);
      vec3 specular = spec * light.colour * specularVal;
      
      // Attenuation
      float distance = length(light.position - fragPos);
      float attenuation = 1.0 / (1.0 + light.linear * distance + light.quadratic * (distance * distance));
      
      return (diffuse + specular) * attenuation * light.strength;
  }
  
  void main() {
      vec4 baseColor = vec4(diffuseVal, alphaVal);
      
      if (samplerExists == 1) {
          baseColor = texture(uTexture, oUV);
          if (baseColor.a < 0.01) discard;
      }
      
      if (baseColor.a <= 0.0) discard;
      
      vec3 normal = normalize(oNormal);
      vec3 viewDir = normalize(cameraPosition - oFragPos);
      
      // Ambient 
      vec3 result = ambientVal * diffuseVal * 0.15;
      
      // Add main light with Blinn-Phong
      result += calculatePointLight(mainLight, normal, oFragPos, viewDir);
      
      // Add other lights with Blinn-Phong
      for(int i = 0; i < numLights; i++) {
          result += calculatePointLight(pointLights[i], normal, oFragPos, viewDir);
      }
      
      // Texture/base color
      result *= baseColor.rgb;
      
      result *= 1.0;
      
      // Clamp
      result = min(result, vec3(1.0));
      
      fragColor = vec4(result, baseColor.a * alphaVal);
  }
  `;

    // Created because passing fragShaderSample when adding UI causes problems
    // Its just the old fragShaderSample function repurposed for the UI solely (Will change in the event of adding images for UI)  
    const fragShaderUI = `#version 300 es
    precision highp float;
    in vec2 oUV;

    uniform int samplerExists;
    uniform vec3 diffuseVal;
    uniform sampler2D uTexture;
    uniform float alphaVal;

    out vec4 fragColor;

    void main() {
    if (samplerExists == 1) {
      // Get texture color WITH ALPHA channel
      vec4 textureColor = texture(uTexture, oUV);
      
      // Apply tint color to RGB channels only
      vec3 tintedColor = diffuseVal * textureColor.rgb;
      
      // Use texture's alpha, modified by alphaVal uniform
      float finalAlpha = textureColor.a * alphaVal;
      
      // Discard fully transparent pixels for performance
      if (finalAlpha < 0.01) {
          discard;
      }
      
      fragColor = vec4(tintedColor, finalAlpha);
  } else {
      // Default solid color with alpha support
      fragColor = vec4(diffuseVal, alphaVal);
  }
}
`;

  /**
   * Initialize state with new values (some of these you can replace/change)
   */
  const savedOriginalCameraState = state.originalCameraState;
  const savedIsTopDownView = state.isTopDownView;

  state = {
    ...state, // this just takes what was already in state and applies it here again
    gl,
    projectionMode: "perspective", // "perspective" or "orthographic"
    orthographicSettings: {
      left: -50,
      right: 50,
      bottom: -50,
      top: 50,
      near: 0.1,
      far: 1000},
    vertShaderSample,
    fragShaderSample,
    vertShaderUI,
    fragShaderUI,
    canvas: canvas,
    objectCount: 0,
    lightIndices: [],
    keyboard: {},
    mouse: { sensitivity: 0.004 },
    meshCache: {},
    samplerExists: 0,
    samplerNormExists: 0,
    keysPressed: {},
    betweenShotsRecharge: 0.0,
    shootDuration: 0.1,
    collidersLoaded: 0,
    isTopDownView: savedIsTopDownView || false,
    originalCameraState: savedOriginalCameraState // Stores camera position before topdown
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
    addUIElement(element, state, vertShaderUI, fragShaderUI);
  }

  const then = new Date();
  const loadingTime = (then.getTime() - now.getTime()) / 1000;
  console.log(`Scene file loaded in ${loadingTime} seconds.`);

  game = new Game(state);
  await game.onStart();
  loadingPage.remove();

  /************************************
 * MOUSE STUFF
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
        if (state.isTopDownView) {
          return;
        }
        
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
  
  // Only allow movement when not in top-down view
  if (state.isTopDownView) {
    return;
  }

    let camFront = vec3.fromValues(0, 0, 0);
    vec3.add(camFront, state.camera.position, state.camera.front);
    if (state.keysPressed["shift"]) {
      currentSpeed = RUN_SPEED;
    } else {
      currentSpeed = WALK_SPEED;
    }
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

      vec3.add(state.camera.position, state.camera.position, vec3.fromValues(-currentSpeed*right[0], 0.0, -currentSpeed*right[2]));
      state.camera.model.position = state.camera.position
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

      vec3.add(state.camera.position, state.camera.position, vec3.fromValues(currentSpeed*right[0], 0.0, currentSpeed*right[2]));
      state.camera.model.position = state.camera.position
  }
  if (state.keysPressed["w"]) {
      // Move forwards
      var at = vec3.create();
      vec3.subtract(at, camFront, state.camera.position);
      at[1] = 0;
      vec3.normalize(at, at);

      vec3.add(state.camera.position, state.camera.position, vec3.fromValues(currentSpeed*at[0], 0.0, currentSpeed*at[2]));
      state.camera.model.position = state.camera.position
  }
  if (state.keysPressed["s"]) {
      // Move backwards
      var at = vec3.create();
      vec3.subtract(at, camFront, state.camera.position);
      at[1] = 0;
      vec3.normalize(at, at);

      vec3.add(state.camera.position, state.camera.position, vec3.fromValues(-currentSpeed*at[0], 0.0, -currentSpeed*at[2]));
      state.camera.model.position = state.camera.position
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

  // Render UI elements in first person
  if (!state.isTopDownView) {
    // Only renders UI in FP view
    
    // Transparency Rendering for UI

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);  // Don't write to depth buffer
    gl.disable(gl.DEPTH_TEST); // Optional: disable depth test for UI
    
  state.uiObjects.forEach((object) => {
    // Choose to use our shader
    gl.useProgram(object.programInfo.program);
    {
      // Set diffuse color
      gl.uniform3fv(object.programInfo.uniformLocations.diffuseVal, object.material.diffuse);
    }
    // Alpha
    {
    if (object.programInfo.uniformLocations.alphaVal) {
      const alpha = object.material.alpha !== undefined ? object.material.alpha : 1.0;
      gl.uniform1f(object.programInfo.uniformLocations.alphaVal, alpha);
    }
  }

  // Texture Sampler
  {  if (object.model.texture && object.programInfo.uniformLocations.samplerExists) {
      gl.uniform1i(object.programInfo.uniformLocations.samplerExists, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, object.model.texture);
      if (object.programInfo.uniformLocations.sampler) {
        gl.uniform1i(object.programInfo.uniformLocations.sampler, 0);
      }
    } else if (object.programInfo.uniformLocations.samplerExists) {
      gl.uniform1i(object.programInfo.uniformLocations.samplerExists, 0);
    }
  }

    {
      if (object.name == "gunshot" && state.shootDuration > SHOOT_ANIMATION_TIME) {
      } else {
        // Bind the buffer we want to draw
        gl.bindVertexArray(object.buffers.vao);

        // Draw the object
        const offset = 0; // Number of elements to skip before starting
        gl.drawElements(gl.TRIANGLES, object.buffers.numVertices, gl.UNSIGNED_SHORT, offset);
      }
    }

    // Cleanup
    {
  gl.depthMask(true);  // Restore depth writing
  gl.enable(gl.DEPTH_TEST); // Restore depth test
  gl.disable(gl.BLEND); // Turn off blending
    }
  });
  }

  // iterate over each object and render them
  sorted.map((object) => {
    gl.useProgram(object.programInfo.program);
    {
      // Projection Matrix ....
      let projectionMatrix = mat4.create();

      if (state.projectionMode === "orthographic" && state.isTopDownView) {
        // Orthographic projection for top-down view
        const ortho = state.orthographicSettings;
        projectionMatrix = createOrthographicMatrix(
          ortho.left, ortho.right, 
          ortho.bottom, ortho.top, 
          ortho.near, ortho.far
        );
        
        // Adjust view matrix for orthographic (top-down looking straight down)
        let viewMatrix = mat4.create();
        mat4.lookAt(
          viewMatrix,
          state.camera.position,
          [state.camera.position[0], 0, state.camera.position[2]], // Look at ground level
          [0, 0, -1] // Z is up for orthographic top-down
        );
        gl.uniformMatrix4fv(object.programInfo.uniformLocations.view, false, viewMatrix);
        state.viewMatrix = viewMatrix;
        
      } else {
        // Perspective projection for first-person view
        let fovy = 90.0 * Math.PI / 180.0;
        let aspect = state.canvas.clientWidth / state.canvas.clientHeight;
        let near = 0.1;
        let far = 1000000.0;

            mat4.perspective(projectionMatrix, fovy, aspect, near, far);
        
        // Regular view matrix for perspective
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
        state.viewMatrix = viewMatrix;
      }
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

      let mainLight = state.pointLights[0];
      
      gl.uniform3fv(gl.getUniformLocation(object.programInfo.program, 'mainLight.position'), mainLight.position);
      gl.uniform3fv(gl.getUniformLocation(object.programInfo.program, 'mainLight.colour'), mainLight.colour);
      gl.uniform1f(gl.getUniformLocation(object.programInfo.program, 'mainLight.strength'), mainLight.strength);

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
// Camera Toggle from First-Person to Topdown
function toggleCameraView(state) {
  if (!state.originalCameraState) {
    console.error("Original camera state not saved!");
    return;
  }
  
  if (!state.isTopDownView) {    
    // Save current position
    vec3.copy(state.originalCameraState.position, state.camera.position);
    vec3.copy(state.originalCameraState.front, state.camera.front);
    vec3.copy(state.originalCameraState.up, state.camera.up);
    vec3.copy(state.originalCameraState.modelPosition, state.camera.model.position);
    
    // Move camera to top-down position
    vec3.set(state.camera.position, 0, 50, 0); // Higher for better view
    vec3.set(state.camera.front, 0, -1, 0);
    vec3.set(state.camera.up, 0, 0, -1);
    vec3.set(state.camera.model.position, 0, 50, 0);
    
    // Switch to orthographic projection
    state.projectionMode = "orthographic";
    state.isTopDownView = true;
    
    // Disable pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  } else {
    // Switch back to first-person view
    console.log("Switching back to first-person view with perspective projection");
    
    // Restore original camera state
    vec3.copy(state.camera.position, state.originalCameraState.position);
    vec3.copy(state.camera.front, state.originalCameraState.front);
    vec3.copy(state.camera.up, state.originalCameraState.up);
    vec3.copy(state.camera.model.position, state.originalCameraState.modelPosition);
    
    // Switch back to perspective projection
    state.projectionMode = "perspective";
    state.isTopDownView = false;
    
    // Re-enable pointer lock
    if (!document.pointerLockElement && state.canvas) {
      state.canvas.requestPointerLock();
    }
  }
}

function createOrthographicMatrix(left, right, bottom, top, near, far) {
  const mat = mat4.create();
  
  mat[0] = 2 / (right - left);
  mat[1] = 0;
  mat[2] = 0;
  mat[3] = 0;
  
  mat[4] = 0;
  mat[5] = 2 / (top - bottom);
  mat[6] = 0;
  mat[7] = 0;
  
  mat[8] = 0;
  mat[9] = 0;
  mat[10] = -2 / (far - near);
  mat[11] = 0;
  
  mat[12] = -(right + left) / (right - left);
  mat[13] = -(top + bottom) / (top - bottom);
  mat[14] = -(far + near) / (far - near);
  mat[15] = 1;
  
  return mat;
}



