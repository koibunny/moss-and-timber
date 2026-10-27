import * as THREE from 'three';
import { colorizeGeometry, mergeSimple, mergeTextured, transformGeometry } from '../core/geometry.js';
import { setObjectShadow } from '../core/materials.js';

const WIDTH = 7.2;
const DEPTH = 5.6;
const BASE_HEIGHT = 0.62;
const WALL_HEIGHT = 2.85;
const FLOOR_Y = BASE_HEIGHT;
const EAVES_Y = FLOOR_Y + WALL_HEIGHT;
const RIDGE_Y = 5.16;
const FRONT_Z = DEPTH / 2;
const BACK_Z = -DEPTH / 2;
const DOOR = { start: -2.0, end: -0.55, top: FLOOR_Y + 2.24, center: -1.275 };
const FRONT_WINDOW = {
  centerX: 1.52,
  bottom: FLOOR_Y + 1.38,
  top: FLOOR_Y + 2.46,
  height: 1.08,
  width: 1.08,
};
const SIDE_WINDOW = {
  centerZ: 1.15,
  bottom: FLOOR_Y + 1.38,
  top: FLOOR_Y + 2.46,
  height: 1.08,
  width: 1.02,
};

function addBox(parent, width, height, depth, material, x, y, z, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  if (options.rotation) {
    mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
  }
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function cutInterval(spans, start, end) {
  const result = [];
  for (const [a, b] of spans) {
    if (end <= a || start >= b) {
      result.push([a, b]);
      continue;
    }
    if (start - a > 0.12) result.push([a, start]);
    if (b - end > 0.12) result.push([end, b]);
  }
  return result;
}

function makeEndCap(radius, axis, x, y, z, direction) {
  const geometry = new THREE.CircleGeometry(radius * 0.87, 10);
  if (axis === 'x') {
    geometry.rotateY(direction > 0 ? Math.PI / 2 : -Math.PI / 2);
  } else {
    geometry.rotateY(direction > 0 ? 0 : Math.PI);
  }
  geometry.translate(x, y, z);
  return geometry;
}

function createFoundation(rng, textures) {
  const group = new THREE.Group();
  const stoneMaterial = new THREE.MeshStandardMaterial({
    map: textures.stone,
    color: 0xcfccbd,
    roughness: 0.98,
    metalness: 0,
    vertexColors: true,
    flatShading: true,
  });
  const core = addBox(
    group,
    WIDTH + 0.28,
    BASE_HEIGHT,
    DEPTH + 0.28,
    new THREE.MeshStandardMaterial({
      map: textures.stone,
      color: 0x77786c,
      roughness: 1,
      metalness: 0,
    }),
    0,
    BASE_HEIGHT / 2,
    0,
  );
  core.castShadow = true;
  core.receiveShadow = true;

  const baseStone = new THREE.DodecahedronGeometry(0.5, 0);
  const stones = [];
  const rows = [0.16, 0.44];
  const addStone = (x, y, z, rotation, sx, sy, sz) => {
    const geometry = baseStone.clone();
    geometry.scale(sx, sy, sz);
    geometry.rotateY(rotation);
    geometry.translate(x, y, z);
    const shade = rng.range(0.72, 1);
    const color = new THREE.Color(0xc8c5b6).multiplyScalar(shade);
    stones.push(colorizeGeometry(geometry, color));
  };

  for (const y of rows) {
    for (let i = 0; i < 12; i += 1) {
      const x = -WIDTH / 2 + 0.28 + (i / 11) * (WIDTH - 0.56);
      const z = FRONT_Z + 0.14 + rng.range(-0.04, 0.06);
      addStone(
        x,
        y + rng.range(-0.02, 0.02),
        z,
        rng.range(-0.2, 0.2),
        rng.range(0.27, 0.39),
        rng.range(0.16, 0.24),
        rng.range(0.16, 0.25),
      );
      addStone(
        x + rng.range(-0.03, 0.03),
        y + rng.range(-0.02, 0.02),
        BACK_Z - 0.14,
        rng.range(-0.2, 0.2),
        rng.range(0.27, 0.39),
        rng.range(0.16, 0.24),
        rng.range(0.16, 0.25),
      );
    }
    for (let i = 0; i < 8; i += 1) {
      const z = -DEPTH / 2 + 0.28 + (i / 7) * (DEPTH - 0.56);
      addStone(
        -WIDTH / 2 - 0.14,
        y + rng.range(-0.02, 0.02),
        z,
        rng.range(-0.2, 0.2),
        rng.range(0.18, 0.27),
        rng.range(0.16, 0.23),
        rng.range(0.28, 0.4),
      );
      addStone(
        WIDTH / 2 + 0.14,
        y + rng.range(-0.02, 0.02),
        z + rng.range(-0.03, 0.03),
        rng.range(-0.2, 0.2),
        rng.range(0.18, 0.27),
        rng.range(0.16, 0.23),
        rng.range(0.28, 0.4),
      );
    }
  }

  const geometry = mergeSimple(stones);
  const stoneMesh = new THREE.Mesh(geometry, stoneMaterial);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);

  addBox(
    group,
    WIDTH + 0.38,
    0.11,
    DEPTH + 0.38,
    new THREE.MeshStandardMaterial({
      map: textures.darkWood,
      color: 0x8a735c,
      roughness: 0.9,
      metalness: 0,
    }),
    0,
    BASE_HEIGHT + 0.02,
    0,
  );

  return group;
}

function createLogWalls(rng, textures) {
  const group = new THREE.Group();
  const logMaterial = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0xd1b89a,
    roughness: 0.86,
    metalness: 0,
    vertexColors: true,
  });
  const capMaterial = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0xdcbf93,
    roughness: 0.82,
    metalness: 0,
  });

  const backing = addBox(
    group,
    WIDTH - 0.28,
    WALL_HEIGHT + 0.15,
    DEPTH - 0.28,
    new THREE.MeshStandardMaterial({
      color: 0x22170f,
      roughness: 1,
      metalness: 0,
    }),
    0,
    FLOOR_Y + WALL_HEIGHT / 2,
    0,
  );
  backing.castShadow = false;

  const logGeometries = [];
  const capGeometries = [];
  const spacing = 0.305;
  const rowCount = 9;
  const radius = 0.157;

  const addTintedLog = (geometry) => {
    const tint = new THREE.Color(0xffffff).multiplyScalar(rng.range(0.68, 1));
    tint.offsetHSL(rng.range(-0.012, 0.012), rng.range(-0.035, 0.035), 0);
    logGeometries.push(colorizeGeometry(geometry, tint));
  };

  for (let row = 0; row < rowCount; row += 1) {
    const y = FLOOR_Y + 0.18 + row * spacing;
    let frontSpans = [[-WIDTH / 2 - 0.3, WIDTH / 2 + 0.3]];
    if (y < DOOR.top) frontSpans = cutInterval(frontSpans, DOOR.start, DOOR.end);
    if (y > FRONT_WINDOW.bottom - 0.02 && y < FRONT_WINDOW.top + 0.02) {
      frontSpans = cutInterval(
        frontSpans,
        FRONT_WINDOW.centerX - FRONT_WINDOW.width / 2 - 0.05,
        FRONT_WINDOW.centerX + FRONT_WINDOW.width / 2 + 0.05,
      );
    }
    for (const [a, b] of frontSpans) {
      if (b - a < 0.18) continue;
      const length = b - a;
      const actualRadius = radius * rng.range(0.92, 1.06);
      const geometry = new THREE.CylinderGeometry(
        actualRadius,
        actualRadius * 1.015,
        length,
        10,
        1,
        false,
      );
      geometry.rotateZ(Math.PI / 2);
      geometry.translate((a + b) / 2, y, FRONT_Z);
      addTintedLog(geometry);
    }

    const back = new THREE.CylinderGeometry(radius, radius * 1.015, WIDTH + 0.6, 10, 1, false);
    back.rotateZ(Math.PI / 2);
    back.translate(0, y, BACK_Z);
    addTintedLog(back);

    const sideY = y + spacing * 0.5;
    for (const sideX of [-WIDTH / 2, WIDTH / 2]) {
      let spans = [[-DEPTH / 2 - 0.32, DEPTH / 2 + 0.32]];
      if (sideX > 0 && sideY > SIDE_WINDOW.bottom - 0.02 && sideY < SIDE_WINDOW.top + 0.02) {
        spans = cutInterval(
          spans,
          SIDE_WINDOW.centerZ - SIDE_WINDOW.width / 2 - 0.04,
          SIDE_WINDOW.centerZ + SIDE_WINDOW.width / 2 + 0.04,
        );
      }
      for (const [a, b] of spans) {
        if (b - a < 0.18) continue;
        const length = b - a;
        const actualRadius = radius * rng.range(0.92, 1.06);
        const geometry = new THREE.CylinderGeometry(
          actualRadius,
          actualRadius * 1.015,
          length,
          10,
          1,
          false,
        );
        geometry.rotateX(Math.PI / 2);
        geometry.translate(sideX, sideY, (a + b) / 2);
        addTintedLog(geometry);
      }
    }
  }

  // End grain caps at the four visible corners.
  for (let row = 0; row < rowCount; row += 1) {
    const y = FLOOR_Y + 0.18 + row * spacing;
    for (const x of [-WIDTH / 2 - 0.3, WIDTH / 2 + 0.3]) {
      capGeometries.push(makeEndCap(radius, 'x', x, y, FRONT_Z, x > 0 ? 1 : -1));
      capGeometries.push(makeEndCap(radius, 'x', x, y, BACK_Z, x > 0 ? 1 : -1));
    }
    const sideY = y + spacing * 0.5;
    for (const z of [-DEPTH / 2 - 0.32, DEPTH / 2 + 0.32]) {
      capGeometries.push(makeEndCap(radius, 'z', WIDTH / 2, sideY, z, z > 0 ? 1 : -1));
      capGeometries.push(makeEndCap(radius, 'z', -WIDTH / 2, sideY, z, z > 0 ? 1 : -1));
    }
  }

  const logMesh = new THREE.Mesh(mergeTextured(logGeometries), logMaterial);
  logMesh.castShadow = true;
  logMesh.receiveShadow = true;
  group.add(logMesh);

  const capMesh = new THREE.Mesh(mergeTextured(capGeometries), capMaterial);
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;
  group.add(capMesh);

  return group;
}

function createGables(rng, textures) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x9f8468,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const shape = new THREE.Shape();
  shape.moveTo(-WIDTH / 2, 0);
  shape.lineTo(WIDTH / 2, 0);
  shape.lineTo(0, RIDGE_Y - EAVES_Y);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.translate(0, EAVES_Y, 0);

  for (const z of [FRONT_Z + 0.01, BACK_Z - 0.01]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a281d,
    roughness: 0.92,
    metalness: 0,
  });
  const beamLength = Math.hypot(WIDTH / 2, RIDGE_Y - EAVES_Y);
  const angle = Math.atan2(RIDGE_Y - EAVES_Y, WIDTH / 2);

  for (const z of [FRONT_Z + 0.07, BACK_Z - 0.07]) {
    for (const sign of [-1, 1]) {
      const beam = addBox(
        group,
        0.13,
        beamLength,
        0.12,
        trimMaterial,
        (sign * WIDTH) / 4,
        EAVES_Y + (RIDGE_Y - EAVES_Y) / 2,
        z,
        { rotation: [0, 0, sign * (Math.PI / 2 - angle)] },
      );
      beam.castShadow = true;
    }
    addBox(
      group,
      0.12,
      RIDGE_Y - EAVES_Y,
      0.1,
      trimMaterial,
      0,
      EAVES_Y + (RIDGE_Y - EAVES_Y) / 2,
      z,
    );
    addBox(group, WIDTH - 0.4, 0.12, 0.1, trimMaterial, 0, EAVES_Y + 0.02, z);
  }

  // Round attic window on the front gable.
  const atticY = EAVES_Y + (RIDGE_Y - EAVES_Y) * 0.47;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.055, 7, 26),
    trimMaterial,
  );
  ring.position.set(0, atticY, FRONT_Z + 0.1);
  ring.castShadow = true;
  group.add(ring);

  const atticGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.33, 24),
    new THREE.MeshStandardMaterial({
      color: 0x17140f,
      emissive: 0xffa45c,
      emissiveIntensity: 0.22,
      roughness: 0.35,
      metalness: 0.05,
    }),
  );
  atticGlass.position.set(0, atticY, FRONT_Z + 0.09);
  group.add(atticGlass);
  const spokeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2118,
    roughness: 0.9,
  });
  addBox(group, 0.035, 0.62, 0.03, spokeMaterial, 0, atticY, FRONT_Z + 0.13, {
    castShadow: false,
  });
  addBox(group, 0.62, 0.035, 0.03, spokeMaterial, 0, atticY, FRONT_Z + 0.13, {
    castShadow: false,
  });

  return group;
}

function createMossClumpGeometry(rng, width, length, count, baseY) {
  const geometries = [];
  const base = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < count; i += 1) {
    const sx = rng.range(0.14, 0.58);
    const sy = rng.range(0.035, 0.095);
    const sz = rng.range(0.15, 0.72);
    const geometry = base.clone();
    geometry.scale(sx, sy, sz);
    geometry.rotateY(rng.range(0, Math.PI * 2));
    geometry.translate(
      rng.range(-width / 2 + 0.15, width / 2 - 0.15),
      baseY + rng.range(-0.01, 0.04),
      rng.range(-length / 2 + 0.1, length / 2 - 0.1),
    );
    const color = new THREE.Color().setHSL(
      rng.range(0.21, 0.27),
      rng.range(0.36, 0.56),
      rng.range(0.18, 0.32),
      THREE.SRGBColorSpace,
    );
    geometries.push(colorizeGeometry(geometry, color));
  }
  return mergeSimple(geometries);
}

function createRoof(rng, textures) {
  const group = new THREE.Group();
  const overhang = 0.74;
  const run = DEPTH / 2 + overhang;
  const rise = RIDGE_Y - EAVES_Y;
  const slopeLength = Math.hypot(run, rise);
  const pitch = Math.atan2(rise, run);
  const roofWidth = WIDTH + 1.55;

  const baseMaterial = new THREE.MeshStandardMaterial({
    map: textures.darkWood,
    color: 0x8b7b68,
    roughness: 0.95,
    metalness: 0,
  });
  const mossMaterial = new THREE.MeshStandardMaterial({
    map: textures.moss,
    color: 0x76825a,
    roughness: 1,
    metalness: 0,
  });
  const clumpMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    map: textures.darkWood,
    color: 0x6c5946,
    roughness: 0.95,
    metalness: 0,
  });

  const makeSlope = (sign) => {
    const slope = new THREE.Group();
    slope.position.set(0, (RIDGE_Y + EAVES_Y) / 2, (sign * run) / 2);
    slope.rotation.x = sign * pitch;

    const roofBox = new THREE.Mesh(
      new THREE.BoxGeometry(roofWidth, 0.17, slopeLength),
      baseMaterial,
    );
    roofBox.castShadow = true;
    roofBox.receiveShadow = true;
    slope.add(roofBox);

    const mossTop = new THREE.Mesh(
      new THREE.PlaneGeometry(roofWidth - 0.03, slopeLength - 0.03),
      mossMaterial,
    );
    mossTop.rotation.x = -Math.PI / 2;
    mossTop.position.y = 0.087;
    mossTop.receiveShadow = true;
    slope.add(mossTop);

    const clumps = new THREE.Mesh(
      createMossClumpGeometry(rng, roofWidth - 0.2, slopeLength - 0.12, 105, 0.09),
      clumpMaterial,
    );
    clumps.castShadow = true;
    clumps.receiveShadow = true;
    slope.add(clumps);

    addBox(
      slope,
      roofWidth + 0.06,
      0.16,
      0.18,
      edgeMaterial,
      0,
      -0.02,
      slopeLength / 2 - 0.02,
    );
    addBox(
      slope,
      0.11,
      0.22,
      slopeLength,
      edgeMaterial,
      -roofWidth / 2 + 0.02,
      -0.01,
      0,
    );
    addBox(
      slope,
      0.11,
      0.22,
      slopeLength,
      edgeMaterial,
      roofWidth / 2 - 0.02,
      -0.01,
      0,
    );

    group.add(slope);
  };

  makeSlope(1);
  makeSlope(-1);

  const ridgeMaterial = new THREE.MeshStandardMaterial({
    map: textures.darkWood,
    color: 0x7e6a53,
    roughness: 0.94,
    metalness: 0,
  });
  const ridge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, roofWidth + 0.1, 8),
    ridgeMaterial,
  );
  ridge.rotation.z = Math.PI / 2;
  ridge.position.y = RIDGE_Y + 0.08;
  ridge.castShadow = true;
  ridge.receiveShadow = true;
  group.add(ridge);

  const ridgeMoss = new THREE.Mesh(
    createMossClumpGeometry(rng, roofWidth, 0.5, 34, 0),
    clumpMaterial,
  );
  ridgeMoss.position.set(0, RIDGE_Y + 0.17, 0);
  ridgeMoss.castShadow = true;
  group.add(ridgeMoss);

  return group;
}

function createDoor(rng, textures) {
  const group = new THREE.Group();
  const doorMaterial = new THREE.MeshStandardMaterial({
    map: textures.darkWood,
    color: 0x947557,
    roughness: 0.9,
    metalness: 0,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x39271b,
    roughness: 0.9,
    metalness: 0,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xb08a55,
    roughness: 0.4,
    metalness: 0.7,
  });

  const panelWidth = DOOR.end - DOOR.start - 0.16;
  const panelHeight = 2.09;
  const centerX = (DOOR.start + DOOR.end) / 2;
  const panelZ = FRONT_Z - 0.035;

  const boards = [];
  const boardCount = 5;
  for (let i = 0; i < boardCount; i += 1) {
    const width = panelWidth / boardCount - 0.014;
    const x = centerX - panelWidth / 2 + (i + 0.5) * (panelWidth / boardCount);
    boards.push(
      transformGeometry(new THREE.BoxGeometry(width, panelHeight, 0.065), {
        position: [x, FLOOR_Y + 0.09 + panelHeight / 2, panelZ],
      }),
    );
  }
  const boardMesh = new THREE.Mesh(mergeTextured(boards), doorMaterial);
  boardMesh.castShadow = true;
  boardMesh.receiveShadow = true;
  group.add(boardMesh);

  for (const y of [FLOOR_Y + 0.52, FLOOR_Y + 1.55]) {
    addBox(group, panelWidth - 0.05, 0.12, 0.075, doorMaterial, centerX, y, panelZ + 0.05);
  }
  const brace = addBox(
    group,
    panelWidth - 0.16,
    0.105,
    0.05,
    doorMaterial,
    centerX,
    FLOOR_Y + 1.04,
    panelZ + 0.09,
    { rotation: [0, 0, 0.54] },
  );
  brace.castShadow = true;

  const doorGlassMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc67d,
    emissive: 0xff9e4b,
    emissiveIntensity: 1.0,
    roughness: 0.3,
    metalness: 0,
    transparent: true,
    opacity: 0.96,
  });
  const doorWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.44), doorGlassMaterial);
  doorWindow.position.set(centerX, FLOOR_Y + 1.91, panelZ + 0.075);
  doorWindow.castShadow = false;
  group.add(doorWindow);
  addBox(group, 0.5, 0.065, 0.09, frameMaterial, centerX, FLOOR_Y + 2.17, panelZ + 0.1);
  addBox(group, 0.5, 0.065, 0.09, frameMaterial, centerX, FLOOR_Y + 1.65, panelZ + 0.1);
  addBox(group, 0.065, 0.58, 0.09, frameMaterial, centerX - 0.23, FLOOR_Y + 1.91, panelZ + 0.1);
  addBox(group, 0.065, 0.58, 0.09, frameMaterial, centerX + 0.23, FLOOR_Y + 1.91, panelZ + 0.1);
  addBox(group, 0.03, 0.44, 0.05, frameMaterial, centerX, FLOOR_Y + 1.91, panelZ + 0.11, {
    castShadow: false,
  });
  addBox(group, 0.4, 0.03, 0.05, frameMaterial, centerX, FLOOR_Y + 1.91, panelZ + 0.11, {
    castShadow: false,
  });
  group.userData.doorGlassMaterial = doorGlassMaterial;

  const doorLight = new THREE.PointLight(0xffb168, 1.5, 3.4, 2);
  doorLight.position.set(centerX, FLOOR_Y + 1.55, FRONT_Z + 0.48);
  group.add(doorLight);
  group.userData.doorLight = doorLight;

  addBox(group, 0.13, 2.32, 0.18, frameMaterial, DOOR.start - 0.045, FLOOR_Y + 1.16, FRONT_Z + 0.08);
  addBox(group, 0.13, 2.32, 0.18, frameMaterial, DOOR.end + 0.045, FLOOR_Y + 1.16, FRONT_Z + 0.08);
  addBox(
    group,
    DOOR.end - DOOR.start + 0.2,
    0.15,
    0.2,
    frameMaterial,
    centerX,
    DOOR.top + 0.04,
    FRONT_Z + 0.08,
  );

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 18), metalMaterial);
  handle.position.set(DOOR.end - 0.14, FLOOR_Y + 1.03, panelZ + 0.13);
  handle.castShadow = true;
  group.add(handle);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), metalMaterial);
  knob.position.set(DOOR.end - 0.14, FLOOR_Y + 1.11, panelZ + 0.13);
  group.add(knob);

  // Rough stone threshold and two worn steps.
  const stoneStepMaterial = new THREE.MeshStandardMaterial({
    map: textures.stone,
    color: 0xa5a18e,
    roughness: 1,
    metalness: 0,
  });
  addBox(group, 1.65, 0.16, 0.62, stoneStepMaterial, centerX, 0.09, FRONT_Z + 0.42, {
    rotation: [0, 0.028, 0],
  });
  addBox(group, 1.9, 0.12, 0.55, stoneStepMaterial, centerX - 0.02, 0.045, FRONT_Z + 0.93, {
    rotation: [0, -0.018, 0],
  });

  return group;
}

function createWindowAssembly({
  group,
  width,
  height,
  glassMaterial,
  frameMaterial,
  sillMaterial,
  position,
  rotationY = 0,
  glowLight,
  glowColor = 0xffb168,
}) {
  const assembly = new THREE.Group();
  assembly.position.set(position[0], position[1], position[2]);
  assembly.rotation.y = rotationY;

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.07, height - 0.07), glassMaterial);
  glass.position.z = -0.01;
  glass.castShadow = false;
  assembly.add(glass);

  const bar = 0.07;
  const depth = 0.13;
  addBox(assembly, width + 0.13, bar, depth, frameMaterial, 0, height / 2 + 0.03, 0.07);
  addBox(assembly, width + 0.13, bar, depth, frameMaterial, 0, -height / 2 - 0.03, 0.07);
  addBox(assembly, bar, height + 0.13, depth, frameMaterial, -width / 2 - 0.03, 0, 0.07);
  addBox(assembly, bar, height + 0.13, depth, frameMaterial, width / 2 + 0.03, 0, 0.07);

  addBox(assembly, 0.035, height, 0.075, frameMaterial, 0, 0, 0.1, { castShadow: false });
  addBox(assembly, width, 0.035, 0.075, frameMaterial, 0, 0, 0.1, { castShadow: false });

  addBox(assembly, width + 0.26, 0.1, 0.3, sillMaterial, 0, -height / 2 - 0.13, 0.14);
  addBox(assembly, width + 0.18, 0.09, 0.2, frameMaterial, 0, height / 2 + 0.135, 0.08);

  if (glowLight) {
    const light = new THREE.PointLight(glowColor, glowLight, 6.2, 2);
    light.position.set(0, 0.05, 0.7);
    assembly.add(light);
    assembly.userData.glowLight = light;
    assembly.userData.glowLightBase = glowLight;
  }

  group.add(assembly);
  return assembly;
}

function createWindows(rng, textures) {
  const group = new THREE.Group();
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc27c,
    emissive: 0xff9e4b,
    emissiveIntensity: 1.28,
    roughness: 0.28,
    metalness: 0,
    transparent: true,
    opacity: 0.97,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d2a1e,
    roughness: 0.88,
    metalness: 0,
  });
  const sillMaterial = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x8b6c50,
    roughness: 0.9,
    metalness: 0,
  });

  const frontWindow = createWindowAssembly({
    group,
    width: FRONT_WINDOW.width,
    height: FRONT_WINDOW.height,
    glassMaterial,
    frameMaterial,
    sillMaterial,
    position: [FRONT_WINDOW.centerX, (FRONT_WINDOW.bottom + FRONT_WINDOW.top) / 2, FRONT_Z + 0.03],
    glowLight: 4.4,
  });

  const sideWindow = createWindowAssembly({
    group,
    width: SIDE_WINDOW.width,
    height: SIDE_WINDOW.height,
    glassMaterial,
    frameMaterial,
    sillMaterial,
    position: [WIDTH / 2 + 0.03, (SIDE_WINDOW.bottom + SIDE_WINDOW.top) / 2, SIDE_WINDOW.centerZ],
    rotationY: Math.PI / 2,
    glowLight: 2.6,
  });

  return {
    group,
    glassMaterial,
    glows: [frontWindow, sideWindow],
  };
}

function createLantern(glowMaterials) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: 0x2b241c,
    roughness: 0.5,
    metalness: 0.48,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xffd39a,
    emissive: 0xffa14f,
    emissiveIntensity: 1.95,
    roughness: 0.2,
    metalness: 0,
  });
  glowMaterials.push({ material: glass, base: 1.95 });

  const x = -0.18;
  const z = FRONT_Z + 0.36;
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.58, 4), metal);
  chain.position.set(x, EAVES_Y - 0.25, z);
  chain.castShadow = true;
  group.add(chain);
  const chain2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 4), metal);
  chain2.position.set(x, EAVES_Y - 0.69, z);
  group.add(chain2);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.31, 0.22), glass);
  body.position.set(x, EAVES_Y - 1.03, z);
  body.castShadow = false;
  group.add(body);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.06, 4), metal);
  base.rotation.y = Math.PI / 4;
  base.position.set(x, EAVES_Y - 1.23, z);
  base.castShadow = true;
  group.add(base);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 4), metal);
  cap.rotation.y = Math.PI / 4;
  cap.position.set(x, EAVES_Y - 0.82, z);
  cap.castShadow = true;
  group.add(cap);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(group, 0.022, 0.36, 0.022, metal, x + sx * 0.12, EAVES_Y - 1.03, z + sz * 0.12, {
        castShadow: false,
      });
    }
  }

  const light = new THREE.PointLight(0xffb46c, 2.2, 4.2, 2);
  light.position.set(x, EAVES_Y - 1.02, z + 0.08);
  group.add(light);

  return { group, light };
}

function createBench(textures) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    map: textures.darkWood,
    color: 0x8a6f54,
    roughness: 0.92,
    metalness: 0,
  });
  const pieces = [];
  const x = -3.0;
  const z = FRONT_Z + 0.93;
  const y = 0.1;

  pieces.push(
    transformGeometry(new THREE.BoxGeometry(1.28, 0.09, 0.4), {
      position: [x, y + 0.5, z],
    }),
  );
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      pieces.push(
        transformGeometry(new THREE.BoxGeometry(0.09, 0.48, 0.09), {
          position: [x + sx * 0.52, y + 0.25, z + sz * 0.14],
        }),
      );
    }
    pieces.push(
      transformGeometry(new THREE.BoxGeometry(0.08, 0.58, 0.08), {
        position: [x + sx * 0.52, y + 0.76, z - 0.15],
        rotation: [-0.08, 0, 0],
      }),
    );
  }
  for (const barY of [0.69, 0.88, 1.05]) {
    pieces.push(
      transformGeometry(new THREE.BoxGeometry(1.22, 0.075, 0.055), {
        position: [x, y + barY, z - 0.18],
        rotation: [-0.08, 0, 0],
      }),
    );
  }

  const bench = new THREE.Mesh(mergeTextured(pieces), material);
  bench.castShadow = true;
  bench.receiveShadow = true;
  group.add(bench);
  return group;
}

function createPlanter(rng) {
  const group = new THREE.Group();
  const boxMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3324,
    roughness: 0.93,
    metalness: 0,
  });
  const soilMaterial = new THREE.MeshStandardMaterial({
    color: 0x241a12,
    roughness: 1,
  });
  const x = FRONT_WINDOW.centerX;
  const z = FRONT_Z + 0.35;
  const y = FRONT_WINDOW.bottom - 0.12;
  addBox(group, 1.18, 0.24, 0.27, boxMaterial, x, y, z);
  addBox(group, 1.08, 0.03, 0.2, soilMaterial, x, y + 0.13, z, { castShadow: false });

  const stems = [];
  const heads = [];
  const flowerColors = [0xf1d37b, 0xe3a269, 0xf1e2c4, 0xd8886a];
  for (let i = 0; i < 7; i += 1) {
    const fx = x - 0.45 + i * 0.15 + rng.range(-0.03, 0.03);
    const h = rng.range(0.16, 0.34);
    const stem = new THREE.CylinderGeometry(0.008, 0.011, h, 4);
    stem.translate(fx, y + 0.14 + h / 2, z + rng.range(-0.04, 0.04));
    stems.push(colorizeGeometry(stem, 0x557041));
    const head = new THREE.IcosahedronGeometry(rng.range(0.035, 0.06), 0);
    head.translate(fx, y + 0.14 + h, z + rng.range(-0.03, 0.03));
    heads.push(colorizeGeometry(head, rng.pick(flowerColors)));
  }
  const stemMesh = new THREE.Mesh(
    mergeSimple(stems),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
  const headMesh = new THREE.Mesh(
    mergeSimple(heads),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      emissive: 0x27150a,
      emissiveIntensity: 0.2,
    }),
  );
  stemMesh.castShadow = true;
  headMesh.castShadow = true;
  group.add(stemMesh, headMesh);
  return group;
}

function createChimney(rng, textures) {
  const group = new THREE.Group();
  const stoneMaterial = new THREE.MeshStandardMaterial({
    map: textures.stone,
    color: 0x9f9d8e,
    roughness: 1,
    metalness: 0,
  });
  const x = 2.12;
  const z = -1.28;
  addBox(group, 0.82, 2.95, 0.82, stoneMaterial, x, 4.65, z);
  for (const y of [3.52, 4.04, 4.58, 5.14, 5.7]) {
    addBox(group, 0.94, 0.09, 0.94, stoneMaterial, x, y, z);
  }
  addBox(group, 1.05, 0.16, 1.05, stoneMaterial, x, 6.14, z);
  addBox(group, 0.98, 0.12, 0.98, stoneMaterial, x, 6.3, z);
  const flue = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.2, 0.24, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 1 }),
  );
  flue.position.set(x, 6.4, z);
  group.add(flue);
  group.userData.smokeOrigin = new THREE.Vector3(x, 6.44, z);
  return group;
}

function createSmoke(origin) {
  const count = 30;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.18;
    positions[i * 3 + 1] = origin.y + Math.random() * 0.3;
    positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.18;
    seeds[i] = Math.random();
    scales[i] = 0.35 + Math.random() * 0.55;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xb8c0b9) },
      uOpacity: { value: 0.26 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uOpacity;
      attribute float aSeed;
      attribute float aScale;
      varying float vAlpha;
      void main() {
        float life = fract(uTime * (0.035 + aSeed * 0.032) + aSeed);
        vec3 p = position;
        p.y += life * 3.85;
        p.x += sin(life * 5.3 + aSeed * 22.0) * (0.14 + life * 0.8);
        p.z += cos(life * 4.1 + aSeed * 17.0) * (0.1 + life * 0.55);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aScale * (1.0 + life * 2.6) * (220.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
        vAlpha = smoothstep(0.0, 0.12, life) * (1.0 - life) * uOpacity;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float distanceToCenter = length(centered);
        float alpha = smoothstep(0.5, 0.08, distanceToCenter) * vAlpha;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 4;
  return { points, material };
}

export function createCabin(rng, textures) {
  const group = new THREE.Group();
  group.name = 'Moss and timber cabin';
  const glowTargets = [];

  group.add(createFoundation(rng, textures));
  group.add(createLogWalls(rng, textures));
  group.add(createGables(rng, textures));
  group.add(createRoof(rng, textures));
  const door = createDoor(rng, textures);
  group.add(door);
  glowTargets.push({ material: door.userData.doorGlassMaterial, base: 1.0 });
  const windows = createWindows(rng, textures);
  group.add(windows.group);
  glowTargets.push({ material: windows.glassMaterial, base: 1.28 });

  const lantern = createLantern(glowTargets);
  group.add(lantern.group);
  group.add(createBench(textures));
  group.add(createPlanter(rng));

  const chimney = createChimney(rng, textures);
  group.add(chimney);

  const smoke = createSmoke(chimney.userData.smokeOrigin);
  group.add(smoke.points);

  // A little moss spilling around the foundation.
  const mossBase = new THREE.IcosahedronGeometry(1, 1);
  const mossCount = 54;
  const mossMaterial = new THREE.MeshStandardMaterial({
    roughness: 1,
    metalness: 0,
    vertexColors: false,
    color: 0xffffff,
  });
  const moss = new THREE.InstancedMesh(mossBase, mossMaterial, mossCount);
  moss.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const color = new THREE.Color();
  for (let i = 0; i < mossCount; i += 1) {
    let x;
    let z;
    if (i < 22) {
      x = rng.range(-WIDTH / 2 - 0.1, WIDTH / 2 + 0.1);
      z = FRONT_Z + rng.range(-0.06, 0.35);
    } else if (i < 40) {
      x = rng.range(-WIDTH / 2 - 0.1, WIDTH / 2 + 0.1);
      z = BACK_Z - rng.range(-0.06, 0.35);
    } else {
      z = rng.range(-DEPTH / 2, DEPTH / 2);
      x = (i % 2 === 0 ? -1 : 1) * (WIDTH / 2 + rng.range(-0.02, 0.32));
    }
    position.set(x, rng.range(0.05, 0.17), z);
    quaternion.setFromEuler(new THREE.Euler(0, rng.range(0, Math.PI * 2), 0));
    scale.set(rng.range(0.12, 0.4), rng.range(0.025, 0.08), rng.range(0.12, 0.34));
    matrix.compose(position, quaternion, scale);
    moss.setMatrixAt(i, matrix);
    color.setHSL(
      rng.range(0.19, 0.255),
      rng.range(0.27, 0.47),
      rng.range(0.25, 0.44),
      THREE.SRGBColorSpace,
    );
    moss.setColorAt(i, color);
  }
  moss.instanceMatrix.needsUpdate = true;
  if (moss.instanceColor) moss.instanceColor.needsUpdate = true;
  moss.castShadow = false;
  moss.receiveShadow = true;
  group.add(moss);

  const pointLights = [];
  for (const windowAssembly of windows.glows) {
    if (windowAssembly.userData.glowLight) {
      pointLights.push({
        light: windowAssembly.userData.glowLight,
        base: windowAssembly.userData.glowLightBase,
      });
    }
  }
  pointLights.push({ light: lantern.light, base: 2.2 });
  pointLights.push({ light: door.userData.doorLight, base: 1.5 });

  let glowLevel = 1;
  const applyGlow = () => {
    for (const target of glowTargets) {
      target.material.emissiveIntensity = target.base * glowLevel;
    }
    for (const item of pointLights) {
      item.light.userData.baseIntensity = item.base * glowLevel;
    }
  };
  applyGlow();

  setObjectShadow(group, true, true);
  windows.group.traverse((child) => {
    if (child.isMesh && child.material === windows.glassMaterial) {
      child.castShadow = false;
    }
  });
  group.traverse((child) => {
    if (child.isMesh && child.material && child.material.transparent && child.material.opacity < 1) {
      child.castShadow = false;
    }
  });

  return {
    group,
    setGlowLevel: (level) => {
      glowLevel = level;
      applyGlow();
    },
    update(time) {
      smoke.material.uniforms.uTime.value = time;
      const flicker = 0.97 + Math.sin(time * 2.7) * 0.018 + Math.sin(time * 6.13 + 1.2) * 0.012;
      for (const item of pointLights) {
        item.light.intensity = (item.light.userData.baseIntensity ?? item.base) * flicker;
      }
    },
  };
}
