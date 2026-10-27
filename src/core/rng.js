/**
 * Small deterministic random-number helpers. Keeping the scene seeded makes
 * the forest composition stable from one reload to the next.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed = 20261022) {
  const random = mulberry32(seed);
  const range = (min, max) => min + (max - min) * random();
  const int = (min, max) => Math.floor(range(min, max + 1));
  const pick = (items) => items[Math.floor(random() * items.length)];
  const chance = (p) => random() < p;
  const sign = () => (random() < 0.5 ? -1 : 1);
  return { random, range, int, pick, chance, sign };
}

export function hash2(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

export function fbm2(x, y, octaves = 4, gain = 0.5, lacunarity = 2.03) {
  let sum = 0;
  let amplitude = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * noise2(x, y);
    norm += amplitude;
    amplitude *= gain;
    x *= lacunarity;
    y *= lacunarity;
  }
  return sum / norm;
}

export function smoothstep(min, max, value) {
  const x = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function damp(current, target, lambda, delta) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}
