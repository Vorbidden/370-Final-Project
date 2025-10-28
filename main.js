main();

/************************************
 * MAIN
 ************************************/


function main() {

    console.log("Setting up the canvas");

    // Find the canavas tag in the HTML document
    const canvas = document.querySelector("#assignmentCanvas");

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

    // NOTE: CANNOT AUTO LOAD JSON FILE WITHOUT SERVER
    let url = "arm.json";
    fetch(url, {
        mode: 'no-cors' // 'cors' by default
    }).then(res => {
        return res.text();
    }).then(data => {
        var inputTriangles = JSON.parse(data);

        doDrawing(gl, canvas, inputTriangles);

    }).catch((e) => {
        console.error(e);
    });
}

function doDrawing(gl, canvas, inputTriangles) {
    // Create a state for our scene

    var state = {
        camera: {
            position: vec3.fromValues(0.5, 0.5, -0.5),
            center: vec3.fromValues(0.5, 0.5, 0.0),
            up: vec3.fromValues(0.0, 1.0, 0.0),
        },
        objects: [],
        canvas: canvas,
        selectedIndex: 0,
        hasSelected: false,
        keysPressed: {}
    };

    for (var i = 0; i < inputTriangles.length; i++) {
        state.objects.push(
            {
                name: inputTriangles[i].name,
                model: {
                    position: vec3.fromValues(0.0, 0.0, 0.5),
                    rotation: mat4.create(), // Identity matrix
                    scale: vec3.fromValues(1.0, 1.0, 1.0),
                },
                // this will hold the shader info for each object
                programInfo: transformShader(gl),
                buffers: undefined,
                centroid: calculateCentroid(inputTriangles[i].vertices),
                materialColor: inputTriangles[i].material.diffuse,
                // TODO: Add more object specific state like material color, ...
            }
        );

        initBuffers(gl, state.objects[i], inputTriangles[i].vertices.flat(), inputTriangles[i].triangles.flat());
    }
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
        if (e.movementX != 0) {
            var at = vec3.create();
            vec3.subtract(at, state.camera.center, state.camera.position);
            vec3.normalize(at, at);

            // right = at X up
            var right = vec3.create();
            vec3.cross(right, at, state.camera.up);

            // center +- e * right
            vec3.scale(right, right, e.movementX * 0.001)
            vec3.add(state.camera.center, state.camera.center, right)
            state.camera.up[1] = 10.0;
            vec3.normalize(state.camera.up, state.camera.up);
        }
        if (e.movementY != 0) {
            // center +- e * up
            var scaleUp = vec3.create();
            vec3.scale(scaleUp, state.camera.up, e.movementY  * -0.001);
            vec3.add(state.camera.center, state.camera.center, scaleUp);

            // update at = normalize(center - pos)
            var at = vec3.create();
            vec3.subtract(at, state.camera.center, state.camera.position);
            vec3.normalize(at, at);

            // right = at X up
            var right = vec3.create();
            vec3.cross(right, at, state.camera.up);
            // up = right X at
            vec3.cross(state.camera.up, right, at);
            vec3.normalize(state.camera.up, state.camera.up);
            state.camera.up[1] = 10.0;
            vec3.normalize(state.camera.up, state.camera.up);
        }
    }

    setupKeypresses(state);

    //console.log(state)

    console.log("Starting rendering loop");
    startRendering(gl, state);
}


/************************************
 * RENDERING CALLS
 ************************************/

function startRendering(gl, state) {
    // A variable for keeping track of time between frames
    var then = 0.0;

    // This function is called when we want to render a frame to the canvas
    function render(now) {
        now *= 0.001; // convert to seconds
        const deltaTime = now - then;
        then = now;

        // Movement
        handleMovement(state);

        // Draw our scene
        drawScene(gl, deltaTime, state);

        // Request another frame when this one is done
        requestAnimationFrame(render);
    }

    // Draw the scene
    requestAnimationFrame(render);
}

/**
 * Draws the scene. Should be called every frame
 * 
 * @param  {} gl WebGL2 context
 * @param {number} deltaTime Time between each rendering call
 */
function drawScene(gl, deltaTime, state) {
    // Set clear colour
    // This is a Red-Green-Blue-Alpha colour
    // See https://en.wikipedia.org/wiki/RGB_color_model
    // Here we use floating point values. In other places you may see byte representation (0-255).
    gl.clearColor(0.5, 0.5, 0.5, 1.0);

    // Depth testing allows WebGL to figure out what order to draw our objects such that the look natural.
    // We want to draw far objects first, and then draw nearer objects on top of those to obscure them.
    // To determine the order to draw, WebGL can test the Z value of the objects.
    // The z-axis goes out of the screen
    gl.enable(gl.DEPTH_TEST); // Enable depth testing
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things
    gl.clearDepth(1.0); // Clear everything

    // Clear the color and depth buffer with specified clear colour.
    // This will replace everything that was in the previous frame with the clear colour.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    state.objects.forEach((object) => {
        // Choose to use our shader
        gl.useProgram(object.programInfo.program);

        // TODO Update uniforms with state variables values
        {
            // TODO setup projection matrix (this doesn't change)
            var projectionMatrix = mat4.create();
            // use same params as in the lab5 example
            // fovy = 60deg, near=0.1, far=100
            var fovy = 60.0 * Math.PI / 180.0;
            var aspect = state.canvas.clientWidth / state.canvas.clientHeight; // Aspect ratio of the canvas
            var near = 0.1; // Near clipping plane
            var far = 100.0; // Far clipping plane
            // Generate the projection matrix using perspective
            mat4.perspective(projectionMatrix, fovy, aspect, near, far);
            // link to corresponding uniform object.programInfo.uniformLocations.[...]

            gl.uniformMatrix4fv(object.programInfo.uniformLocations.projection, false, projectionMatrix);
            // TODO update view matrix with state.camera
            // use mat4.lookAt to generate the view matrix
            var viewMatrix = mat4.create();
            mat4.lookAt(
                viewMatrix,
                state.camera.position,
                state.camera.center,
                state.camera.up,
            );

            // link to corresponding uniform object.programInfo.uniformLocations.[...]
            gl.uniformMatrix4fv(object.programInfo.uniformLocations.view, false, viewMatrix);

            // TODO Update model transform
            // apply modeling transformations in correct order using
            // object.model.position, object.model.rotation, object.model.scale
            // for correct rotation wr centroid here is the order of operations 
            // in reverese order of how they should be applied 
            // translation (object.model.position), translation(centroid), rotation, scale, translation(negative certoid)

            var modelMatrix = mat4.create();
            mat4.translate(modelMatrix, modelMatrix, object.model.position);

            // move it to origin for rotation / scaling 
            mat4.translate(modelMatrix, modelMatrix, object.centroid);

            mat4.multiply(modelMatrix, modelMatrix, object.model.rotation);

            mat4.scale(modelMatrix, modelMatrix, object.model.scale);

            // move it back to its original position
            var negativeCentroid = vec3.create();
            vec3.scale(negativeCentroid, object.centroid, -1.0);
            mat4.translate(modelMatrix, modelMatrix, negativeCentroid);

            // link to corresponding uniform object.programInfo.uniformLocations.[...]
            gl.uniformMatrix4fv(object.programInfo.uniformLocations.model, false, modelMatrix);
            // TODO Update other uniforms like colors
            gl.uniform3fv(object.programInfo.uniformLocations.materialColor, object.materialColor);
        }
        // Draw 
        {
            // Bind the buffer we want to draw
            gl.bindVertexArray(object.buffers.vao);

            // Draw the object
            const offset = 0; // Number of elements to skip before starting
            gl.drawElements(gl.TRIANGLES, object.buffers.numVertices, gl.UNSIGNED_SHORT, offset);
        }
    });
}


/************************************
 * UI EVENTS
 ************************************/

function setupKeypresses(state) {
    document.addEventListener('keydown', (event) => {
        if (!event.repeat) {
            state.keysPressed[event.key] = true;
        }
    });

    document.addEventListener('keyup', (event) => {
        delete state.keysPressed[event.key];
    });
}

function handleMovement(state) {
    if (state.keysPressed["a"]) {
        // Move left
        // at = normalize(center - pos)
        var at = vec3.create();
        vec3.subtract(at, state.camera.center, state.camera.position);
        vec3.normalize(at, at);

        // right = at X up
        var right = vec3.create();
        vec3.cross(right, at, state.camera.up);
        right[1] = 0;
        vec3.normalize(right, right);

        vec3.add(state.camera.center, state.camera.center, vec3.fromValues(-0.01*right[0], 0.0, -0.01*right[2]));
        vec3.add(state.camera.position, state.camera.position, vec3.fromValues(-0.01*right[0], 0.0, -0.01*right[2]));
    }
    if (state.keysPressed["d"]) {
            // Move right
            // at = normalize(center - pos)
            var at = vec3.create();
            vec3.subtract(at, state.camera.center, state.camera.position);
            vec3.normalize(at, at);

            // right = at X up
            var right = vec3.create();
            vec3.cross(right, at, state.camera.up);
            right[1] = 0;
            vec3.normalize(right, right);

            vec3.add(state.camera.center, state.camera.center, vec3.fromValues(0.01*right[0], 0.0, 0.01*right[2]));
            vec3.add(state.camera.position, state.camera.position, vec3.fromValues(0.01*right[0], 0.0, 0.01*right[2]));
    }
    if (state.keysPressed["w"]) {
        // Move forwards
        var at = vec3.create();
        vec3.subtract(at, state.camera.center, state.camera.position);
        at[1] = 0;
        vec3.normalize(at, at);
        vec3.add(state.camera.center, state.camera.center, vec3.fromValues(0.01*at[0], 0.0, 0.01*at[2]));
        vec3.add(state.camera.position, state.camera.position, vec3.fromValues(0.01*at[0], 0.0, 0.01*at[2]));
    }
    if (state.keysPressed["s"]) {
        // Move backwards
        var at = vec3.create();
        vec3.subtract(at, state.camera.center, state.camera.position);
        at[1] = 0;
        vec3.normalize(at, at);
        vec3.add(state.camera.center, state.camera.center, vec3.fromValues(-0.01*at[0], 0.0, -0.01*at[2]));
        vec3.add(state.camera.position, state.camera.position, vec3.fromValues(-0.01*at[0], 0.0, -0.01*at[2]));
    }
}
/************************************
 * SHADER SETUP
 ************************************/
function transformShader(gl) {
    // Vertex shader source code
    const vsSource =
        `#version 300 es
    in vec3 aPosition;

    // TODO add uniforms for projection, view and model matrices
    // type uniform mat4 
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
 
    void main() {
        // Position needs to be a vec4 with w as 1.0
        // TODO apply transformation stored in uniforms 
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
    }
    `;

    // Fragment shader source code
    const fsSource =
        `#version 300 es
    precision highp float;

    out vec4 fragColor;
    
    // TODO: add uniform for object material color
    // type vec3 
    uniform vec3 obColor;
        
    void main() {
        // TODO: replace with corresponding color from uniform
        fragColor = vec4(obColor[0], obColor[1], obColor[2], 1.0);
    }
    `;

    // Create our shader program with our custom function
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    // Collect all the info needed to use the shader program.
    const programInfo = {
        // The actual shader program
        program: shaderProgram,
        // The attribute locations. WebGL will use there to hook up the buffers to the shader program.
        // NOTE: it may be wise to check if these calls fail by seeing that the returned location is not -1.
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aPosition'),
        },
        uniformLocations: {
            // TODO: add the locations for the 3 uniforms related to projection, view, modeling transforms
            projection: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            view: gl.getUniformLocation(shaderProgram, 'uViewMatrix'),
            model: gl.getUniformLocation(shaderProgram, 'uModelMatrix'),
            // TODO: Add location to additional uniforms here (ex related to material color)
            materialColor: gl.getUniformLocation(shaderProgram, 'obColor')
        },
    };

    // Check to see if we found the locations of our uniforms and attributes
    // Typos are a common source of failure
    // TODO add testes for all your uniform locations 
    if (programInfo.attribLocations.vertexPosition === -1 ||
        programInfo.uniformLocations.projection === -1 ||
        programInfo.uniformLocations.view === -1 ||
        programInfo.uniformLocations.model === -1 ||
        programInfo.uniformLocations.materialColor === -1) {
        printError('Shader Location Error', 'One or more of the uniform and attribute variables in the shaders could not be located');
    }

    return programInfo;
}

/************************************
 * BUFFER SETUP
 ************************************/

function initBuffers(gl, object, positionArray, indicesArray) {

    // We have 3 vertices with x, y, and z values
    const positions = new Float32Array(positionArray);

    // We are using gl.UNSIGNED_SHORT to enumerate the indices
    const indices = new Uint16Array(indicesArray);


    // Allocate and assign a Vertex Array Object to our handle
    var vertexArrayObject = gl.createVertexArray();

    // Bind our Vertex Array Object as the current used object
    gl.bindVertexArray(vertexArrayObject);

    object.buffers = {
        vao: vertexArrayObject,
        attributes: {
            position: initPositionAttribute(gl, object.programInfo, positions),
        },
        indices: initIndexBuffer(gl, indices),
        numVertices: indices.length,
    };
}

function initPositionAttribute(gl, programInfo, positionArray) {

    // Create a buffer for the positions.
    const positionBuffer = gl.createBuffer();

    // Select the buffer as the one to apply buffer
    // operations to from here out.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.
    gl.bufferData(
        gl.ARRAY_BUFFER, // The kind of buffer this is
        positionArray, // The data in an Array object
        gl.STATIC_DRAW // We are not going to change this data, so it is static
    );

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute.
    {
        const numComponents = 3; // pull out 3 values per iteration, ie vec3
        const type = gl.FLOAT; // the data in the buffer is 32bit floats
        const normalize = false; // don't normalize between 0 and 1
        const stride = 0; // how many bytes to get from one set of values to the next
        // Set stride to 0 to use type and numComponents above
        const offset = 0; // how many bytes inside the buffer to start from


        // Set the information WebGL needs to read the buffer properly
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset
        );
        // Tell WebGL to use this attribute
        gl.enableVertexAttribArray(
            programInfo.attribLocations.vertexPosition);
    }

    return positionBuffer;
}


function initColourAttribute(gl, programInfo, colourArray) {

    // Create a buffer for the positions.
    const colourBuffer = gl.createBuffer();

    // Select the buffer as the one to apply buffer
    // operations to from here out.
    gl.bindBuffer(gl.ARRAY_BUFFER, colourBuffer);

    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.
    gl.bufferData(
        gl.ARRAY_BUFFER, // The kind of buffer this is
        colourArray, // The data in an Array object
        gl.STATIC_DRAW // We are not going to change this data, so it is static
    );

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute.
    {
        const numComponents = 4; // pull out 4 values per iteration, ie vec4
        const type = gl.FLOAT; // the data in the buffer is 32bit floats
        const normalize = false; // don't normalize between 0 and 1
        const stride = 0; // how many bytes to get from one set of values to the next
        // Set stride to 0 to use type and numComponents above
        const offset = 0; // how many bytes inside the buffer to start from

        // Set the information WebGL needs to read the buffer properly
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexColour,
            numComponents,
            type,
            normalize,
            stride,
            offset
        );
        // Tell WebGL to use this attribute
        gl.enableVertexAttribArray(
            programInfo.attribLocations.vertexColour);
    }

    return colourBuffer;
}

function initIndexBuffer(gl, elementArray) {

    // Create a buffer for the positions.
    const indexBuffer = gl.createBuffer();

    // Select the buffer as the one to apply buffer
    // operations to from here out.
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER, // The kind of buffer this is
        elementArray, // The data in an Array object
        gl.STATIC_DRAW // We are not going to change this data, so it is static
    );

    return indexBuffer;
}

/**
 * 
 * @param {array of x,y,z vertices} vertices 
 */
function calculateCentroid(vertices) {

    var center = vec3.fromValues(0.0, 0.0, 0.0);
    for (let t = 0; t < vertices.length; t++) {
        vec3.add(center, center, vertices[t]);
    }
    vec3.scale(center, center, 1 / vertices.length);
    return center;

}
