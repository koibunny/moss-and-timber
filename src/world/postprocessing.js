import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.34 },
    uGrain: { value: 0.028 },
    uWarmth: { value: 0.3 },
    uSaturation: { value: 1.03 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uWarmth;
    uniform float uSaturation;
    varying vec2 vUv;

    float random(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float aspect = uResolution.x / max(1.0, uResolution.y);
      float aberration = 0.0014 * dot(centered, centered);
      vec3 color;
      color.r = texture2D(tDiffuse, vUv + centered * aberration).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv - centered * aberration).b;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float saturationMix = mix(1.0, uSaturation, smoothstep(0.0, 0.3, luma));
      color = mix(vec3(luma), color, saturationMix);

      color *= vec3(
        1.0 + 0.025 * uWarmth,
        1.0 + 0.006 * uWarmth,
        1.0 - 0.02 * uWarmth
      );
      color += vec3(-0.006, 0.002, 0.009) * (1.0 - smoothstep(0.0, 0.42, luma));

      vec2 vignetteUv = centered * vec2(mix(1.0, aspect, 0.35), 1.0);
      float vignette = smoothstep(0.86, 0.22, length(vignetteUv));
      color *= mix(1.0, vignette, uVignette);

      float grain = random(vUv * uResolution + fract(uTime) * 917.0) - 0.5;
      color += grain * uGrain * (0.55 + (1.0 - luma) * 0.65);

      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

export function createPostProcessing(renderer, scene, camera, quality) {
  const isMobile = quality === 'mobile';
  const composer = new EffectComposer(renderer);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.46,
    0.72,
    0.84,
  );
  const gradePass = new ShaderPass(CinematicShader);
  gradePass.material.uniforms.uGrain.value = isMobile ? 0.022 : 0.028;
  const outputPass = new OutputPass();

  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);
  composer.addPass(gradePass);

  function setSize(width, height) {
    composer.setSize(width, height);
    gradePass.material.uniforms.uResolution.value.set(
      width * renderer.getPixelRatio(),
      height * renderer.getPixelRatio(),
    );
  }
  setSize(window.innerWidth, window.innerHeight);

  return {
    composer,
    bloomPass,
    gradePass,
    render(dt) {
      composer.render(dt);
    },
    update(state, time) {
      bloomPass.strength = state.bloom;
      bloomPass.radius = isMobile ? 0.56 : 0.72;
      gradePass.material.uniforms.uTime.value = time;
      gradePass.material.uniforms.uWarmth.value = state.warmth;
      gradePass.material.uniforms.uGrain.value = state.grain * (isMobile ? 0.72 : 0.86);
      gradePass.material.uniforms.uVignette.value = isMobile ? 0.3 : 0.36;
    },
    setSize,
    setPixelRatio(pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      setSize(window.innerWidth, window.innerHeight);
    },
  };
}
