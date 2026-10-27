import * as THREE from 'three';
import { mergeSimple } from '../core/geometry.js';

function createButterflyBody() {
  const geometries = [];
  const body = new THREE.SphereGeometry(0.045, 8, 6);
  body.scale(0.62, 0.72, 2.8);
  body.translate(0, 0, 0);
  geometries.push(body);
  const head = new THREE.SphereGeometry(0.038, 8, 6);
  head.translate(0, 0, 0.13);
  geometries.push(head);
  for (const side of [-1, 1]) {
    const antenna = new THREE.CylinderGeometry(0.0035, 0.002, 0.14, 3);
    antenna.rotateX(0.9);
    antenna.rotateZ(side * 0.34);
    antenna.translate(side * 0.028, 0.07, 0.2);
    geometries.push(antenna);
  }
  return mergeSimple(geometries);
}

function createButterfly(wingTexture, index) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x261b16,
    roughness: 0.78,
    metalness: 0.06,
  });
  const body = new THREE.Mesh(createButterflyBody(), bodyMaterial);
  body.castShadow = false;
  group.add(body);

  const wingMaterial = new THREE.MeshStandardMaterial({
    map: wingTexture,
    color: index % 2 === 0 ? 0xffffff : 0xffe9d2,
    transparent: true,
    opacity: 0.99,
    alphaTest: 0.055,
    side: THREE.DoubleSide,
    roughness: 0.82,
    metalness: 0,
    depthWrite: false,
  });

  const wingGeometry = new THREE.PlaneGeometry(0.48, 0.42);
  wingGeometry.translate(0.24, 0, 0);

  const rightPivot = new THREE.Group();
  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.rotation.x = -Math.PI / 2;
  rightWing.position.y = 0.01;
  rightPivot.add(rightWing);
  group.add(rightPivot);

  const leftPivot = new THREE.Group();
  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.rotation.x = -Math.PI / 2;
  leftWing.position.y = 0.01;
  leftWing.scale.x = -1;
  leftPivot.add(leftWing);
  group.add(leftPivot);

  group.scale.setScalar(0.9 + index * 0.05);
  return { group, leftPivot, rightPivot };
}

export function createButterflies(wingTexture, quality) {
  const group = new THREE.Group();
  group.name = 'Butterflies';
  const count = quality === 'mobile' ? 3 : 4;
  const butterflies = [];
  const orbits = [
    { cx: 0.5, cz: 5.4, rx: 3.4, rz: 2.1, height: 1.65, speed: 0.24, phase: 0.4 },
    { cx: 4.5, cz: 3.5, rx: 2.2, rz: 1.6, height: 1.7, speed: 0.3, phase: 2.0 },
    { cx: -3.9, cz: 4.3, rx: 2.5, rz: 1.7, height: 1.35, speed: 0.27, phase: 4.4 },
    { cx: 1.6, cz: 4.8, rx: 3.2, rz: 2.0, height: 2.0, speed: 0.2, phase: 5.4 },
  ];

  for (let i = 0; i < count; i += 1) {
    const butterfly = createButterfly(wingTexture, i);
    butterfly.orbit = orbits[i];
    butterfly.wingPhase = i * 3.4 + 0.8;
    group.add(butterfly.group);
    butterflies.push(butterfly);
  }

  const tempAhead = new THREE.Vector3();

  return {
    group,
    update(time) {
      for (const butterfly of butterflies) {
        const orbit = butterfly.orbit;
        const t = time * orbit.speed + orbit.phase;
        const x = orbit.cx + Math.cos(t) * orbit.rx;
        const z = orbit.cz + Math.sin(t * 0.83) * orbit.rz;
        const y =
          orbit.height +
          Math.sin(t * 1.8) * 0.24 +
          Math.sin(t * 0.53 + 1.2) * 0.32;
        butterfly.group.position.set(x, y, z);

        const tAhead = t + 0.04;
        tempAhead.set(
          orbit.cx + Math.cos(tAhead) * orbit.rx,
          y + Math.sin(t * 1.8 + 0.2) * 0.08,
          orbit.cz + Math.sin(tAhead * 0.83) * orbit.rz,
        );
        butterfly.group.lookAt(tempAhead);

        const flap = Math.sin(time * 25 + butterfly.wingPhase) * 0.95 + 0.08;
        butterfly.rightPivot.rotation.z = flap;
        butterfly.leftPivot.rotation.z = -flap;
      }
    },
  };
}

function createBeeBody(textures) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    map: textures.bee,
    roughness: 0.62,
    metalness: 0.02,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c160d,
    roughness: 0.72,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), bodyMaterial);
  body.scale.set(0.9, 0.86, 1.55);
  body.castShadow = false;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), darkMaterial);
  head.position.z = 0.13;
  head.scale.set(0.92, 0.9, 0.82);
  group.add(head);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.08, 6), darkMaterial);
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -0.15;
  group.add(tail);

  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9f2e8,
    transparent: true,
    opacity: 0.38,
    roughness: 0.2,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const wingGeometry = new THREE.PlaneGeometry(0.3, 0.14);
  wingGeometry.translate(0.15, 0, 0);
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    const wing = new THREE.Mesh(wingGeometry, wingMaterial);
    wing.rotation.x = -Math.PI / 2;
    wing.position.y = 0.06;
    wing.scale.x = side;
    pivot.add(wing);
    pivot.position.z = -0.02;
    group.add(pivot);
    wings.push({ pivot, side });
  }

  group.scale.setScalar(0.88);
  return { group, wings };
}

export function createBees(textures, quality, headPositions) {
  const group = new THREE.Group();
  group.name = 'Bees';
  const count = quality === 'mobile' ? 2 : 4;
  const bees = [];
  const fallback = [
    new THREE.Vector3(4.05, 2.3, 2.7),
    new THREE.Vector3(4.85, 1.9, 3.35),
    new THREE.Vector3(-4.35, 2.0, 3.05),
    new THREE.Vector3(3.35, 1.6, 4.0),
  ];
  for (let i = 0; i < count; i += 1) {
    const bee = createBeeBody(textures);
    bee.target = headPositions[i] ?? fallback[i];
    bee.phase = i * 2.8 + 0.5;
    bee.radiusX = 0.48 + i * 0.13;
    bee.radiusZ = 0.36 + i * 0.1;
    bee.radiusY = 0.16 + i * 0.04;
    group.add(bee.group);
    bees.push(bee);
  }

  return {
    group,
    update(time) {
      for (const bee of bees) {
        const t = time * (1.1 + bee.phase * 0.03) + bee.phase;
        const x = bee.target.x + Math.sin(t * 1.3) * bee.radiusX;
        const y = bee.target.y + 0.12 + Math.sin(t * 2.6) * bee.radiusY;
        const z = bee.target.z + Math.cos(t * 1.1) * bee.radiusZ;
        bee.group.position.set(x, y, z);
        bee.group.rotation.y = Math.sin(t * 0.7) * 0.7;
        bee.group.rotation.z = Math.sin(t * 4.2) * 0.035;
        const flap = Math.sin(time * 42 + bee.phase) * 1.05;
        bee.wings[0].pivot.rotation.z = flap * bee.wings[0].side;
        bee.wings[1].pivot.rotation.z = flap * bee.wings[1].side;
      }
    },
  };
}
