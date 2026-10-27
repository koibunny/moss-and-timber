import * as THREE from 'three';
import {
  colorizeGeometry,
  mergeSimple,
  mergeTextured,
} from '../core/geometry.js';
import { createWindMaterial } from '../core/materials.js';
import { hash2 } from '../core/rng.js';
import { terrainHeight } from './terrain.js';

const UP = new THREE.Vector3(0, 1, 0);
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

function composeMatrix(x, y, z, rotationY, scale, out = new THREE.Matrix4()) {
  _position.set(x, y, z);
  _euler.set(0, rotationY, 0);
  _quaternion.setFromEuler(_euler);
  _scale.setScalar(scale);
  return out.compose(_position, _quaternion, _scale);
}

/* -------------------------------------------------------------------------- */
/*                                    Pines                                   */
/* -------------------------------------------------------------------------- */

function createPineVariant(seed) {
  const localRandom = (() => {
    let value = seed;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  })();
  const range = (min, max) => min + (max - min) * localRandom();
  const tiers = [];
  const tierCount = 8;
  const baseColor = new THREE.Color();

  for (let i = 0; i < tierCount; i += 1) {
    const t = i / (tierCount - 1);
    const radius = 0.36 * Math.pow(1 - t, 0.82) * range(0.86, 1.08) + 0.035;
    const height = 0.23 + (1 - t) * 0.12;
    const geometry = new THREE.ConeGeometry(radius, height, 9, 2, true);
    const position = geometry.attributes.position;
    const phase = range(0, Math.PI * 2);

    for (let v = 0; v < position.count; v += 1) {
      const x = position.getX(v);
      const y = position.getY(v);
      const z = position.getZ(v);
      const angle = Math.atan2(z, x);
      const yNorm = (y + height / 2) / height;
      const jag = 1 + Math.sin(angle * 5 + phase) * 0.075 + Math.sin(angle * 9 - phase) * 0.04;
      position.setX(v, x * jag + Math.sin(angle * 3 + phase) * 0.012 * (1 - yNorm));
      position.setZ(v, z * jag + Math.cos(angle * 2 - phase) * 0.012 * (1 - yNorm));
      if (yNorm < 0.14) {
        position.setY(v, y + Math.sin(angle * 7 + phase) * 0.018);
      }
    }
    geometry.computeVertexNormals();
    geometry.translate(
      Math.sin(phase) * 0.022,
      0.18 + t * 0.79 + height * 0.2,
      Math.cos(phase * 1.3) * 0.022,
    );

    baseColor.setHSL(
      0.29 + t * 0.025,
      0.36 - t * 0.06,
      0.23 + t * 0.08,
      THREE.SRGBColorSpace,
    );
    tiers.push(colorizeGeometry(geometry, baseColor));
  }

  return mergeSimple(tiers);
}

function createForest(textures, quality, rng) {
  const group = new THREE.Group();
  const pineVariants = [11, 29, 47, 71, 103].map((seed) => createPineVariant(seed));
  const foliageMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.98,
    metalness: 0,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const trunkMaterial = new THREE.MeshStandardMaterial({
    map: textures.bark,
    color: 0x8f775a,
    roughness: 1,
    metalness: 0,
  });

  const placements = [];
  const count = quality === 'mobile' ? 46 : 70;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const radius = rng.range(11.5, 34);
    const x = Math.cos(angle) * radius + rng.range(-2, 2);
    const z = Math.sin(angle) * radius + rng.range(-2, 2);
    if (Math.hypot(x, z) < 10.8) continue;
    if (Math.abs(x) < 5.4 && z > 4.5 && z < 17) continue;
    if (Math.hypot(x - 10.2, z - 15.8) < 13.2) continue;
    const cameraSector = Math.abs(
      Math.atan2(Math.sin(angle - 1.0), Math.cos(angle - 1.0)),
    );
    if (radius < 24 && cameraSector < 0.34) continue;
    placements.push({
      x,
      z,
      height: rng.range(7.5, 14.5) * (radius > 25 ? 0.9 : 1),
      rotation: rng.range(0, Math.PI * 2),
      variant: rng.int(0, pineVariants.length - 1),
    });
  }

  const heroTrees = [
    [-10.4, 8.2, 14.4],
    [-12.5, -3.4, 13.8],
    [9.2, -8.4, 12.6],
    [14.2, 1.8, 16.2],
    [-8.9, -9.8, 13.4],
    [-13.6, 4.0, 15.0],
    [7.6, -12.0, 12.4],
  ];
  for (const [x, z, height] of heroTrees) {
    placements.push({
      x,
      z,
      height,
      rotation: rng.range(0, Math.PI * 2),
      variant: rng.int(0, pineVariants.length - 1),
    });
  }

  const counts = new Array(pineVariants.length).fill(0);
  for (const placement of placements) counts[placement.variant] += 1;

  const foliageMeshes = pineVariants.map((geometry, index) => {
    const mesh = new THREE.InstancedMesh(geometry, foliageMaterial, counts[index]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  });

  const trunkGeometry = new THREE.CylinderGeometry(0.045, 0.075, 1, 7, 2);
  trunkGeometry.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, placements.length);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  trunks.frustumCulled = false;
  group.add(trunks);

  const indices = new Array(pineVariants.length).fill(0);
  const foliageMatrix = new THREE.Matrix4();
  const trunkMatrix = new THREE.Matrix4();
  const instanceColor = new THREE.Color();

  placements.forEach((placement, index) => {
    const ground = terrainHeight(placement.x, placement.z) - 0.18;
    composeMatrix(
      placement.x,
      ground,
      placement.z,
      placement.rotation,
      placement.height,
      foliageMatrix,
    );
    foliageMeshes[placement.variant].setMatrixAt(
      indices[placement.variant],
      foliageMatrix,
    );
    instanceColor.setHSL(
      rng.range(0.285, 0.34),
      rng.range(0.26, 0.43),
      rng.range(0.78, 1.02),
    );
    foliageMeshes[placement.variant].setColorAt(indices[placement.variant], instanceColor);
    indices[placement.variant] += 1;

    _position.set(placement.x, ground, placement.z);
    _euler.set(0, placement.rotation, 0);
    _quaternion.setFromEuler(_euler);
    _scale.set(placement.height * 0.88, placement.height * 0.8, placement.height * 0.88);
    trunkMatrix.compose(_position, _quaternion, _scale);
    trunks.setMatrixAt(index, trunkMatrix);
  });

  foliageMeshes.forEach((mesh, index) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = counts[index];
  });
  trunks.instanceMatrix.needsUpdate = true;

  return { group, placements };
}

/* -------------------------------------------------------------------------- */
/*                             Ferns, grass and weeds                         */
/* -------------------------------------------------------------------------- */

function addVertex(positions, colors, point, color) {
  positions.push(point.x, point.y, point.z);
  colors.push(color.r, color.g, color.b);
}

function addTriangle(positions, colors, a, b, c, colorA, colorB, colorC) {
  addVertex(positions, colors, a, colorA);
  addVertex(positions, colors, b, colorB);
  addVertex(positions, colors, c, colorC);
}

function makeFernGeometry(rng) {
  const positions = [];
  const colors = [];
  const frondCount = 9;
  const dark = new THREE.Color();
  const light = new THREE.Color();

  for (let f = 0; f < frondCount; f += 1) {
    const angle = (f / frondCount) * Math.PI * 2 + rng.range(-0.22, 0.22);
    const length = rng.range(0.7, 1.15);
    const arch = rng.range(0.38, 0.68);
    const steps = 9;
    const points = [];
    const tangent = new THREE.Vector3();

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const radial = 0.05 + length * t;
      const bend = Math.sin(t * Math.PI * 0.84) * arch;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radial,
          bend + 0.06 * t,
          Math.sin(angle) * radial,
        ),
      );
    }

    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const base = points[i];
      tangent.copy(points[i + 1]).sub(points[i - 1]).normalize();
      const side = new THREE.Vector3().crossVectors(UP, tangent).normalize();
      const leafLength = Math.sin(Math.PI * t) * rng.range(0.16, 0.26) * (0.55 + length * 0.5);

      for (const direction of [-1, 1]) {
        const half = leafLength * 0.5;
        const rootA = base
          .clone()
          .addScaledVector(tangent, -0.012)
          .addScaledVector(side, direction * 0.005);
        const rootB = base.clone().addScaledVector(tangent, 0.035);
        const mid = base
          .clone()
          .addScaledVector(side, direction * half)
          .addScaledVector(tangent, leafLength * 0.18)
          .addScaledVector(UP, 0.02);
        const tip = base
          .clone()
          .addScaledVector(side, direction * leafLength)
          .addScaledVector(tangent, leafLength * 0.38)
          .addScaledVector(UP, 0.012);

        dark.setHSL(
          0.275 + rng.range(-0.018, 0.018),
          0.42,
          0.2 + t * 0.08,
          THREE.SRGBColorSpace,
        );
        light.setHSL(
          0.25 + rng.range(-0.02, 0.02),
          0.36,
          0.32 + t * 0.1,
          THREE.SRGBColorSpace,
        );
        addTriangle(positions, colors, rootA, mid, rootB, dark, light, dark);
        addTriangle(positions, colors, mid, tip, rootB, light, light.clone().offsetHSL(0, -0.04, 0.04), dark);
      }
    }

    // A thin, dark rachis keeps the fern silhouette legible.
    for (let i = 0; i < steps; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      tangent.copy(b).sub(a).normalize();
      const side = new THREE.Vector3().crossVectors(UP, tangent).normalize();
      const widthA = 0.007 * (1 - i / steps);
      const widthB = 0.007 * (1 - (i + 1) / steps);
      dark.setHSL(0.27, 0.4, 0.18, THREE.SRGBColorSpace);
      const a1 = a.clone().addScaledVector(side, widthA);
      const a2 = a.clone().addScaledVector(side, -widthA);
      const b1 = b.clone().addScaledVector(side, widthB);
      const b2 = b.clone().addScaledVector(side, -widthB);
      addTriangle(positions, colors, a1, b1, a2, dark, dark, dark);
      addTriangle(positions, colors, a2, b1, b2, dark, dark, dark);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makeGrassGeometry(rng) {
  const positions = [];
  const colors = [];
  const blades = 10;
  const colorLow = new THREE.Color();
  const colorHigh = new THREE.Color();

  for (let blade = 0; blade < blades; blade += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const height = rng.range(0.22, 0.52);
    const bend = rng.range(0.02, 0.16);
    const width = rng.range(0.012, 0.028);
    const baseX = rng.range(-0.055, 0.055);
    const baseZ = rng.range(-0.055, 0.055);
    const side = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const segments = 4;
    const rows = [];

    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const widthAt = width * (1 - t * 0.85);
      const center = new THREE.Vector3(
        baseX + Math.cos(angle) * bend * t * t,
        height * t,
        baseZ + Math.sin(angle) * bend * t * t,
      );
      rows.push([
        center.clone().addScaledVector(side, widthAt),
        center.clone().addScaledVector(side, -widthAt),
      ]);
    }

    for (let i = 0; i < segments; i += 1) {
      const t = i / segments;
      colorLow.setHSL(
        0.24 + rng.range(-0.02, 0.02),
        0.35,
        0.2 + t * 0.08,
        THREE.SRGBColorSpace,
      );
      colorHigh.setHSL(
        0.22 + rng.range(-0.02, 0.02),
        0.42,
        0.3 + t * 0.15,
        THREE.SRGBColorSpace,
      );
      const [aLeft, aRight] = rows[i];
      const [bLeft, bRight] = rows[i + 1];
      addTriangle(positions, colors, aLeft, bLeft, aRight, colorLow, colorHigh, colorLow);
      addTriangle(positions, colors, aRight, bLeft, bRight, colorLow, colorHigh, colorHigh);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makeWeedGeometry(rng) {
  const positions = [];
  const colors = [];
  const stems = 6;
  const seedGeometries = [];

  for (let s = 0; s < stems; s += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const height = rng.range(0.48, 0.94);
    const bend = rng.range(0.03, 0.18);
    const baseX = rng.range(-0.08, 0.08);
    const baseZ = rng.range(-0.08, 0.08);
    const side = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const segments = 4;
    const rows = [];
    const colorLow = new THREE.Color().setHSL(0.24, 0.34, 0.2, THREE.SRGBColorSpace);
    const colorHigh = new THREE.Color().setHSL(0.2, 0.28, 0.42, THREE.SRGBColorSpace);

    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const center = new THREE.Vector3(
        baseX + Math.cos(angle) * bend * t * t,
        height * t,
        baseZ + Math.sin(angle) * bend * t * t,
      );
      const width = 0.008 * (1 - t * 0.7);
      rows.push([
        center.clone().addScaledVector(side, width),
        center.clone().addScaledVector(side, -width),
      ]);
    }
    for (let i = 0; i < segments; i += 1) {
      const t = i / segments;
      const [aLeft, aRight] = rows[i];
      const [bLeft, bRight] = rows[i + 1];
      addTriangle(positions, colors, aLeft, bLeft, aRight, colorLow, colorHigh, colorLow);
      addTriangle(positions, colors, aRight, bLeft, bRight, colorLow, colorHigh, colorHigh);
    }

    const top = rows[segments][0].clone().add(rows[segments][1]).multiplyScalar(0.5);
    const seed = new THREE.OctahedronGeometry(rng.range(0.025, 0.045), 0);
    seed.scale(1.3, 0.55, 1.3);
    seed.translate(top.x, top.y + 0.02, top.z);
    seedGeometries.push(colorizeGeometry(seed, rng.pick([0xc9c4a3, 0xb9b58f, 0xd2c9ae])));
  }

  const stemGeometry = new THREE.BufferGeometry();
  stemGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  stemGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  stemGeometry.computeVertexNormals();
  return mergeSimple([stemGeometry, ...seedGeometries]);
}

function isInsideCabin(x, z, margin = 0.5) {
  return (
    x > -3.95 - margin &&
    x < 3.95 + margin &&
    z > -3.25 - margin &&
    z < 3.25 + margin
  );
}

function makePathDistanceSampler(centerline) {
  const samples = centerline ?? [];
  return (x, z) => {
    let min = Infinity;
    for (const point of samples) {
      const distance = Math.hypot(x - point.x, z - point.z);
      if (distance < min) min = distance;
    }
    return min;
  };
}

function scatterInstanced({
  geometry,
  material,
  count,
  rng,
  group,
  placement,
  castShadow = false,
}) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  group.add(mesh);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  let index = 0;
  for (let i = 0; i < count; i += 1) {
    const spot = placement(i, rng);
    if (!spot) continue;
    composeMatrix(spot.x, spot.y, spot.z, spot.rotation, spot.scale, matrix);
    mesh.setMatrixAt(index, matrix);
    if (spot.tint) {
      color.copy(spot.tint);
      mesh.setColorAt(index, color);
    }
    index += 1;
  }
  mesh.count = index;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function createUnderstory(textures, quality, rng, pathCenterline) {
  const group = new THREE.Group();
  const pathDistance = makePathDistanceSampler(pathCenterline);
  const fernMobile = quality === 'mobile';
  const fernGeometry = makeFernGeometry(rng);
  const fernMaterial = createWindMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.94,
    side: THREE.DoubleSide,
    height: 1.0,
    amplitude: 0.045,
    speed: 1.15,
  });
  const grassGeometry = makeGrassGeometry(rng);
  const grassMaterial = createWindMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    side: THREE.DoubleSide,
    height: 0.54,
    amplitude: 0.038,
    speed: 1.55,
  });
  const weedGeometry = makeWeedGeometry(rng);
  const weedMaterial = createWindMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    side: THREE.DoubleSide,
    height: 0.95,
    amplitude: 0.07,
    speed: 0.93,
  });

  const heroFerns = [
    [-4.35, 2.65, 1.25],
    [-3.35, 4.1, 1.0],
    [4.15, 2.0, 1.2],
    [5.05, 3.15, 0.9],
    [2.85, 5.2, 0.8],
    [-2.1, 6.0, 1.1],
    [5.8, 0.35, 0.85],
    [-5.7, -1.25, 1.05],
    [4.7, -2.55, 0.95],
    [-3.2, -4.4, 0.9],
    [1.55, -4.1, 1.1],
    [-6.8, 4.7, 1.15],
  ];
  const heroCount = fernMobile ? Math.min(heroFerns.length, 9) : heroFerns.length;
  const ferns = scatterInstanced({
    geometry: fernGeometry,
    material: fernMaterial,
    count: heroCount + (fernMobile ? 16 : 30),
    rng,
    group,
    placement: (i, localRng) => {
      let x;
      let z;
      let scale;
      if (i < heroCount) {
        [x, z, scale] = heroFerns[i];
      } else {
        let attempts = 0;
        do {
          const angle = localRng.range(0, Math.PI * 2);
          const radius = localRng.range(4.2, 16.5);
          x = Math.cos(angle) * radius;
          z = Math.sin(angle) * radius;
          scale = localRng.range(0.58, 1.2);
          attempts += 1;
        } while (
          attempts < 20 &&
          (isInsideCabin(x, z, 0.9) || pathDistance(x, z) < 1.25 || Math.hypot(x, z) > 18)
        );
      }
      return {
        x,
        y: terrainHeight(x, z) + 0.015,
        z,
        rotation: localRng.range(0, Math.PI * 2),
        scale,
        tint: new THREE.Color().setHSL(
          localRng.range(0.27, 0.31),
          localRng.range(0.3, 0.45),
          localRng.range(0.8, 1.05),
        ),
      };
    },
  });

  const grassCount = fernMobile ? 150 : 260;
  scatterInstanced({
    geometry: grassGeometry,
    material: grassMaterial,
    count: grassCount,
    rng,
    group,
    placement: (i, localRng) => {
      let x;
      let z;
      let attempts = 0;
      do {
        const angle = localRng.range(0, Math.PI * 2);
        const radius = localRng.range(1.8, 20.5);
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        attempts += 1;
      } while (
        attempts < 22 &&
        (isInsideCabin(x, z, 0.15) || pathDistance(x, z) < 0.58)
      );
      return {
        x,
        y: terrainHeight(x, z) + 0.01,
        z,
        rotation: localRng.range(0, Math.PI * 2),
        scale: localRng.range(0.65, 1.45),
        tint: new THREE.Color().setHSL(
          localRng.range(0.23, 0.29),
          localRng.range(0.25, 0.42),
          localRng.range(0.75, 1.04),
        ),
      };
    },
  });

  const weedsCount = fernMobile ? 40 : 72;
  scatterInstanced({
    geometry: weedGeometry,
    material: weedMaterial,
    count: weedsCount,
    rng,
    group,
    placement: (i, localRng) => {
      let x;
      let z;
      let attempts = 0;
      do {
        const angle = localRng.range(0, Math.PI * 2);
        const radius = localRng.range(3.6, 17.5);
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        attempts += 1;
      } while (
        attempts < 22 &&
        (isInsideCabin(x, z, 0.5) || pathDistance(x, z) < 1.0)
      );
      return {
        x,
        y: terrainHeight(x, z),
        z,
        rotation: localRng.range(0, Math.PI * 2),
        scale: localRng.range(0.65, 1.3),
        tint: new THREE.Color().setHSL(
          localRng.range(0.22, 0.3),
          localRng.range(0.18, 0.32),
          localRng.range(0.8, 1.05),
        ),
      };
    },
  });

  return { group, ferns };
}

/* -------------------------------------------------------------------------- */
/*                                  Mushrooms                                 */
/* -------------------------------------------------------------------------- */

function createMushrooms(rng) {
  const group = new THREE.Group();
  const stemGeometries = [];
  const capGeometries = [];
  const spotGeometries = [];
  const capColors = [0xb54b35, 0xc46a3d, 0x9e3e32, 0xb78356];
  const clusters = [
    [-3.35, 4.1, 4],
    [3.25, 3.7, 5],
    [-4.65, 1.5, 3],
    [4.5, -1.1, 4],
    [1.35, 6.3, 3],
    [-2.55, -4.2, 2],
    [-6.2, 2.1, 3],
    [6.1, 4.2, 2],
  ];

  for (const [cx, cz, amount] of clusters) {
    for (let i = 0; i < amount; i += 1) {
      const angle = rng.range(0, Math.PI * 2);
      const radius = i === 0 ? 0 : rng.range(0.09, 0.32);
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      const y = terrainHeight(x, z);
      const scale = rng.range(0.65, 1.25);
      const height = rng.range(0.13, 0.28) * scale;
      const capRadius = rng.range(0.1, 0.19) * scale;
      const leanX = rng.range(-0.06, 0.06);
      const leanZ = rng.range(-0.06, 0.06);

      const stem = new THREE.CylinderGeometry(capRadius * 0.18, capRadius * 0.26, height, 6);
      stem.translate(x, y + height / 2, z);
      stemGeometries.push(colorizeGeometry(stem, 0xd5c9a8));

      const cap = new THREE.SphereGeometry(capRadius, 10, 6);
      cap.scale(1, 0.58, 1);
      cap.translate(x + leanX, y + height + capRadius * 0.15, z + leanZ);
      capGeometries.push(colorizeGeometry(cap, rng.pick(capColors)));

      const spotCount = 3 + Math.floor(rng.range(0, 4));
      for (let s = 0; s < spotCount; s += 1) {
        const theta = rng.range(0, Math.PI * 2);
        const radial = rng.range(0.18, 0.82);
        const spot = new THREE.SphereGeometry(capRadius * rng.range(0.1, 0.17), 6, 4);
        spot.scale(1, 0.35, 1);
        const surfaceY =
          y + height + capRadius * (0.15 + Math.sqrt(1 - radial * radial) * 0.58);
        spot.translate(
          x + leanX + Math.cos(theta) * capRadius * radial,
          surfaceY,
          z + leanZ + Math.sin(theta) * capRadius * radial,
        );
        spotGeometries.push(colorizeGeometry(spot, 0xe9dec2));
      }
    }
  }

  const stemMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
  });
  const capMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.74,
    metalness: 0,
  });
  const spotsMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0,
  });

  const stems = new THREE.Mesh(mergeSimple(stemGeometries), stemMaterial);
  const caps = new THREE.Mesh(mergeSimple(capGeometries), capMaterial);
  const spots = new THREE.Mesh(mergeSimple(spotGeometries), spotsMaterial);
  for (const mesh of [stems, caps, spots]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

/* -------------------------------------------------------------------------- */
/*                            Rocks, fallen wood                              */
/* -------------------------------------------------------------------------- */

function createRocks(textures, rng) {
  const group = new THREE.Group();
  const geometries = [];
  const mossGeometries = [];
  const rocks = [
    [-5.35, 3.3, 1.1, 0.7],
    [5.55, 2.0, 0.75, 0.65],
    [-4.8, -2.5, 1.35, 0.9],
    [6.05, -2.6, 1.0, 0.85],
    [2.25, 7.1, 0.56, 0.52],
    [-2.6, 8.6, 0.82, 0.66],
    [-7.9, 0.8, 1.7, 1.0],
    [0.55, -6.2, 1.15, 0.78],
    [7.8, 4.8, 0.72, 0.55],
    [-8.4, -4.0, 1.25, 0.85],
  ];

  for (const [x, z, size, heightScale] of rocks) {
    const geometry = new THREE.DodecahedronGeometry(1, 1);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const px = position.getX(i);
      const py = position.getY(i);
      const pz = position.getZ(i);
      const jitter = 0.78 + hash2(px * 8.1 + pz * 3.4, py * 7.7 - px * 2.2) * 0.36;
      position.setXYZ(i, px * jitter, py * jitter, pz * jitter);
    }
    geometry.computeVertexNormals();
    geometry.scale(size, size * heightScale, size * rng.range(0.78, 1.1));
    geometry.rotateY(rng.range(0, Math.PI * 2));
    geometry.translate(x, terrainHeight(x, z) + size * heightScale * 0.25, z);
    const tint = new THREE.Color().setHSL(
      0.16,
      0.04,
      rng.range(0.55, 0.82),
      THREE.SRGBColorSpace,
    );
    geometries.push(colorizeGeometry(geometry, tint));

    if (rng.chance(0.65)) {
      const patch = new THREE.IcosahedronGeometry(size * 0.48, 1);
      patch.scale(rng.range(0.6, 1.1), rng.range(0.16, 0.3), rng.range(0.5, 1.0));
      patch.translate(
        x + rng.range(-0.18, 0.18),
        terrainHeight(x, z) + size * heightScale * 0.92,
        z + rng.range(-0.18, 0.18),
      );
      mossGeometries.push(
        colorizeGeometry(
          patch,
          new THREE.Color().setHSL(
            0.23,
            rng.range(0.28, 0.45),
            rng.range(0.26, 0.38),
            THREE.SRGBColorSpace,
          ),
        ),
      );
    }
  }

  const material = new THREE.MeshStandardMaterial({
    map: textures.stone,
    color: 0xc4c1b2,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(mergeTextured(geometries), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  if (mossGeometries.length) {
    const moss = new THREE.Mesh(
      mergeSimple(mossGeometries),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    );
    moss.castShadow = false;
    moss.receiveShadow = true;
    group.add(moss);
  }
  return group;
}

function createFallenLog(textures, rng) {
  const group = new THREE.Group();
  const x = -6.55;
  const z = 1.15;
  const angle = 0.65;
  const length = 3.1;
  const radius = 0.29;
  const ground = terrainHeight(x, z);
  const log = new THREE.CylinderGeometry(radius * 0.82, radius, length, 10, 3);
  log.rotateZ(Math.PI / 2);
  log.rotateY(angle);
  log.translate(x, ground + radius * 0.74, z);
  const mesh = new THREE.Mesh(
    log,
    new THREE.MeshStandardMaterial({
      map: textures.bark,
      color: 0x8d765c,
      roughness: 1,
      metalness: 0,
    }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const direction = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
  const mossGeometries = [];
  for (let i = 0; i < 7; i += 1) {
    const t = (i / 6 - 0.5) * length * 0.78;
    const patch = new THREE.IcosahedronGeometry(rng.range(0.16, 0.32), 1);
    patch.scale(rng.range(0.8, 1.25), rng.range(0.1, 0.2), rng.range(0.7, 1.15));
    const p = new THREE.Vector3(x, ground + radius * 1.12, z).addScaledVector(direction, t);
    patch.translate(p.x + rng.range(-0.1, 0.1), p.y, p.z + rng.range(-0.1, 0.1));
    mossGeometries.push(
      colorizeGeometry(
        patch,
        new THREE.Color().setHSL(
          0.23,
          rng.range(0.28, 0.45),
          rng.range(0.26, 0.38),
          THREE.SRGBColorSpace,
        ),
      ),
    );
  }
  const moss = new THREE.Mesh(
    mergeSimple(mossGeometries),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
  moss.receiveShadow = true;
  group.add(moss);
  return group;
}

/* -------------------------------------------------------------------------- */
/*                                 Sunflowers                                 */
/* -------------------------------------------------------------------------- */

function createSunflowerHead() {
  const group = new THREE.Group();

  const petalShape = new THREE.Shape();
  petalShape.moveTo(-0.035, 0);
  petalShape.bezierCurveTo(-0.085, 0.13, -0.06, 0.33, 0, 0.48);
  petalShape.bezierCurveTo(0.06, 0.33, 0.085, 0.13, 0.035, 0);
  petalShape.closePath();
  const petalGeometry = new THREE.ShapeGeometry(petalShape, 4);

  const petalParts = [];
  const outerCount = 20;
  for (let i = 0; i < outerCount; i += 1) {
    const angle = (i / outerCount) * Math.PI * 2;
    const petal = petalGeometry.clone();
    petal.rotateZ(angle);
    petal.translate(Math.sin(angle) * 0.015, Math.cos(angle) * 0.015, 0.01);
    petalParts.push(colorizeGeometry(petal, i % 3 === 0 ? 0xe8ad35 : 0xf0c34f));
  }
  const innerCount = 16;
  for (let i = 0; i < innerCount; i += 1) {
    const angle = ((i + 0.5) / innerCount) * Math.PI * 2;
    const petal = petalGeometry.clone();
    petal.scale(0.82, 0.78, 1);
    petal.rotateZ(angle);
    petal.translate(0, 0, -0.005);
    petalParts.push(colorizeGeometry(petal, 0xc88927));
  }

  const petalMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.84,
    metalness: 0,
    side: THREE.DoubleSide,
    emissive: 0x3b2407,
    emissiveIntensity: 0.18,
  });
  const petals = new THREE.Mesh(mergeSimple(petalParts), petalMaterial);
  petals.castShadow = true;
  petals.receiveShadow = true;
  group.add(petals);

  const centerMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b2415,
    roughness: 1,
    metalness: 0,
  });
  const center = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.075, 16), centerMaterial);
  center.rotation.x = Math.PI / 2;
  center.position.z = 0.035;
  center.castShadow = true;
  group.add(center);

  const seedGeometries = [];
  const seedCount = 46;
  for (let i = 0; i < seedCount; i += 1) {
    const angle = i * 2.399963;
    const radius = 0.155 * Math.sqrt((i + 0.5) / seedCount);
    const seed = new THREE.SphereGeometry(0.012, 4, 3);
    seed.scale(1, 1, 0.55);
    seed.translate(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.077);
    seedGeometries.push(
      colorizeGeometry(seed, i % 4 === 0 ? 0x8f5c26 : 0x5e381b),
    );
  }
  const seeds = new THREE.Mesh(
    mergeSimple(seedGeometries),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }),
  );
  group.add(seeds);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.178, 0.022, 5, 20),
    new THREE.MeshStandardMaterial({
      color: 0xb58031,
      roughness: 0.9,
      metalness: 0,
    }),
  );
  rim.position.z = 0.042;
  group.add(rim);

  return group;
}

function createSunflowers(rng) {
  const group = new THREE.Group();
  const flowers = [];
  const data = [
    { x: 4.05, z: 2.72, height: 2.2, leanX: 0.18, leanZ: -0.14, face: [0.58, 0.1, 0.81] },
    { x: 4.85, z: 3.35, height: 1.78, leanX: -0.12, leanZ: 0.1, face: [0.44, 0.08, 0.89] },
    { x: 3.35, z: 4.0, height: 1.52, leanX: 0.1, leanZ: 0.18, face: [0.7, 0.08, 0.7] },
    { x: -4.35, z: 3.05, height: 1.94, leanX: -0.13, leanZ: -0.1, face: [0.82, 0.1, 0.56] },
    { x: -5.15, z: 3.9, height: 1.6, leanX: 0.1, leanZ: 0.1, face: [0.7, 0.12, 0.7] },
  ];
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x58733e,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.13, 0.08, 0.2, 0.3, 0.13, 0.5);
  leafShape.bezierCurveTo(0.07, 0.27, 0.02, 0.12, 0, 0);
  leafShape.closePath();
  const leafGeometry = new THREE.ShapeGeometry(leafShape, 4);

  data.forEach((flowerData, index) => {
    const flower = new THREE.Group();
    const groundY = terrainHeight(flowerData.x, flowerData.z);
    flower.position.set(flowerData.x, groundY, flowerData.z);

    const top = new THREE.Vector3(flowerData.leanX, flowerData.height, flowerData.leanZ);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(
        flowerData.leanX * 0.28 + rng.range(-0.05, 0.05),
        flowerData.height * 0.53,
        flowerData.leanZ * 0.28,
      ),
      top,
    ]);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 9, 0.027, 5, false),
      stemMaterial,
    );
    stem.castShadow = true;
    stem.receiveShadow = true;
    flower.add(stem);

    const leafParts = [];
    for (const [t, angle, scale] of [
      [0.28, 0.4, 1.0],
      [0.5, 2.35, 0.85],
      [0.7, 4.1, 0.72],
    ]) {
      const point = curve.getPoint(t);
      const leaf = leafGeometry.clone();
      leaf.scale(scale, scale, scale);
      leaf.rotateX(-Math.PI / 2 + 0.3);
      leaf.rotateZ(angle);
      leaf.rotateY(angle * 0.4);
      leaf.translate(point.x, point.y, point.z);
      leafParts.push(leaf);
    }
    const leaves = new THREE.Mesh(mergeTextured(leafParts), stemMaterial);
    leaves.castShadow = true;
    flower.add(leaves);

    const head = createSunflowerHead();
    head.position.copy(top);
    const face = new THREE.Vector3(...flowerData.face).normalize();
    const headQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      face,
    );
    head.quaternion.copy(headQuaternion);
    head.scale.setScalar(index < 3 ? 1.0 : 0.92);
    flower.add(head);

    flower.userData.phase = rng.range(0, Math.PI * 2);
    flower.userData.head = head;
    flower.userData.headWorld = new THREE.Vector3(
      flowerData.x + top.x,
      groundY + top.y,
      flowerData.z + top.z,
    );
    group.add(flower);
    flowers.push(flower);
  });

  return {
    group,
    flowers,
    update(time) {
      for (const flower of flowers) {
        const phase = flower.userData.phase;
        flower.rotation.z = Math.sin(time * 0.72 + phase) * 0.017;
        flower.rotation.x = Math.cos(time * 0.63 + phase * 1.4) * 0.012;
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                Public world                                */
/* -------------------------------------------------------------------------- */

export function createVegetation({ textures, quality, rng, pathCenterline }) {
  const group = new THREE.Group();
  group.name = 'Forest planting';

  const forest = createForest(textures, quality, rng);
  const understory = createUnderstory(textures, quality, rng, pathCenterline);
  const mushrooms = createMushrooms(rng);
  const rocks = createRocks(textures, rng);
  const fallenLog = createFallenLog(textures, rng);
  const sunflowers = createSunflowers(rng);

  group.add(
    forest.group,
    understory.group,
    mushrooms,
    rocks,
    fallenLog,
    sunflowers.group,
  );

  return {
    group,
    update(time) {
      sunflowers.update(time);
    },
    sunflowerHeadPositions: sunflowers.flowers.map((flower) =>
      flower.userData.headWorld.clone(),
    ),
  };
}
