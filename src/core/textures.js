import * as THREE from 'three';
import { fbm2, hash2, noise2, smoothstep } from './rng.js';

function canvas(size, height = size) {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = height;
  return { element, ctx: element.getContext('2d', { willReadFrequently: true }) };
}

function toTexture(element, options = {}) {
  const {
    colorSpace = THREE.SRGBColorSpace,
    wrap = THREE.RepeatWrapping,
    repeat = [1, 1],
    anisotropy = 4,
    minFilter = THREE.LinearMipmapLinearFilter,
  } = options;
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = colorSpace;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = anisotropy;
  texture.minFilter = minFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function makeGroundTexture(anisotropy) {
  const size = 512;
  const { element, ctx } = canvas(size);
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const broad = fbm2(x * 0.0075, y * 0.0075, 4);
      const moss = smoothstep(0.37, 0.7, broad);
      const fine = fbm2(x * 0.045 + 14.2, y * 0.045 - 8.7, 3);
      const grain = hash2(x * 1.3, y * 1.3);

      let r = mix(62, 82, moss);
      let g = mix(58, 91, moss);
      let b = mix(42, 55, moss);
      const shade = (fine - 0.5) * 25 + (grain - 0.5) * 13;
      r += shade;
      g += shade * 1.05;
      b += shade * 0.72;

      if (grain > 0.982) {
        r += 23;
        g += 19;
        b += 11;
      }
      if (moss > 0.56 && grain < 0.1) {
        r += 12;
        g += 15;
        b += 5;
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  // Fine root-like strokes and scattered needles.
  ctx.lineCap = 'round';
  for (let n = 0; n < 34; n += 1) {
    let x = hash2(n, 4.2) * size;
    let y = hash2(n, 8.9) * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const angle = hash2(n, 12.4) * Math.PI * 2;
    const length = 8 + hash2(n, 18.3) * 32;
    ctx.quadraticCurveTo(
      x + Math.cos(angle) * length * 0.5 + 5,
      y + Math.sin(angle) * length * 0.5,
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length,
    );
    ctx.strokeStyle = `rgba(47, 38, 25, ${0.08 + hash2(n, 1.1) * 0.13})`;
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  for (let n = 0; n < 180; n += 1) {
    const x = hash2(n, 2.2) * size;
    const y = hash2(n, 3.4) * size;
    const angle = hash2(n, 6.5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * 3.4, y + Math.sin(angle) * 3.4);
    ctx.strokeStyle = `rgba(166, 158, 108, ${0.08 + hash2(n, 9.1) * 0.16})`;
    ctx.lineWidth = 0.65;
    ctx.stroke();
  }

  return toTexture(element, { repeat: [9, 9], anisotropy });
}

function makeWoodTexture(anisotropy, { dark = false } = {}) {
  const size = 512;
  const { element, ctx } = canvas(size);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const baseR = dark ? 52 : 78;
  const baseG = dark ? 34 : 53;
  const baseB = dark ? 23 : 37;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const warp = fbm2(x * 0.013, y * 0.0029, 4) * 2 - 1;
      const grain =
        Math.sin(x * 0.18 + warp * 9.5) * 0.5 +
        Math.sin(x * 0.42 + warp * 16 + y * 0.003) * 0.24 +
        noise2(x * 0.38, y * 0.012) * 0.26;
      const fibres = noise2(x * 1.4, y * 0.075) * 0.24;
      const value = grain * 0.46 + fibres + 0.5;
      const tone = 0.55 + value * 0.58;
      const knot =
        Math.max(0, 1 - Math.hypot((x - 340) / 24, (y - 132) / 91)) *
        Math.max(0, 1 - Math.hypot((x - 344) / 9, (y - 132) / 60));

      let r = baseR * tone - knot * 24;
      let g = baseG * tone - knot * 17;
      let b = baseB * tone - knot * 12;
      if (grain > 0.78) {
        r += 11;
        g += 8;
        b += 5;
      }
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  ctx.globalCompositeOperation = 'multiply';
  for (let n = 0; n < 26; n += 1) {
    const x = hash2(n, 5.7) * size;
    const y = hash2(n, 19.2) * size;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.2 + hash2(n, 2.8) * 4.4, 9 + hash2(n, 8.3) * 28, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(45, 26, 14, ${0.08 + hash2(n, 4.8) * 0.16})`;
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  return toTexture(element, {
    repeat: [1, 2.2],
    anisotropy,
  });
}

function makeBarkTexture(anisotropy) {
  const size = 256;
  const { element, ctx } = canvas(size);
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const ridge = Math.abs(fbm2(x * 0.028, y * 0.004, 4) * 2 - 1);
      const fine = noise2(x * 0.85, y * 0.05);
      const crack = smoothstep(0.1, 0.55, ridge);
      const value = 0.2 + crack * 0.65 + fine * 0.14;
      data[i] = 31 + value * 64;
      data[i + 1] = 24 + value * 43;
      data[i + 2] = 17 + value * 28;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(element, { repeat: [2, 3], anisotropy });
}

function makeStoneTexture(anisotropy) {
  const size = 512;
  const { element, ctx } = canvas(size);
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const n = fbm2(x * 0.012, y * 0.012, 5);
      const grit = noise2(x * 0.55, y * 0.55);
      const moss = smoothstep(0.52, 0.76, fbm2(x * 0.007 + 21, y * 0.007 - 7, 3));
      const value = 66 + n * 58 + (grit - 0.5) * 22;
      let r = value * 0.92 + moss * 18;
      let g = value * 0.97 + moss * 31;
      let b = value * 0.94 + moss * 9;
      if (grit > 0.94) {
        r += 20;
        g += 20;
        b += 18;
      }
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  for (let n = 0; n < 18; n += 1) {
    let x = hash2(n, 41.3) * size;
    let y = hash2(n, 17.7) * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s += 1) {
      x += (hash2(n + s, 3.1) - 0.5) * 42;
      y += (hash2(n + s, 8.7) - 0.3) * 24;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(31, 32, 28, 0.24)';
    ctx.lineWidth = 1 + hash2(n, 9.2) * 1.5;
    ctx.stroke();
  }

  return toTexture(element, { repeat: [2.2, 2.2], anisotropy });
}

function makeMossTexture(anisotropy) {
  const size = 256;
  const { element, ctx } = canvas(size);
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const n = fbm2(x * 0.024, y * 0.024, 4);
      const dots = noise2(x * 0.75, y * 0.75);
      const value = n * 0.7 + dots * 0.3;
      data[i] = 53 + value * 58;
      data[i + 1] = 75 + value * 68;
      data[i + 2] = 34 + value * 34;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(element, { repeat: [3, 3], anisotropy });
}

function makePathTexture(anisotropy) {
  const size = 512;
  const { element, ctx } = canvas(size);
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const n = fbm2(x * 0.018, y * 0.018, 4);
      const grit = hash2(x * 2.1, y * 2.1);
      const value = n * 0.8 + grit * 0.2;
      data[i] = 77 + value * 44;
      data[i + 1] = 61 + value * 34;
      data[i + 2] = 42 + value * 24;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  for (let n = 0; n < 130; n += 1) {
    const x = hash2(n, 11.4) * size;
    const y = hash2(n, 2.9) * size;
    const radius = 0.6 + hash2(n, 5.1) * 2.1;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.7, hash2(n, 3.7) * 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(47, 39, 30, ${0.1 + hash2(n, 7.4) * 0.2})`;
    ctx.fill();
  }

  return toTexture(element, { repeat: [1, 2], anisotropy });
}

function makeMistTexture() {
  const size = 256;
  const { element, ctx } = canvas(size);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const nx = x / size - 0.5;
      const ny = y / size - 0.5;
      const radial = Math.max(0, 1 - Math.hypot(nx, ny) * 2);
      const cloud = fbm2(x * 0.018, y * 0.018, 4);
      const alpha = Math.pow(radial, 1.5) * (0.28 + cloud * 0.72);
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.max(0, Math.min(255, alpha * 255));
    }
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(element, { wrap: THREE.ClampToEdgeWrapping });
}

function makeButterflyWingTexture() {
  const size = 256;
  const { element, ctx } = canvas(size);
  ctx.clearRect(0, 0, size, size);

  const wingGradient = ctx.createLinearGradient(0, 0, size, size);
  wingGradient.addColorStop(0, '#d88a4e');
  wingGradient.addColorStop(0.4, '#c96b3e');
  wingGradient.addColorStop(0.78, '#8f4030');
  wingGradient.addColorStop(1, '#4f2c28');

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(16, 127);
  ctx.bezierCurveTo(30, 40, 125, 4, 222, 44);
  ctx.bezierCurveTo(246, 72, 209, 122, 135, 139);
  ctx.bezierCurveTo(82, 148, 36, 143, 16, 127);
  ctx.closePath();
  ctx.fillStyle = wingGradient;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(42, 25, 21, 0.9)';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(18, 133);
  ctx.bezierCurveTo(68, 139, 142, 145, 174, 189);
  ctx.bezierCurveTo(180, 226, 129, 242, 80, 220);
  ctx.bezierCurveTo(42, 203, 20, 170, 18, 133);
  ctx.closePath();
  ctx.fillStyle = wingGradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(42, 25, 21, 0.9)';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = 'rgba(255, 222, 173, 0.55)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(38, 128 + i * 7);
    ctx.quadraticCurveTo(102, 80 - i * 4, 193, 62 + i * 7);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(36, 142);
    ctx.quadraticCurveTo(92, 151 + i * 10, 149, 188 + i * 8);
    ctx.stroke();
  }
  ctx.restore();

  const spots = [
    [178, 66, 17, '#f1d6a0'],
    [203, 87, 11, '#f3dfb6'],
    [160, 98, 9, '#f0d4a2'],
    [126, 76, 7, '#f6e5c4'],
    [98, 181, 11, '#e9c894'],
    [132, 201, 8, '#efd5a8'],
    [69, 190, 7, '#e8c792'],
  ];
  for (const [x, y, r, color] of spots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(47, 28, 22, 0.28)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(66, 96, 13, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(49, 82, 78, 0.85)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(61, 92, 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(237, 216, 173, 0.65)';
  ctx.fill();

  return toTexture(element, {
    wrap: THREE.ClampToEdgeWrapping,
    colorSpace: THREE.SRGBColorSpace,
  });
}

function makeBeeTexture() {
  const size = 128;
  const { element, ctx } = canvas(size);
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#1c1710');
  gradient.addColorStop(0.24, '#e0a63d');
  gradient.addColorStop(0.4, '#d18f2d');
  gradient.addColorStop(0.52, '#241b10');
  gradient.addColorStop(0.68, '#e1a83f');
  gradient.addColorStop(0.84, '#2a1d12');
  gradient.addColorStop(1, '#181109');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 200; i += 1) {
    ctx.fillStyle = `rgba(255, 219, 144, ${0.03 + hash2(i, 1.2) * 0.07})`;
    ctx.fillRect(hash2(i, 2.3) * size, hash2(i, 4.1) * size, 1.2, 1.2);
  }
  return toTexture(element, { wrap: THREE.ClampToEdgeWrapping });
}

export function createTextures(renderer) {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return {
    ground: makeGroundTexture(anisotropy),
    wood: makeWoodTexture(anisotropy),
    darkWood: makeWoodTexture(anisotropy, { dark: true }),
    bark: makeBarkTexture(anisotropy),
    stone: makeStoneTexture(anisotropy),
    moss: makeMossTexture(anisotropy),
    path: makePathTexture(anisotropy),
    mist: makeMistTexture(),
    butterflyWing: makeButterflyWingTexture(),
    bee: makeBeeTexture(),
  };
}
