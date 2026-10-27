import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm2, smoothstep } from '../core/rng.js';

const GROUND_SIZE = 130;

export function terrainHeight(x, z) {
  const distance = Math.hypot(x, z);
  const clearing = smoothstep(7.5, 17, distance);
  const rolling = (fbm2(x * 0.032 + 18.4, z * 0.032 - 7.8, 4) - 0.5) * 2.4;
  const detail = (fbm2(x * 0.115 - 3.6, z * 0.115 + 12.3, 2) - 0.5) * 0.26;
  const distantRise = smoothstep(24, 60, distance) * 1.8;
  return (rolling + distantRise) * clearing + detail * (0.16 + clearing * 0.84);
}

function buildGroundMaterial(textures) {
  const material = new THREE.MeshStandardMaterial({
    map: textures.ground,
    color: 0xd8d4bf,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
    dithering: true,
  });
  return material;
}

function createGround(textures, quality) {
  const segments = quality === 'mobile' ? 88 : 128;
  const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = terrainHeight(x, z);
    position.setY(i, y);

    const moisture = fbm2(x * 0.024 + 7.1, z * 0.024 - 9.8, 3);
    const patch = fbm2(x * 0.083 - 2.4, z * 0.083 + 6.2, 2);
    color.setRGB(
      0.78 + patch * 0.14,
      0.82 + moisture * 0.14,
      0.68 + patch * 0.08,
    );
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = buildGroundMaterial(textures);
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  ground.name = 'Forest floor';
  return ground;
}

function createPath(textures) {
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.65, 0, 3.25),
      new THREE.Vector3(-0.45, 0, 4.4),
      new THREE.Vector3(0.75, 0, 6.6),
      new THREE.Vector3(1.3, 0, 8.9),
      new THREE.Vector3(0.45, 0, 11.2),
      new THREE.Vector3(1.55, 0, 14.2),
      new THREE.Vector3(2.15, 0, 17.6),
      new THREE.Vector3(2.5, 0, 21.8),
    ],
    false,
    'catmullrom',
    0.35,
  );

  const samples = 76;
  const positions = [];
  const uvs = [];
  const indices = [];
  const centerline = [];
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const point = curve.getPoint(t);
    curve.getTangent(t, tangent);
    tangent.y = 0;
    tangent.normalize();
    side.set(-tangent.z, 0, tangent.x);
    const width = 0.8 + Math.sin(t * Math.PI) * 0.4 + Math.sin(t * 17.2) * 0.06;
    const centerY = terrainHeight(point.x, point.z) + 0.035;
    const left = point.clone().addScaledVector(side, width * 0.5);
    const right = point.clone().addScaledVector(side, -width * 0.5);
    const leftY = terrainHeight(left.x, left.z) + 0.038;
    const rightY = terrainHeight(right.x, right.z) + 0.038;

    positions.push(left.x, leftY, left.z, right.x, rightY, right.z);
    uvs.push(0, t * 3.2, 1, t * 3.2);
    centerline.push(new THREE.Vector3(point.x, centerY, point.z));

    if (i < samples) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: textures.path,
    color: 0xb9a88b,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const path = new THREE.Mesh(geometry, material);
  path.receiveShadow = true;
  path.name = 'Winding path';

  return { path, curve, centerline };
}

function createSteppingStones(textures, curve) {
  const stoneGeometries = [];
  const count = 8;
  for (let i = 0; i < count; i += 1) {
    const t = 0.08 + i * 0.085;
    const point = curve.getPoint(t);
    const side = Math.sin(i * 2.7) * 0.12;
    const tangent = curve.getTangent(t);
    const x = point.x - tangent.z * side;
    const z = point.z + tangent.x * side;
    const geometry = new THREE.CylinderGeometry(
      0.33 + (i % 3) * 0.04,
      0.38 + (i % 2) * 0.035,
      0.11,
      7,
      1,
    );
    geometry.rotateY(i * 0.83);
    geometry.scale(1 + (i % 2) * 0.18, 1, 0.78 + (i % 3) * 0.06);
    geometry.translate(x, terrainHeight(x, z) + 0.04, z);
    stoneGeometries.push(geometry.toNonIndexed());
  }

  const geometry = mergeGeometries(stoneGeometries, false);
  const material = new THREE.MeshStandardMaterial({
    map: textures.stone,
    color: 0x8f8d7b,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const stones = new THREE.Mesh(geometry, material);
  stones.castShadow = true;
  stones.receiveShadow = true;
  stones.name = 'Stepping stones';
  return stones;
}

export function createTerrain(textures, quality) {
  const group = new THREE.Group();
  group.name = 'Terrain';

  const ground = createGround(textures, quality);
  const { path, curve, centerline } = createPath(textures);
  const steppingStones = createSteppingStones(textures, curve);

  group.add(ground, path, steppingStones);
  return { group, heightAt: terrainHeight, pathCurve: curve, pathCenterline: centerline };
}
