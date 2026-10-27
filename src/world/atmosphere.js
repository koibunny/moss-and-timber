import * as THREE from 'three';
import { terrainHeight } from './terrain.js';

const PRESETS = {
  sunny: {
    skyTop: '#5a8caf',
    skyHorizon: '#d8e4d3',
    skyGround: '#7a8d77',
    sunColor: '#ffedc0',
    sunDir: [-0.54, 0.68, -0.4],
    sunIntensity: 3.15,
    hemiSky: '#b7d0d8',
    hemiGround: '#35432d',
    hemiIntensity: 1.34,
    ambientColor: '#a6bdb4',
    ambientIntensity: 0.17,
    fillColor: '#d6d0b8',
    fillIntensity: 0.74,
    fogColor: '#bccab5',
    fogDensity: 0.0135,
    exposure: 1.06,
    bloom: 0.46,
    rays: 0.52,
    mist: 0.2,
    dust: 0.78,
    fireflies: 0,
    windows: 0.72,
    star: 0,
    sunHaze: 1.0,
    warmth: 0.34,
    grain: 0.033,
  },
  foggy: {
    skyTop: '#75898a',
    skyHorizon: '#c1ccc3',
    skyGround: '#707d71',
    sunColor: '#dae2d2',
    sunDir: [-0.42, 0.78, -0.34],
    sunIntensity: 1.45,
    hemiSky: '#a2b6b8',
    hemiGround: '#374238',
    hemiIntensity: 1.48,
    ambientColor: '#96a9a5',
    ambientIntensity: 0.3,
    fillColor: '#c5c9bd',
    fillIntensity: 0.7,
    fogColor: '#aebbb1',
    fogDensity: 0.042,
    exposure: 1.0,
    bloom: 0.3,
    rays: 0.2,
    mist: 0.68,
    dust: 0.34,
    fireflies: 0,
    windows: 0.92,
    star: 0,
    sunHaze: 0.55,
    warmth: 0.12,
    grain: 0.04,
  },
  dusk: {
    skyTop: '#232f4d',
    skyHorizon: '#e39b72',
    skyGround: '#4e474b',
    sunColor: '#ffbc7a',
    sunDir: [-0.62, 0.24, -0.45],
    sunIntensity: 2.35,
    hemiSky: '#817c9a',
    hemiGround: '#2d3028',
    hemiIntensity: 0.84,
    ambientColor: '#6b6985',
    ambientIntensity: 0.25,
    fillColor: '#8f8caa',
    fillIntensity: 0.34,
    fogColor: '#6e6d72',
    fogDensity: 0.0215,
    exposure: 1.14,
    bloom: 0.58,
    rays: 0.82,
    mist: 0.26,
    dust: 0.26,
    fireflies: 0.9,
    windows: 1.18,
    star: 0.72,
    sunHaze: 1.3,
    warmth: 0.66,
    grain: 0.045,
  },
};

const NUMERIC_FIELDS = [
  'sunIntensity',
  'hemiIntensity',
  'ambientIntensity',
  'fillIntensity',
  'fogDensity',
  'exposure',
  'bloom',
  'rays',
  'mist',
  'dust',
  'fireflies',
  'windows',
  'star',
  'sunHaze',
  'warmth',
  'grain',
];

const COLOR_FIELDS = [
  'skyTop',
  'skyHorizon',
  'skyGround',
  'sunColor',
  'hemiSky',
  'hemiGround',
  'ambientColor',
  'fillColor',
  'fogColor',
];

function makeState(preset) {
  const state = {};
  for (const field of COLOR_FIELDS) state[field] = new THREE.Color(preset[field]);
  for (const field of NUMERIC_FIELDS) state[field] = preset[field];
  state.sunDir = new THREE.Vector3(...preset.sunDir).normalize();
  return state;
}

function copyState(source, target) {
  for (const field of COLOR_FIELDS) target[field].copy(source[field]);
  for (const field of NUMERIC_FIELDS) target[field] = source[field];
  target.sunDir.copy(source.sunDir);
  return target;
}

function lerpState(from, to, alpha, target) {
  for (const field of COLOR_FIELDS) {
    target[field].copy(from[field]).lerp(to[field], alpha);
  }
  for (const field of NUMERIC_FIELDS) {
    target[field] = THREE.MathUtils.lerp(from[field], to[field], alpha);
  }
  target.sunDir.copy(from.sunDir).lerp(to.sunDir, alpha).normalize();
  return target;
}

function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color('#5a8caf') },
    uHorizon: { value: new THREE.Color('#d8e4d3') },
    uGround: { value: new THREE.Color('#7a8d77') },
    uSunColor: { value: new THREE.Color('#ffedc0') },
    uSunDir: { value: new THREE.Vector3(-0.54, 0.68, -0.4).normalize() },
    uSunHaze: { value: 1 },
    uStar: { value: 0 },
    uTime: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunHaze;
      uniform float uStar;
      uniform float uTime;
      varying vec3 vDirection;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p = p * 2.02 + 17.4;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 dir = normalize(vDirection);
        float h = dir.y;
        vec3 sky = mix(uHorizon, uTop, pow(smoothstep(-0.05, 0.78, h), 0.67));
        sky = mix(uGround, sky, smoothstep(-0.25, 0.025, h));

        float sunDot = max(dot(dir, uSunDir), 0.0);
        float disc = smoothstep(0.99972, 0.99997, sunDot);
        float glowWide = pow(sunDot, 7.0);
        float glowTight = pow(sunDot, 70.0);
        sky += uSunColor * (disc * 2.2 + glowTight * 0.55 + glowWide * 0.13) * uSunHaze;

        float cloudUvX = atan(dir.z, dir.x) * 2.2;
        float cloud = fbm(vec2(cloudUvX + uTime * 0.003, h * 4.3 + 1.7));
        cloud = smoothstep(0.56, 0.79, cloud) * smoothstep(-0.02, 0.16, h);
        cloud *= 1.0 - smoothstep(0.48, 0.86, h);
        sky = mix(sky, uHorizon * 1.02, cloud * 0.13);

        if (uStar > 0.001) {
          float starNoise = hash21(floor(dir.xz * 170.0) + floor(dir.y * 137.0));
          float stars = smoothstep(0.9966, 0.9999, starNoise);
          stars *= smoothstep(0.08, 0.5, h) * (1.0 - smoothstep(0.78, 1.0, h));
          stars *= 0.62 + 0.38 * sin(uTime * 1.3 + starNoise * 83.0);
          sky += vec3(0.7, 0.78, 0.96) * stars * uStar;
        }

        float dither = (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(sky + dither, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(150, 40, 22), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, uniforms };
}

function createBeamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#ffe4b0') },
      uOpacity: { value: 0.25 },
      uPhase: { value: Math.random() * 10 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPhase;
      varying vec2 vUv;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        float edge = smoothstep(0.0, 0.27, vUv.x) * smoothstep(1.0, 0.73, vUv.x);
        float ends = smoothstep(0.0, 0.11, vUv.y) * smoothstep(1.0, 0.67, vUv.y);
        float softNoise = noise(vec2(vUv.x * 3.4 + uPhase, vUv.y * 2.3 - uTime * 0.018));
        float streaks = 0.67 + 0.33 * sin(vUv.x * 32.0 + uPhase * 7.0 + vUv.y * 4.0);
        float alpha = edge * ends * uOpacity * (0.55 + softNoise * 0.65) * streaks;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

function createLightShafts() {
  const group = new THREE.Group();
  group.renderOrder = 2;
  const definitions = [
    { x: -7.4, z: 2.9, width: 4.6, height: 16.5, strength: 0.8 },
    { x: -4.2, z: 0.3, width: 5.6, height: 17.5, strength: 0.72 },
    { x: -0.4, z: -2.8, width: 4.1, height: 15.8, strength: 0.6 },
    { x: 2.5, z: 1.2, width: 4.8, height: 16.8, strength: 0.78 },
    { x: 5.6, z: -1.9, width: 3.7, height: 15.2, strength: 0.58 },
    { x: -9.8, z: -1.8, width: 3.4, height: 15.4, strength: 0.5 },
    { x: 0.8, z: 5.1, width: 3.4, height: 14.6, strength: 0.6 },
  ];
  const beams = [];
  definitions.forEach((definition, index) => {
    const material = createBeamMaterial();
    material.uniforms.uPhase.value = index * 2.13;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    group.add(mesh);
    beams.push({
      mesh,
      material,
      anchor: new THREE.Vector3(
        definition.x,
        terrainHeight(definition.x, definition.z) + 0.3,
        definition.z,
      ),
      width: definition.width,
      height: definition.height,
      strength: definition.strength,
    });
  });
  return { group, beams };
}

function createMist(textures, count = 22) {
  const material = new THREE.SpriteMaterial({
    map: textures.mist,
    color: 0xd9e2d4,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
  });
  const group = new THREE.Group();
  const sprites = [];
  for (let i = 0; i < count; i += 1) {
    const sprite = new THREE.Sprite(material.clone());
    const angle = Math.random() * Math.PI * 2;
    const radius = 2 + Math.random() * 15;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const scale = 7 + Math.random() * 11;
    sprite.position.set(x, 0.35 + Math.random() * 0.8, z);
    sprite.scale.set(scale, scale * 0.42, 1);
    sprite.userData.phase = Math.random() * Math.PI * 2;
    sprite.userData.baseX = x;
    sprite.userData.baseZ = z;
    sprite.userData.speed = 0.035 + Math.random() * 0.04;
    sprite.material.opacity = 0.04 + Math.random() * 0.1;
    sprite.renderOrder = 3;
    group.add(sprite);
    sprites.push(sprite);
  }
  return { group, sprites, material };
}

function createPollen(count, isMobile) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.4 + Math.random() * 15;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = 0.25 + Math.random() * 5.5;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2) },
      uOpacity: { value: 0.7 },
      uColor: { value: new THREE.Color('#ffe7b0') },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uOpacity;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.08 + aSeed * 6.283) * 0.8;
        p.y += sin(uTime * 0.13 + aSeed * 17.0) * 0.28;
        p.z += cos(uTime * 0.1 + aSeed * 11.0) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float flicker = 0.55 + 0.45 * sin(uTime * 0.7 + aSeed * 37.0);
        gl_PointSize = (1.2 + aSeed * 2.4) * uPixelRatio * (18.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
        vAlpha = flicker * uOpacity * smoothstep(1.0, 3.0, -mv.z);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.05, d) * vAlpha;
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

function createFireflies(count) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.2 + Math.random() * 10;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = 0.35 + Math.random() * 2.2;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#ffd27a') },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uOpacity;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * (0.35 + aSeed * 0.36) + aSeed * 40.0;
        p.x += sin(t) * 0.5;
        p.y += sin(t * 1.7 + aSeed * 14.0) * 0.22;
        p.z += cos(t * 1.2 + aSeed * 9.0) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float blink = pow(max(0.0, sin(uTime * (1.2 + aSeed * 1.7) + aSeed * 20.0)), 5.0);
        gl_PointSize = (4.0 + aSeed * 5.5) * (15.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
        vAlpha = blink * uOpacity;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float d = length(centered);
        float core = smoothstep(0.5, 0.0, d);
        float halo = smoothstep(0.5, 0.06, d) * 0.6;
        float alpha = (core * 0.8 + halo) * vAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 4;
  return { points, material };
}

export function createAtmosphere(scene, renderer, camera, textures, quality) {
  const isMobile = quality === 'mobile';
  const state = makeState(PRESETS.sunny);
  const target = makeState(PRESETS.sunny);
  const from = makeState(PRESETS.sunny);
  let currentName = 'sunny';
  let transitionElapsed = 0;
  let transitionDuration = 2.6;
  let transitioning = false;

  const sky = createSky();
  scene.add(sky.mesh);

  const hemi = new THREE.HemisphereLight('#b7d0d8', '#35432d', 1.34);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight('#a6bdb4', 0.17);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight('#ffedc0', 3.15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2.5;
  sun.target.position.set(0, 1.4, 0);
  scene.add(sun, sun.target);

  const fill = new THREE.DirectionalLight('#d6d0b8', 0.74);
  fill.position.set(12, 7, 13);
  scene.add(fill);

  scene.fog = new THREE.FogExp2('#bccab5', 0.0135);

  const shafts = createLightShafts();
  scene.add(shafts.group);

  const mist = createMist(textures, isMobile ? 14 : 22);
  scene.add(mist.group);

  const pollen = createPollen(isMobile ? 220 : 430, isMobile);
  scene.add(pollen.points);

  const fireflies = createFireflies(isMobile ? 30 : 52);
  scene.add(fireflies.points);

  const tempAxisUp = new THREE.Vector3();
  const tempView = new THREE.Vector3();
  const tempCenter = new THREE.Vector3();
  const tempRight = new THREE.Vector3();
  const tempTop = new THREE.Vector3();
  const tempAxis = new THREE.Vector3();
  const tempMatrix = new THREE.Matrix4();
  const white = new THREE.Color(1, 1, 1);

  function applyState() {
    sky.uniforms.uTop.value.copy(state.skyTop);
    sky.uniforms.uHorizon.value.copy(state.skyHorizon);
    sky.uniforms.uGround.value.copy(state.skyGround);
    sky.uniforms.uSunColor.value.copy(state.sunColor);
    sky.uniforms.uSunDir.value.copy(state.sunDir);
    sky.uniforms.uSunHaze.value = state.sunHaze;
    sky.uniforms.uStar.value = state.star;

    hemi.color.copy(state.hemiSky);
    hemi.groundColor.copy(state.hemiGround);
    hemi.intensity = state.hemiIntensity;

    ambient.color.copy(state.ambientColor);
    ambient.intensity = state.ambientIntensity;

    fill.color.copy(state.fillColor);
    fill.intensity = state.fillIntensity;

    sun.color.copy(state.sunColor);
    sun.intensity = state.sunIntensity;
    sun.position.copy(state.sunDir).multiplyScalar(48);

    scene.fog.color.copy(state.fogColor);
    scene.fog.density = state.fogDensity;
    renderer.toneMappingExposure = state.exposure;

    for (const beam of shafts.beams) {
      beam.material.uniforms.uColor.value.copy(state.sunColor);
    }
    mist.sprites.forEach((sprite) => {
      sprite.material.color.copy(state.fogColor).lerp(white, 0.25);
    });
    pollen.material.uniforms.uColor.value.copy(state.sunColor).lerp(white, 0.3);
  }

  function updateBeams(dt, time) {
    tempAxisUp.copy(state.sunDir).negate().normalize();
    for (const beam of shafts.beams) {
      tempTop.copy(beam.anchor).addScaledVector(tempAxisUp, -beam.height);
      tempCenter.copy(beam.anchor).addScaledVector(tempAxisUp, -beam.height / 2);
      tempAxis.copy(tempTop).sub(beam.anchor).normalize();
      const view = tempView.copy(camera.position).sub(tempCenter);
      view.addScaledVector(tempAxis, -view.dot(tempAxis));
      if (view.lengthSq() < 0.0001) view.set(0, 0, 1);
      view.normalize();
      tempRight.crossVectors(tempAxis, view).normalize();
      tempMatrix.makeBasis(tempRight, tempAxis, view);
      beam.mesh.quaternion.setFromRotationMatrix(tempMatrix);
      beam.mesh.position.copy(tempCenter);
      beam.mesh.scale.set(beam.width, beam.height, 1);
      beam.material.uniforms.uTime.value = time;
      beam.material.uniforms.uOpacity.value = state.rays * beam.strength * 0.34;
    }
  }

  function updateMist(time) {
    const baseOpacity = state.mist;
    for (const sprite of mist.sprites) {
      const phase = sprite.userData.phase;
      sprite.position.x = sprite.userData.baseX + Math.sin(time * 0.035 + phase) * 1.8;
      sprite.position.z =
        sprite.userData.baseZ + Math.cos(time * 0.028 + phase * 1.3) * 1.8;
      sprite.material.opacity = (0.025 + baseOpacity * 0.16) * (0.7 + Math.sin(phase) * 0.3);
    }
  }

  function setWeather(name, instant = false) {
    if (!PRESETS[name]) return;
    if (name === currentName && !instant) return;
    copyState(state, from);
    const preset = makeState(PRESETS[name]);
    for (const field of COLOR_FIELDS) target[field].copy(preset[field]);
    for (const field of NUMERIC_FIELDS) target[field] = preset[field];
    target.sunDir.copy(preset.sunDir);
    currentName = name;
    transitionElapsed = 0;
    transitionDuration = name === 'foggy' ? 2.9 : 2.5;
    transitioning = !instant;
    if (instant) {
      copyState(target, state);
      applyState();
      transitioning = false;
    }
  }

  function update(dt, time) {
    if (transitioning) {
      transitionElapsed += dt;
      const raw = Math.min(1, transitionElapsed / transitionDuration);
      const alpha = raw * raw * (3 - 2 * raw);
      lerpState(from, target, alpha, state);
      if (raw >= 1) transitioning = false;
    }
    applyState();

    sky.mesh.position.copy(camera.position);
    sky.uniforms.uTime.value = time;

    updateBeams(dt, time);
    updateMist(time);

    pollen.points.position.x = 0;
    pollen.material.uniforms.uTime.value = time;
    pollen.material.uniforms.uOpacity.value = state.dust * 0.74;
    fireflies.material.uniforms.uTime.value = time;
    fireflies.material.uniforms.uOpacity.value = state.fireflies;
    fireflies.points.visible = state.fireflies > 0.015;
  }

  function setPixelRatio(pixelRatio) {
    pollen.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  setWeather('sunny', true);
  return {
    state,
    setWeather,
    update,
    setPixelRatio,
    get currentName() {
      return currentName;
    },
    sun,
    sky,
    group: shafts.group,
  };
}
