var state = {};
var game;
var sceneFile = "GameScene2.json"; // can change this to be the name of your scene
var uiFile = "ui1.json"; // can change this to be the name of your scene
const WALK_SPEED = 0.01;
const RUN_SPEED = 0.05;
var currentSpeed = 0.01;
const TIME_BETWEEN_GUNFIRE = 0.2;
const SHOOT_ANIMATION_TIME = 0.1;

// Camera Toggle from First-Person to Topdown
function toggleCameraView(state) {
  if (!state.originalCameraState) {
    console.error("Original camera state not saved!");
    return;
  }
  
  if (!state.isTopDownView) {
    // Switch to top-down view
    console.log("Switching to top-down view with orthographic projection");
    
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


// This function loads on window load, uses async functions to load the scene then try to render it
window.onload = async () => {
  try {
    console.log("Starting to load scene file");
    await parseSceneFile(`./statefiles/${sceneFile}`, state);
    state.camera.model = {
      "position": state.camera.position
    }
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
    in vec3 aNormal;
    in vec2 aUV; // Added UV input

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    out vec3 oNormal;
    out vec2 oUV; // Added UV output

    void main() {
        oNormal = normalize(uModelMatrix * vec4(aNormal,0.0)).xyz;
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
    uniform sampler2D uTexture;
    uniform vec3 cameraPosition;
    uniform float alphaVal;

    out vec4 fragColor;
    
    vec3 calculatePointLight(PointLight light, vec3 normal, vec3 fragPos) {
        vec3 lightDir = normalize(light.position - fragPos);
        
        // Diffuse only - no specular
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * light.colour * diffuseVal;
        
        // Attenuation
        float distance = length(light.position - fragPos);
        float attenuation = 1.0 / (1.0 + light.linear * distance + light.quadratic * (distance * distance));
        
        return diffuse * attenuation * light.strength;
    }
    
    void main() {
        vec4 baseColor = vec4(diffuseVal, alphaVal);
        
        if (samplerExists == 1) {
            baseColor = texture(uTexture, oUV);
            if (baseColor.a < 0.01) discard;
        }
        
        if (baseColor.a <= 0.0) discard;
        
        vec3 normal = normalize(oNormal);
        
        // Ambient lighting (10-20% of diffuse)
        vec3 result = ambientVal * diffuseVal * 0.15;
        
        // Add main light
        result += calculatePointLight(mainLight, normal, oFragPos);
        
        // Add other lights
        for(int i = 0; i < numLights; i++) {
            result += calculatePointLight(pointLights[i], normal, oFragPos);
        }
        
        // Apply texture/base color
        result *= baseColor.rgb;
        
        // Brightness adjustment (increase if too dark)
        result *= 1.5;
        
        // Ensure we don't exceed 1.0
        result = min(result, vec3(1.0));
        
        // Optional: gamma correction
        // result = pow(result, vec3(1.0/2.2));
        
        fragColor = vec4(result, baseColor.a * alphaVal);
    }
    `;

    const fragShaderUI =
    `#version 300 es
    precision highp float;
    
    uniform vec3 diffuseVal;
    uniform int samplerExists;
    uniform sampler2D uTexture;
    
    in vec2 oUV;
    out vec4 fragColor;
    
    void main() {
        if (samplerExists == 1) {
            vec4 texColor = texture(uTexture, oUV);
            // Skip fully transparent pixels
            if (texColor.a < 0.01) {
                discard;
            }
            fragColor = vec4(diffuseVal * texColor.rgb, texColor.a);
        } else {
            fragColor = vec4(diffuseVal, 1.0);
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
    canvas: canvas,
    objectCount: 0,
    lightIndices: [],
    keyboard: {},
    mouse: { sensitivity: 0.007 },
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
  gl.clearColor(state.settings.backgroundColor[0], state.settings.backgroundColor[1], state.settings.backgroundColor[2], 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearDepth(1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Separate opaque and transparent objects
  const opaqueObjects = [];
  const transparentObjects = [];
  
  state.objects.forEach(obj => {
    const alpha = obj.material?.alpha || 1.0;
    const hasTextureAlpha = obj.model?.texture ? true : false;
    
    if (alpha >= 0.99 && !hasTextureAlpha) {
      opaqueObjects.push(obj);
    } else {
      transparentObjects.push(obj);
    }
  });

  // Sort transparent objects by distance from camera 
  const sortedTransparent = transparentObjects.sort((a, b) => {
    const aDist = vec3.distance(state.camera.position, a.model.position);
    const bDist = vec3.distance(state.camera.position, b.model.position);
    return bDist - aDist; // Render farther objects first
  });

  // Combine all objects: opaque first, then transparent 
  const allObjects = [...opaqueObjects, ...sortedTransparent];

  // Render all scene objects
  allObjects.forEach((object) => {
    gl.useProgram(object.programInfo.program);
    
    // Projection Matrix
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
      gl.uniform3fv(object.programInfo.uniformLocations.cameraPosition, state.camera.position);
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
      gl.uniform3fv(object.programInfo.uniformLocations.cameraPosition, state.camera.position);
      state.viewMatrix = viewMatrix;
    }
    
    gl.uniformMatrix4fv(object.programInfo.uniformLocations.projection, false, projectionMatrix);
    state.projectionMatrix = projectionMatrix;

    // Model Matrix
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

    // Normal Matrix
    let normalMatrix = mat4.create();
    mat4.invert(normalMatrix, modelMatrix);
    mat4.transpose(normalMatrix, normalMatrix);
    gl.uniformMatrix4fv(object.programInfo.uniformLocations.normalMatrix, false, normalMatrix);

    // Object material
    gl.uniform3fv(object.programInfo.uniformLocations.diffuseVal, object.material.diffuse);
    gl.uniform3fv(object.programInfo.uniformLocations.ambientVal, object.material.ambient);
    gl.uniform3fv(object.programInfo.uniformLocations.specularVal, object.material.specular);
    gl.uniform1f(object.programInfo.uniformLocations.nVal, object.material.n);
    gl.uniform1f(object.programInfo.uniformLocations.alphaVal, object.material.alpha || 1.0);

    // Lighting uniforms
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

    // Bind the buffer 
    gl.bindVertexArray(object.buffers.vao);

    // Check for diffuse texture and apply it
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

    // Check for normal texture and apply it
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
    const offset = 0;
    if (object.type === "mesh" || object.type === "meshCustom") {
      gl.drawArrays(gl.TRIANGLES, offset, object.buffers.numVertices / 3);
    } else {
      gl.drawElements(gl.TRIANGLES, object.buffers.numVertices, gl.UNSIGNED_SHORT, offset);
    }
  });

  // Render UI elements (only in first-person view)
  if (!state.isTopDownView) {
    state.uiObjects.forEach((object) => {
      gl.useProgram(object.programInfo.program);
      gl.uniform3fv(object.programInfo.uniformLocations.diffuseVal, object.material.diffuse);
      
      if (object.name == "gunshot" && state.shootDuration > SHOOT_ANIMATION_TIME) {
        // Skip rendering gunshot when animation is done
      } else {
        gl.bindVertexArray(object.buffers.vao);
        const offset = 0;
        gl.drawElements(gl.TRIANGLES, object.buffers.numVertices, gl.UNSIGNED_SHORT, offset);
      }
    });
  }
}
