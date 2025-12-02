function getObject(state, name) {
  let objectToFind = null;

  for (let i = 0; i < state.objects.length; i++) {
    if (state.objects[i].name === name) {
      objectToFind = state.objects[i];
      break;
    }
  }

  return objectToFind;
}

async function spawnObject(object, state) {
  if (object.type === "mesh") {
    return await addMesh(object);
  } else if (object.type === "cube") {
    return await addCube(object, state);
  } else if (object.type === "plane") {
    return await addPlane(object, state);
  } else if (object.type.includes("Custom")) {
    return await addCustom(object, state);
  }
}

function randomVec3(min, max) {
  return vec3.fromValues(
    Math.random(min, max),
    Math.random(min, max),
    Math.random(min, max),
  )
}

function getRandomPositionInBounds() {
  // room 1
  if (Math.random() < 0.5) {
    return vec3.fromValues(
      Math.random(-11.25, 11.25),
      3.6267051696777344,
      Math.random(-11.24999925494194, 10.829392370651476)
    );
  }
  // room 2
  return vec3.fromValues(
    Math.random(-11.25, 11.25),
    3.6267051696777344,
    Math.random(38.558009318687255, 86.24999925485463)
  );
}