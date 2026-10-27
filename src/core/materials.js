import * as THREE from 'three';

export const windUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
};

export function updateWind(time, strength = 1) {
  windUniforms.uTime.value = time;
  windUniforms.uWind.value = strength;
}

/**
 * A MeshStandardMaterial with a small, height-weighted vertex sway. It works
 * for both instanced and ordinary meshes and keeps PBR lighting / shadows.
 */
export function createWindMaterial(params = {}) {
  const {
    color = 0x49633d,
    roughness = 0.92,
    metalness = 0,
    side = THREE.DoubleSide,
    height = 0.9,
    amplitude = 0.055,
    speed = 1.15,
    vertexColors = false,
  } = params;

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    side,
    vertexColors,
  });

  const key = `sway-${height.toFixed(2)}-${amplitude.toFixed(3)}-${speed.toFixed(2)}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nuniform float uWind;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 windWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vec3 windWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        #endif
        float windBend = smoothstep(0.0, ${height.toFixed(2)}, position.y);
        float windPhase = windWorld.x * 0.53 + windWorld.z * 0.37;
        transformed.x += sin(uTime * ${speed.toFixed(2)} + windPhase) * ${amplitude.toFixed(
          3,
        )} * windBend * uWind;
        transformed.z += cos(uTime * ${(speed * 0.83).toFixed(2)} + windPhase * 1.31) * ${(
          amplitude * 0.62
        ).toFixed(3)} * windBend * uWind;`,
      );
  };
  material.customProgramCacheKey = () => key;
  return material;
}

export function setObjectShadow(object, cast = true, receive = true) {
  object.traverse((child) => {
    if (child.isMesh || child.isInstancedMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return object;
}
