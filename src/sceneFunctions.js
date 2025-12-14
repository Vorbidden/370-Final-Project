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
function getRandomInt(max) {
  var result = Math.floor(Math.random() * max)
  if (result == max) {
    result -= 1;
  }
  return result;
}

function getPossibleSpawnLocations(num) {
  let xLocations = [-2.5,19.5,41.5];
  let zLocations = [24,2.5,-19.5];
  let locations = [];
  for (i=0; i < num; i++) {
    var tries = 0;
    var spawnLocation = vec3.fromValues(xLocations[getRandomInt(3)], 6, zLocations[getRandomInt(3)]);
    while (locations.find(a => a[0] == spawnLocation[0] && a[2] == spawnLocation[2]) != null && tries != 100) {
        spawnLocation = vec3.fromValues(xLocations[getRandomInt(3)], 6, zLocations[getRandomInt(3)]);
        tries += 1;
    }
    if (tries != 100) {
      locations.push(spawnLocation);
    }
  }
  return locations;
}
