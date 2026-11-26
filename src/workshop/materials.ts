import * as THREE from 'three';

export interface WorkshopMaterials {
  floorMat: THREE.MeshStandardMaterial;
  wallMat: THREE.MeshStandardMaterial;
  ceilingMat: THREE.MeshStandardMaterial;
  tileMat: THREE.MeshStandardMaterial;
  quartzMat: THREE.MeshStandardMaterial;
  butcherBlockMat: THREE.MeshStandardMaterial;
  cabinetMat: THREE.MeshStandardMaterial;
  cabinetDarkMat: THREE.MeshStandardMaterial;
  stainlessMat: THREE.MeshStandardMaterial;
  chromeMat: THREE.MeshStandardMaterial;
  darkMetalMat: THREE.MeshStandardMaterial;
  brassMat: THREE.MeshStandardMaterial;
  matPadMat: THREE.MeshStandardMaterial;
  pvcMat: THREE.MeshStandardMaterial;
  pvcCutEdgeMat: THREE.MeshStandardMaterial;
  pvcAcrylicWindowMat: THREE.MeshPhysicalMaterial;
  pvcXrayMat: THREE.MeshPhysicalMaterial;
  waterMat: THREE.MeshPhysicalMaterial;
  waterStreamMat: THREE.MeshPhysicalMaterial;
  netCupMat: THREE.MeshStandardMaterial;
  lecaMat: THREE.MeshStandardMaterial;
  substrateDryMat: THREE.MeshStandardMaterial;
  substrateWetMat: THREE.MeshStandardMaterial;
  wickDryMat: THREE.MeshStandardMaterial;
  wickWetMat: THREE.MeshStandardMaterial;
  seedMat: THREE.MeshStandardMaterial;
  stemMat: THREE.MeshStandardMaterial;
  leafMat: THREE.MeshStandardMaterial;
  leafLightMat: THREE.MeshStandardMaterial;
  sawFrameMat: THREE.MeshStandardMaterial;
  sawGripMat: THREE.MeshStandardMaterial;
  drillBodyMat: THREE.MeshStandardMaterial;
  windowGlowMat: THREE.MeshBasicMaterial;
  pendantGlowMat: THREE.MeshStandardMaterial;
  rackReclaimedPvcMat: THREE.MeshStandardMaterial;
  rackPalletWoodMat: THREE.MeshStandardMaterial;
  rackScrapMetalMat: THREE.MeshStandardMaterial;
  rackUpcycledHdpeMat: THREE.MeshStandardMaterial;
  rackStandardPvcMat: THREE.MeshStandardMaterial;
  rackStandardTimberMat: THREE.MeshStandardMaterial;
  rackLinerMat: THREE.MeshStandardMaterial;
  rackUnbuiltGhostMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function createSubwayTileTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#e6d7c3'; // warm sand grout
  ctx.fillRect(0, 0, 512, 512);

  const rows = 4;
  const cols = 4;
  const tileH = 512 / rows;
  const tileW = 512 / cols;
  const gap = 5;

  const palettes = [
    { bg: '#faf1e4', accent: '#c9643b', motif: '#1e6b6b' }, // warm cream + terracotta + Cape teal
    { bg: '#1e6b6b', accent: '#f4c563', motif: '#faf1e4' }, // rich teal + ochre + ivory
    { bg: '#c9643b', accent: '#faf1e4', motif: '#f4c563' }, // terracotta + cream + saffron
    { bg: '#f6ead7', accent: '#287271', motif: '#d97736' }, // sunlit ivory + sage-teal + burnt orange
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileW + gap * 0.5;
      const y = r * tileH + gap * 0.5;
      const w = tileW - gap;
      const h = tileH - gap;
      const p = palettes[(r + c) % palettes.length];

      ctx.fillStyle = p.bg;
      ctx.fillRect(x, y, w, h);

      // Hand-painted ceramic border frame
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);

      // Center diamond & floral petal ceramic motif
      const cx = x + w * 0.5;
      const cy = y + h * 0.5;
      ctx.fillStyle = p.motif;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 26);
      ctx.lineTo(cx + 26, cy);
      ctx.lineTo(cx, cy + 26);
      ctx.lineTo(cx - 26, cy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();

      // Glazed highlight edge
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = 'rgba(120,75,45,0.18)';
      ctx.fillRect(x, y + h - 3, w, 3);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 1.15);
  return tex;
}

function createQuartzTexture(): THREE.CanvasTexture {
  // Rich natural honey-teak wood grain texture for perimeter counters & workbenches
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#b97e48';
  ctx.fillRect(0, 0, 512, 512);

  const planks = 10;
  const plankH = 512 / planks;
  const tones = ['#c38750', '#b47741', '#cc9057', '#ab6f3b', '#bf824b'];

  for (let p = 0; p < planks; p++) {
    const y = p * plankH;
    ctx.fillStyle = tones[p % tones.length];
    ctx.fillRect(0, y, 512, plankH - 1.5);

    ctx.strokeStyle = 'rgba(84, 46, 16, 0.22)';
    ctx.lineWidth = 1.4;
    for (let g = 0; g < 6; g++) {
      const gy = y + 5 + g * (plankH / 6.5);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= 512; x += 24) {
        ctx.lineTo(x, gy + Math.sin(x * 0.024 + p * 1.7 + g) * 2.1);
      }
      ctx.stroke();
    }

    // Occasional subtle wood knot ring
    if (p % 3 === 1) {
      const kx = 120 + (p * 97) % 280;
      const ky = y + plankH * 0.5;
      ctx.strokeStyle = 'rgba(78, 42, 14, 0.26)';
      ctx.beginPath();
      ctx.ellipse(kx, ky, 14, 5, 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(68, 36, 12, 0.34)';
    ctx.fillRect(0, y + plankH - 1.5, 512, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 1.2);
  return tex;
}

function createButcherBlockTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const strips = 16;
  const stripH = 512 / strips;
  const tones = ['#c89056', '#be8449', '#d29b61', '#b4783e', '#cc945a', '#c3884e'];

  for (let s = 0; s < strips; s++) {
    const y = s * stripH;
    ctx.fillStyle = tones[s % tones.length];
    ctx.fillRect(0, y, 512, stripH);

    // Wood grain lines along each stave
    ctx.strokeStyle = 'rgba(92, 54, 22, 0.16)';
    ctx.lineWidth = 1.2;
    for (let g = 0; g < 5; g++) {
      const gy = y + 4 + g * (stripH / 5.5);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= 512; x += 32) {
        ctx.lineTo(x, gy + Math.sin(x * 0.03 + s * 2.1 + g) * 1.4);
      }
      ctx.stroke();
    }

    // Stave seam
    ctx.fillStyle = 'rgba(72, 42, 16, 0.28)';
    ctx.fillRect(0, y + stripH - 1.5, 512, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.8, 1);
  return tex;
}

function createOakFloorTexture(): THREE.CanvasTexture {
  // Warm earthy South African terracotta floor tiles
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#d7c4ac'; // warm sandy mortar grout
  ctx.fillRect(0, 0, 512, 512);

  const grid = 4;
  const tileSize = 512 / grid;
  const gap = 7;
  const terracottaShades = ['#c66b47', '#b95e3c', '#cf754f', '#be6340', '#c86e4a'];

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const x = c * tileSize + gap * 0.5;
      const y = r * tileSize + gap * 0.5;
      const size = tileSize - gap;
      const base = terracottaShades[(r * 3 + c * 2) % terracottaShades.length];

      ctx.fillStyle = base;
      ctx.fillRect(x, y, size, size);

      // Warm fired-clay tonal variation & subtle glaze sheen
      ctx.fillStyle = 'rgba(255, 224, 190, 0.14)';
      ctx.fillRect(x + 4, y + 4, size - 14, size * 0.42);
      ctx.fillStyle = 'rgba(92, 38, 18, 0.15)';
      ctx.fillRect(x + 4, y + size - 10, size - 8, 6);

      // Speckled clay kiln flecks
      for (let f = 0; f < 16; f++) {
        const fx = x + 10 + (((r * 37 + c * 59 + f * 23) % 90) / 100) * (size - 20);
        const fy = y + 10 + (((r * 61 + c * 43 + f * 31) % 90) / 100) * (size - 20);
        ctx.fillStyle = f % 2 === 0 ? 'rgba(98, 42, 22, 0.2)' : 'rgba(255, 212, 175, 0.22)';
        ctx.fillRect(fx, fy, 3, 2);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createWarmPlasterTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#f5e6d2'); // warm cream upper plaster
  grad.addColorStop(0.65, '#f0d8be'); // sunlit honey-cream mid
  grad.addColorStop(1, '#e4be9c'); // soft terracotta warmth near lower dado
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle hand-troweled limewash plaster mottling
  for (let i = 0; i < 240; i++) {
    const x = ((Math.sin(i * 15.7) * 43758.5) % 1 + 1) % 1 * 512;
    const y = ((Math.sin(i * 63.3) * 19341.2) % 1 + 1) % 1 * 512;
    const r = 14 + (i % 24);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 248, 236, 0.14)' : 'rgba(205, 134, 88, 0.08)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(2.5, 1);
  return tex;
}

function createBrushedSteelTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#c9d0d6';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    const v = 190 + Math.round(Math.sin(y * 1.7) * 14 + ((y * 37) % 12));
    ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 8})`;
    ctx.fillRect(0, y, 256, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createPalletWoodTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const plankColors = ['#a87442', '#946134', '#b5804c', '#88562b'];
  const h = 256 / 4;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = plankColors[i];
    ctx.fillRect(0, i * h, 256, h - 2);
    ctx.strokeStyle = 'rgba(54, 30, 12, 0.26)';
    ctx.lineWidth = 1.4;
    for (let g = 0; g < 5; g++) {
      const gy = i * h + 8 + g * 11;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= 256; x += 24) {
        ctx.lineTo(x, gy + Math.sin(x * 0.04 + i + g) * 2.2);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40, 22, 10, 0.55)';
    ctx.fillRect(0, (i + 1) * h - 2, 256, 2);
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(22, i * h + h * 0.5, 3.2, 0, Math.PI * 2);
    ctx.arc(234, i * h + h * 0.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function createUpcycledHdpeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(0, 0, 256, 256);
  const flecks = ['#5eead4', '#134e4a', '#99f6e4', '#0d9488', '#f8fafc', '#f59e0b'];
  for (let i = 0; i < 650; i++) {
    const x = ((Math.sin(i * 19.17) * 43758.54) % 1 + 1) % 1 * 256;
    const y = ((Math.sin(i * 73.91) * 19341.23) % 1 + 1) % 1 * 256;
    ctx.fillStyle = flecks[i % flecks.length];
    ctx.fillRect(x, y, 2 + (i % 4), 1.5 + (i % 3));
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createReclaimedPvcTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#cfd8e3';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(148, 163, 184, 0.25)' : 'rgba(248, 250, 252, 0.35)';
    ctx.fillRect(0, i * 42, 256, 18);
  }
  ctx.fillStyle = 'rgba(52, 211, 153, 0.28)';
  ctx.fillRect(0, 122, 256, 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createScrapMetalTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    const shade = 86 + ((y * 17) % 28);
    ctx.fillStyle = `rgb(${shade}, ${shade + 8}, ${shade + 16})`;
    ctx.fillRect(0, y, 256, 2);
  }
  // Subtle patina weld spots
  ctx.fillStyle = 'rgba(180, 118, 68, 0.22)';
  for (let i = 0; i < 18; i++) {
    const x = ((i * 53) % 220) + 16;
    const y = ((i * 89) % 220) + 16;
    ctx.beginPath();
    ctx.arc(x, y, 6 + (i % 5), 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createWorkshopMaterials(renderer: THREE.WebGLRenderer): WorkshopMaterials {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

  const tileTex = createSubwayTileTexture();
  const quartzTex = createQuartzTexture();
  const butcherTex = createButcherBlockTexture();
  const floorTex = createOakFloorTexture();
  const plasterTex = createWarmPlasterTexture();
  const steelTex = createBrushedSteelTexture();
  const palletWoodTex = createPalletWoodTexture();
  const hdpeTex = createUpcycledHdpeTexture();
  const reclaimedPvcTex = createReclaimedPvcTexture();
  const scrapMetalTex = createScrapMetalTexture();

  [
    tileTex,
    quartzTex,
    butcherTex,
    floorTex,
    plasterTex,
    steelTex,
    palletWoodTex,
    hdpeTex,
    reclaimedPvcTex,
    scrapMetalTex,
  ].forEach((t) => {
    t.anisotropy = maxAniso;
  });

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.56,
    metalness: 0.04,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    map: plasterTex,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
  });

  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0xfbf3e6,
    roughness: 0.92,
    metalness: 0.0,
  });

  const tileMat = new THREE.MeshStandardMaterial({
    map: tileTex,
    roughness: 0.22,
    metalness: 0.05,
  });

  const quartzMat = new THREE.MeshStandardMaterial({
    map: quartzTex,
    roughness: 0.42,
    metalness: 0.03,
  });

  const butcherBlockMat = new THREE.MeshStandardMaterial({
    map: butcherTex,
    roughness: 0.44,
    metalness: 0.03,
  });

  const cabinetMat = new THREE.MeshStandardMaterial({
    color: 0x3b6356, // Warm South African eucalyptus sage cabinetry
    roughness: 0.54,
    metalness: 0.05,
  });

  const cabinetDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2c423b,
    roughness: 0.58,
    metalness: 0.06,
  });

  const stainlessMat = new THREE.MeshStandardMaterial({
    map: steelTex,
    color: 0xd8dee4,
    roughness: 0.3,
    metalness: 0.84,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf2,
    roughness: 0.15,
    metalness: 0.92,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x262b31,
    roughness: 0.45,
    metalness: 0.65,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc99c4e,
    roughness: 0.28,
    metalness: 0.82,
  });

  const matPadMat = new THREE.MeshStandardMaterial({
    color: 0x2b3640,
    roughness: 0.82,
    metalness: 0.05,
  });

  const pvcMat = new THREE.MeshStandardMaterial({
    color: 0xf0f3f7,
    roughness: 0.34,
    metalness: 0.04,
  });

  const pvcCutEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xd9e1e8,
    roughness: 0.45,
    metalness: 0.02,
  });

  const pvcAcrylicWindowMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8f0ff,
    roughness: 0.12,
    metalness: 0.0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const pvcXrayMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8ebfa,
    roughness: 0.2,
    metalness: 0.04,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x2994d1,
    roughness: 0.1,
    metalness: 0.04,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const waterStreamMat = new THREE.MeshPhysicalMaterial({
    color: 0x56bcf5,
    roughness: 0.08,
    metalness: 0.02,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });

  const netCupMat = new THREE.MeshStandardMaterial({
    color: 0x1f252b,
    roughness: 0.52,
    metalness: 0.08,
  });

  const lecaMat = new THREE.MeshStandardMaterial({
    color: 0xa65838,
    roughness: 0.86,
    metalness: 0.02,
  });

  const substrateDryMat = new THREE.MeshStandardMaterial({
    color: 0x87674b,
    roughness: 0.94,
    metalness: 0.0,
  });

  const substrateWetMat = new THREE.MeshStandardMaterial({
    color: 0x3f2b1c,
    roughness: 0.58,
    metalness: 0.04,
  });

  const wickDryMat = new THREE.MeshStandardMaterial({
    color: 0xebe6d8,
    roughness: 0.9,
    metalness: 0.0,
  });

  const wickWetMat = new THREE.MeshStandardMaterial({
    color: 0x73b6de,
    emissive: 0x11496b,
    emissiveIntensity: 0.35,
    roughness: 0.55,
    metalness: 0.02,
  });

  const seedMat = new THREE.MeshStandardMaterial({
    color: 0xc29e63,
    roughness: 0.8,
    metalness: 0.0,
  });

  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x558e42,
    roughness: 0.65,
    metalness: 0.02,
  });

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x3b9647,
    roughness: 0.48,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const leafLightMat = new THREE.MeshStandardMaterial({
    color: 0x62bd5e,
    roughness: 0.44,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const sawFrameMat = new THREE.MeshStandardMaterial({
    color: 0x32587a,
    roughness: 0.38,
    metalness: 0.45,
  });

  const sawGripMat = new THREE.MeshStandardMaterial({
    color: 0xe29724,
    roughness: 0.52,
    metalness: 0.06,
  });

  const drillBodyMat = new THREE.MeshStandardMaterial({
    color: 0x1b857e,
    roughness: 0.4,
    metalness: 0.12,
  });

  const windowGlowMat = new THREE.MeshBasicMaterial({
    color: 0xfff4e0,
  });

  const pendantGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d4,
    emissive: 0xffd28a,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const rackReclaimedPvcMat = new THREE.MeshStandardMaterial({
    map: reclaimedPvcTex,
    roughness: 0.44,
    metalness: 0.04,
  });

  const rackPalletWoodMat = new THREE.MeshStandardMaterial({
    map: palletWoodTex,
    roughness: 0.78,
    metalness: 0.02,
  });

  const rackScrapMetalMat = new THREE.MeshStandardMaterial({
    map: scrapMetalTex,
    roughness: 0.42,
    metalness: 0.72,
  });

  const rackUpcycledHdpeMat = new THREE.MeshStandardMaterial({
    map: hdpeTex,
    roughness: 0.48,
    metalness: 0.05,
  });

  const rackStandardPvcMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fb,
    roughness: 0.26,
    metalness: 0.03,
  });

  const rackStandardTimberMat = new THREE.MeshStandardMaterial({
    map: butcherTex,
    color: 0xf1d09c,
    roughness: 0.56,
    metalness: 0.02,
  });

  const rackLinerMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.08,
  });

  const rackUnbuiltGhostMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.28,
    wireframe: true,
  });

  const allTextures = [
    tileTex,
    quartzTex,
    butcherTex,
    floorTex,
    plasterTex,
    steelTex,
    palletWoodTex,
    hdpeTex,
    reclaimedPvcTex,
    scrapMetalTex,
  ];
  const allMaterials: THREE.Material[] = [
    floorMat,
    wallMat,
    ceilingMat,
    tileMat,
    quartzMat,
    butcherBlockMat,
    cabinetMat,
    cabinetDarkMat,
    stainlessMat,
    chromeMat,
    darkMetalMat,
    brassMat,
    matPadMat,
    pvcMat,
    pvcCutEdgeMat,
    pvcAcrylicWindowMat,
    pvcXrayMat,
    waterMat,
    waterStreamMat,
    netCupMat,
    lecaMat,
    substrateDryMat,
    substrateWetMat,
    wickDryMat,
    wickWetMat,
    seedMat,
    stemMat,
    leafMat,
    leafLightMat,
    sawFrameMat,
    sawGripMat,
    drillBodyMat,
    windowGlowMat,
    pendantGlowMat,
    rackReclaimedPvcMat,
    rackPalletWoodMat,
    rackScrapMetalMat,
    rackUpcycledHdpeMat,
    rackStandardPvcMat,
    rackStandardTimberMat,
    rackLinerMat,
    rackUnbuiltGhostMat,
  ];

  return {
    floorMat,
    wallMat,
    ceilingMat,
    tileMat,
    quartzMat,
    butcherBlockMat,
    cabinetMat,
    cabinetDarkMat,
    stainlessMat,
    chromeMat,
    darkMetalMat,
    brassMat,
    matPadMat,
    pvcMat,
    pvcCutEdgeMat,
    pvcAcrylicWindowMat,
    pvcXrayMat,
    waterMat,
    waterStreamMat,
    netCupMat,
    lecaMat,
    substrateDryMat,
    substrateWetMat,
    wickDryMat,
    wickWetMat,
    seedMat,
    stemMat,
    leafMat,
    leafLightMat,
    sawFrameMat,
    sawGripMat,
    drillBodyMat,
    windowGlowMat,
    pendantGlowMat,
    rackReclaimedPvcMat,
    rackPalletWoodMat,
    rackScrapMetalMat,
    rackUpcycledHdpeMat,
    rackStandardPvcMat,
    rackStandardTimberMat,
    rackLinerMat,
    rackUnbuiltGhostMat,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
