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
  ctx.fillStyle = '#cfd5db'; // warm light grout
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 4;
  const tileH = 512 / rows;
  const tileW = 512 / cols;
  const gap = 4;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 1 ? tileW * 0.5 : 0;
    for (let c = -1; c <= cols; c++) {
      const x = c * tileW + offset + gap * 0.5;
      const y = r * tileH + gap * 0.5;
      const w = tileW - gap;
      const h = tileH - gap;

      const shade = 244 + ((r * 7 + c * 13) % 8);
      ctx.fillStyle = `rgb(${shade}, ${shade + 1}, ${shade + 2})`;
      ctx.fillRect(x, y, w, h);

      // Subtle ceramic bevel highlight
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = 'rgba(180,190,200,0.28)';
      ctx.fillRect(x, y + h - 3, w, 3);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 1.4);
  return tex;
}

function createQuartzTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#f2f3f5';
  ctx.fillRect(0, 0, 512, 512);

  // Fine mineral flecks
  for (let i = 0; i < 1200; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * 512;
    const y = (Math.sin(i * 78.233) * 19341.231 % 1 + 1) % 1 * 512;
    const r = 0.6 + (i % 3) * 0.45;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(195,202,210,0.35)' : 'rgba(220,224,228,0.45)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft marble-like quartz veins
  ctx.strokeStyle = 'rgba(176, 184, 194, 0.24)';
  ctx.lineWidth = 2.2;
  for (let v = 0; v < 5; v++) {
    ctx.beginPath();
    let y = 50 + v * 95;
    ctx.moveTo(0, y);
    for (let x = 32; x <= 512; x += 32) {
      y += Math.sin(x * 0.025 + v * 1.9) * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
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
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#8b6848';
  ctx.fillRect(0, 0, 512, 512);

  const planks = 8;
  const plankH = 512 / planks;
  const plankShades = ['#9a7450', '#8d6846', '#a37d57', '#866242'];

  for (let p = 0; p < planks; p++) {
    const y = p * plankH;
    ctx.fillStyle = plankShades[p % plankShades.length];
    ctx.fillRect(0, y, 512, plankH - 2);

    // Grain streaks
    ctx.strokeStyle = 'rgba(65, 42, 22, 0.14)';
    ctx.lineWidth = 1.3;
    for (let g = 0; g < 6; g++) {
      const gy = y + 6 + g * 9;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= 512; x += 32) {
        ctx.lineTo(x, gy + Math.sin(x * 0.02 + p + g) * 2);
      }
      ctx.stroke();
    }

    // Horizontal seam
    ctx.fillStyle = 'rgba(42, 28, 16, 0.45)';
    ctx.fillRect(0, y + plankH - 2, 512, 2);

    // Staggered vertical plank joint
    const jointX = ((p * 173 + 90) % 440) + 36;
    ctx.fillRect(jointX, y, 2, plankH);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4.5, 4.5);
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

export function createWorkshopMaterials(renderer: THREE.WebGLRenderer): WorkshopMaterials {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

  const tileTex = createSubwayTileTexture();
  const quartzTex = createQuartzTexture();
  const butcherTex = createButcherBlockTexture();
  const floorTex = createOakFloorTexture();
  const steelTex = createBrushedSteelTexture();

  [tileTex, quartzTex, butcherTex, floorTex, steelTex].forEach((t) => {
    t.anisotropy = maxAniso;
  });

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.62,
    metalness: 0.04,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xebe6dc,
    roughness: 0.88,
    metalness: 0.0,
  });

  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0xf4f2ed,
    roughness: 0.92,
    metalness: 0.0,
  });

  const tileMat = new THREE.MeshStandardMaterial({
    map: tileTex,
    roughness: 0.24,
    metalness: 0.04,
  });

  const quartzMat = new THREE.MeshStandardMaterial({
    map: quartzTex,
    roughness: 0.2,
    metalness: 0.05,
  });

  const butcherBlockMat = new THREE.MeshStandardMaterial({
    map: butcherTex,
    roughness: 0.44,
    metalness: 0.03,
  });

  const cabinetMat = new THREE.MeshStandardMaterial({
    color: 0x3b524c, // Architectural sage-slate cabinetry
    roughness: 0.56,
    metalness: 0.06,
  });

  const cabinetDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2a3b37,
    roughness: 0.6,
    metalness: 0.08,
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
    color: 0xdff1ff,
  });

  const pendantGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d4,
    emissive: 0xffd28a,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const allTextures = [tileTex, quartzTex, butcherTex, floorTex, steelTex];
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
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
