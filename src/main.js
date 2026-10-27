import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTextures } from './core/textures.js';
import { updateWind } from './core/materials.js';
import { createTerrain } from './world/terrain.js';
import { createCabin } from './world/cabin.js';
import { createVegetation } from './world/vegetation.js';
import { createAtmosphere } from './world/atmosphere.js';
import { createButterflies, createBees } from './world/creatures.js';
import { createPostProcessing } from './world/postprocessing.js';
import { createRng } from './core/rng.js';

const canvas = document.querySelector('#scene');
const loader = document.querySelector('#loader');
const loaderBar = document.querySelector('#loaderBar');
const loaderStatus = document.querySelector('#loaderStatus');
const loaderPercent = document.querySelector('#loaderPercent');
const weatherButtons = [...document.querySelectorAll('.weather-btn')];
const resetButton = document.querySelector('#resetView');
const caption = document.querySelector('.place-caption__line');
const placeEyebrow = document.querySelector('.place-caption__eyebrow');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile =
  window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
const quality = isMobile ? 'mobile' : 'desktop';
const isPortrait = () => window.innerHeight > window.innerWidth;

const WEATHER_COPY = {
  sunny: {
    caption: '光穿过松针，落在苔藓屋顶上。',
    eyebrow: '林间居所 · 晴 · 46°N',
  },
  foggy: {
    caption: '雾从林间醒来，世界慢了下来。',
    eyebrow: '林间居所 · 雾 · 46°N',
  },
  dusk: {
    caption: '黄昏把最后一点暖意留在窗上。',
    eyebrow: '林间居所 · 暮 · 46°N',
  },
};

const rng = createRng(20261022);
let ready = false;

function setProgress(progress, label) {
  loaderBar.style.width = `${progress}%`;
  loaderPercent.textContent = `${Math.round(progress)}%`;
  if (label) loaderStatus.textContent = label;
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function getBaseCameraPosition() {
  if (isPortrait()) return new THREE.Vector3(10.7, 5.15, 17.9);
  return new THREE.Vector3(9.55, 4.45, 14.25);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#aebfae');

const camera = new THREE.PerspectiveCamera(
  isPortrait() ? 43 : 38,
  window.innerWidth / window.innerHeight,
  0.1,
  220,
);
const basePosition = getBaseCameraPosition();
camera.position.copy(basePosition).multiplyScalar(1.24);
camera.position.y += 1.1;
camera.lookAt(0, 2.2, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isMobile,
  alpha: false,
  stencil: false,
  powerPreference: 'high-performance',
});
let pixelRatio = Math.min(
  window.devicePixelRatio || 1,
  isMobile ? 1.4 : 1.75,
);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor('#aebfae', 1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.2, 0);
controls.enableDamping = true;
controls.dampingFactor = isMobile ? 0.075 : 0.055;
controls.enablePan = false;
controls.minDistance = isMobile ? 8.4 : 7.4;
controls.maxDistance = isMobile ? 24 : 27;
controls.minPolarAngle = 0.23;
controls.maxPolarAngle = 1.42;
controls.rotateSpeed = 0.52;
controls.zoomSpeed = 0.72;
controls.autoRotateSpeed = 0.12;
controls.enableZoom = true;
controls.enabled = true;
controls.update();

let cameraTween = null;
let idleTime = 0;
let interacting = false;
let weather = 'sunny';

function startCameraTween(position, target, duration = 2.8) {
  cameraTween = {
    start: performance.now(),
    duration: duration * 1000,
    fromPosition: camera.position.clone(),
    toPosition: position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: target.clone(),
  };
}

function updateCameraTween(now) {
  if (!cameraTween) return;
  const raw = Math.min(1, (now - cameraTween.start) / cameraTween.duration);
  const ease = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
  camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, ease);
  controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, ease);
  if (raw >= 1) cameraTween = null;
}

function resetView(animate = true) {
  controls.autoRotate = false;
  idleTime = 0;
  const position = getBaseCameraPosition();
  const target = new THREE.Vector3(0, 2.2, 0);
  if (prefersReducedMotion || !animate) {
    camera.position.copy(position);
    controls.target.copy(target);
    cameraTween = null;
    controls.update();
    return;
  }
  startCameraTween(position, target, 1.7);
}

controls.addEventListener('start', () => {
  cameraTween = null;
  idleTime = 0;
  interacting = true;
  controls.autoRotate = false;
  document.body.classList.add('is-dragging');
});
controls.addEventListener('end', () => {
  interacting = false;
  idleTime = 0;
  document.body.classList.remove('is-dragging');
});

function updateWeatherUi(name) {
  const copy = WEATHER_COPY[name];
  weatherButtons.forEach((button) => {
    const active = button.dataset.weather === name;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.body.dataset.weather = name;
  if (caption) {
    caption.classList.add('is-switching');
    window.setTimeout(() => {
      caption.textContent = copy.caption;
      placeEyebrow.textContent = copy.eyebrow;
      caption.classList.remove('is-switching');
    }, 260);
  }
}

function requestWeather(name) {
  if (!ready) return;
  if (name === weather) {
    updateWeatherUi(name);
    return;
  }
  weather = name;
  atmosphere.setWeather(name);
  updateWeatherUi(name);
}

weatherButtons.forEach((button) => {
  button.addEventListener('click', () => requestWeather(button.dataset.weather));
});

resetButton.addEventListener('click', () => resetView(true));

window.addEventListener('keydown', (event) => {
  if (event.key === '1') requestWeather('sunny');
  if (event.key === '2') requestWeather('foggy');
  if (event.key === '3') requestWeather('dusk');
  if (event.key.toLowerCase() === 'r') resetView(true);
});

let atmosphere = null;
let cabin = null;
let vegetation = null;
let butterflies = null;
let bees = null;
let post = null;

async function buildWorld() {
  setProgress(7, '正在读取林间光线…');
  await nextFrame();

  const textures = createTextures(renderer);
  setProgress(22, '正在铺开松针与苔地…');
  await nextFrame();

  const terrain = createTerrain(textures, quality);
  scene.add(terrain.group);
  setProgress(40, '正在搭起原木小屋…');
  await nextFrame();

  cabin = createCabin(rng, textures);
  scene.add(cabin.group);
  setProgress(58, '正在种下蕨类与野花…');
  await nextFrame();

  vegetation = createVegetation({
    textures,
    quality,
    rng,
    pathCenterline: terrain.pathCenterline,
  });
  scene.add(vegetation.group);
  setProgress(74, '正在点亮薄雾与光束…');
  await nextFrame();

  atmosphere = createAtmosphere(scene, renderer, camera, textures, quality);
  atmosphere.setWeather('sunny', true);
  setProgress(84, '正在放飞蝴蝶与蜜蜂…');
  await nextFrame();

  butterflies = createButterflies(textures.butterflyWing, quality);
  scene.add(butterflies.group);
  bees = createBees(textures, quality, vegetation.sunflowerHeadPositions);
  scene.add(bees.group);
  setProgress(91, '正在调亮最后一束光…');
  await nextFrame();

  post = createPostProcessing(renderer, scene, camera, quality);
  post.setSize(window.innerWidth, window.innerHeight);
  setProgress(96, '正在等待一只蝴蝶落定…');
  await nextFrame();

  camera.position.copy(getBaseCameraPosition()).multiplyScalar(1.24);
  camera.position.y += 1.1;
  controls.target.set(0, 2.2, 0);
  controls.update();
  atmosphere.update(0.016, 0);
  updateWind(0, 1);
  cabin.setGlowLevel(atmosphere.state.windows);
  post.update(atmosphere.state, 0);
  post.render(0.016);

  setProgress(100, '林间已经准备好了。');
  await nextFrame();
  ready = true;
  document.body.classList.add('is-ready');
  loader.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => {
    loader.style.display = 'none';
  }, 1300);

  if (!prefersReducedMotion) {
    startCameraTween(getBaseCameraPosition(), new THREE.Vector3(0, 2.2, 0), 3.4);
  } else {
    resetView(false);
  }
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.fov = isPortrait() ? 43 : 38;
  camera.updateProjectionMatrix();
  const nextPixelRatio = Math.min(
    window.devicePixelRatio || 1,
    isMobile ? 1.4 : 1.75,
  );
  if (nextPixelRatio !== pixelRatio) {
    pixelRatio = nextPixelRatio;
    renderer.setPixelRatio(pixelRatio);
  }
  renderer.setSize(width, height);
  if (post) {
    post.setPixelRatio(pixelRatio);
    post.setSize(width, height);
  }
  if (atmosphere) atmosphere.setPixelRatio(pixelRatio);
}

window.addEventListener('resize', onResize, { passive: true });

const clock = new THREE.Clock();
let elapsed = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  elapsed += delta;

  updateCameraTween(now);
  idleTime += delta;

  if (
    ready &&
    !interacting &&
    !cameraTween &&
    !controls.autoRotate &&
    idleTime > 19 &&
    !prefersReducedMotion
  ) {
    controls.autoRotate = true;
  }

  controls.update();

  if (ready && atmosphere) {
    atmosphere.update(delta, elapsed);
    updateWind(elapsed, 1);
    cabin.setGlowLevel(atmosphere.state.windows);
    cabin.update(elapsed);
    vegetation.update(elapsed);
    butterflies.update(elapsed);
    bees.update(elapsed);
    post.update(atmosphere.state, elapsed);
    post.render(delta);
  } else {
    renderer.render(scene, camera);
  }
}

// Make the scene inspectable while developing and for automated visual checks.
window.__FOREST__ = {
  get scene() {
    return scene;
  },
  get camera() {
    return camera;
  },
  get renderer() {
    return renderer;
  },
  get controls() {
    return controls;
  },
  get atmosphere() {
    return atmosphere;
  },
  setWeather: (name) => requestWeather(name),
  resetView,
  get ready() {
    return ready;
  },
};

updateWeatherUi('sunny');
requestAnimationFrame(animate);
buildWorld().catch((error) => {
  console.error(error);
  loaderStatus.textContent = '林间起雾了，请刷新页面再试一次。';
  loaderPercent.textContent = '—';
  loaderBar.style.width = '100%';
  loaderBar.style.opacity = '0.35';
});
