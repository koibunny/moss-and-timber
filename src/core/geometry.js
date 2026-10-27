import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

export function transformGeometry(
  geometry,
  { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {},
) {
  const clone = geometry.clone();
  _position.fromArray(position);
  _euler.set(rotation[0], rotation[1], rotation[2]);
  _quaternion.setFromEuler(_euler);
  _scale.fromArray(scale);
  _matrix.compose(_position, _quaternion, _scale);
  clone.applyMatrix4(_matrix);
  return clone;
}

export function colorizeGeometry(geometry, color) {
  const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  if (!clone.attributes.normal) clone.computeVertexNormals();
  const count = clone.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const threeColor = color instanceof THREE.Color ? color : new THREE.Color(color);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = threeColor.r;
    colors[i * 3 + 1] = threeColor.g;
    colors[i * 3 + 2] = threeColor.b;
  }
  clone.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return clone;
}

/**
 * Merge geometries used by untextured props. UVs are intentionally dropped so
 * that primitives from different sources share an identical attribute set.
 */
export function mergeSimple(geometries) {
  const normalized = geometries.map((geometry) => {
    const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(clone.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color') {
        clone.deleteAttribute(name);
      }
    }
    if (!clone.attributes.normal) clone.computeVertexNormals();
    return clone;
  });
  return mergeGeometries(normalized, false);
}

export function mergeTextured(geometries) {
  const normalized = geometries.map((geometry) => {
    const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(clone.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') {
        clone.deleteAttribute(name);
      }
    }
    if (!clone.attributes.normal) clone.computeVertexNormals();
    if (!clone.attributes.uv) {
      const count = clone.attributes.position.count;
      clone.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    return clone;
  });
  return mergeGeometries(normalized, false);
}
