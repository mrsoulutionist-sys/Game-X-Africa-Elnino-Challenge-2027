import * as THREE from 'three';
import type { WorkshopMaterials } from './materials';

export interface SponsorSlotConfig {
  id: string;
  slotNumber: string;
  category: string;
  partnerName: string;
  tagline: string;
  accentHex: string;
}

/**
 * Modular sponsor slot registry.
 * Future sustainability and tech partners can be plugged directly into any slot
 * without altering wall coordinates, room geometry, or colliders.
 */
export const MODULAR_SPONSOR_SLOTS: SponsorSlotConfig[] = [
  {
    id: 'sustainability-partner',
    slotNumber: 'SLOT 01',
    category: 'SUSTAINABILITY PARTNER',
    partnerName: 'OPEN SPONSOR SLOT',
    tagline: 'Water Resilience & Off-Grid Ecology',
    accentHex: '#34d399',
  },
  {
    id: 'tech-partner',
    slotNumber: 'SLOT 02',
    category: 'TECH & INNOVATION PARTNER',
    partnerName: 'OPEN SPONSOR SLOT',
    tagline: 'STEM Hardware & Learning Labs',
    accentHex: '#38bdf8',
  },
  {
    id: 'agritech-partner',
    slotNumber: 'SLOT 03',
    category: 'FOOD SECURITY PARTNER',
    partnerName: 'OPEN SPONSOR SLOT',
    tagline: 'Community Hydroponic Gardens',
    accentHex: '#fbbf24',
  },
  {
    id: 'education-partner',
    slotNumber: 'SLOT 04',
    category: 'EDUCATION PARTNER',
    partnerName: 'OPEN SPONSOR SLOT',
    tagline: 'Grades 4–12 Youth Engineering',
    accentHex: '#a78bfa',
  },
];

function createBrandBannerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  // Deep architectural slate background
  ctx.fillStyle = '#111a22';
  ctx.fillRect(0, 0, 1024, 384);

  // Subtle technical blueprint grid
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 1024; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 384);
    ctx.stroke();
  }
  for (let y = 0; y <= 384; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Left emerald-gold accent bar
  const grad = ctx.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0, '#10b981');
  grad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = grad;
  ctx.fillRect(28, 32, 12, 320);

  // Stylized geometric leaf + X emblem on left
  ctx.save();
  ctx.translate(124, 192);
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-24, -24);
  ctx.lineTo(24, 24);
  ctx.moveTo(24, -24);
  ctx.lineTo(-24, 24);
  ctx.stroke();
  ctx.restore();

  // Crisp Brand Typography
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
  ctx.fillText('PRESENTS · OFF-GRID STEM FABRICATION LAB', 216, 102);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 72px system-ui, -apple-system, sans-serif';
  ctx.fillText('GAME X AFRICA', 214, 186);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
  ctx.fillText('THE EL NIÑO CHALLENGE', 216, 244);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('PASSIVE HYDROPONICS · GRADES 4–12 · ZERO ELECTRONICS', 216, 306);

  // Clean outer border
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 1004, 364);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSponsorSlotTexture(
  slot: SponsorSlotConfig,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#151e27';
  ctx.fillRect(0, 0, 512, 256);

  // Dashed modular slot border
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(16, 16, 480, 224);
  ctx.setLineDash([]);

  // Top accent bar
  ctx.fillStyle = slot.accentHex;
  ctx.fillRect(28, 28, 96, 6);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px ui-monospace, monospace';
  ctx.fillText(`${slot.slotNumber} · ${slot.category}`, 28, 66);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
  ctx.fillText(slot.partnerName, 28, 134);

  ctx.fillStyle = slot.accentHex;
  ctx.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(slot.tagline, 28, 182);

  // Corner modular mounting crosshairs
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  [
    [28, 224],
    [484, 224],
  ].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createFramedWallBoard(
  width: number,
  height: number,
  tex: THREE.CanvasTexture,
  mats: WorkshopMaterials
): THREE.Group {
  const board = new THREE.Group();

  // Outer dark aluminum frame
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.032),
    mats.darkMetalMat
  );
  frame.castShadow = true;
  frame.receiveShadow = true;
  board.add(frame);

  // Inner brass trim inset
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.02, height + 0.02, 0.036),
    mats.brassMat
  );
  board.add(trim);

  // Textured faceplate
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.42,
    metalness: 0.05,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  face.position.z = 0.02;
  board.add(face);

  // Four corner stand-off mounting pins
  [
    [-width * 0.47, height * 0.44],
    [width * 0.47, height * 0.44],
    [-width * 0.47, -height * 0.44],
    [width * 0.47, -height * 0.44],
  ].forEach(([px, py]) => {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 10), mats.chromeMat);
    pin.rotation.x = Math.PI * 0.5;
    pin.position.set(px, py, 0.024);
    board.add(pin);
  });

  return board;
}

export interface SponsorSignageHandle {
  group: THREE.Group;
  dispose: () => void;
}

export function buildWorkshopWallSignage(
  rendererMaxAnisotropy: number,
  mats: WorkshopMaterials
): SponsorSignageHandle {
  const group = new THREE.Group();
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  const brandTex = createBrandBannerTexture(rendererMaxAnisotropy);
  textures.push(brandTex);

  // 1. Primary "Game X Africa" Brand Banner mounted on West Upper Wall (above Hacksaw counter & shelf)
  const westBrandBoard = createFramedWallBoard(2.4, 0.9, brandTex, mats);
  westBrandBoard.position.set(-4.48, 2.52, -0.55);
  westBrandBoard.rotation.y = Math.PI * 0.5;
  group.add(westBrandBoard);

  // 2. Secondary "Game X Africa" Brand Plaque mounted above North-East counter (between cabinets & fridge)
  const northBrandBoard = createFramedWallBoard(1.85, 0.68, brandTex, mats);
  northBrandBoard.position.set(0.92, 1.56, -4.36);
  group.add(northBrandBoard);

  // 3. Modular Sponsor Slot Rail mounted cleanly on the East Wall (above East counter & Wicks station)
  const sponsorWallGroup = new THREE.Group();
  sponsorWallGroup.position.set(4.48, 2.52, 0.18);
  sponsorWallGroup.rotation.y = -Math.PI * 0.5;
  group.add(sponsorWallGroup);

  // Architectural aluminum mounting rail behind the 4 modular slots
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.55, 1.24, 0.022), mats.cabinetDarkMat);
  rail.position.z = -0.01;
  sponsorWallGroup.add(rail);

  // Render each modular sponsor slot in a clean 2x2 grid inside the rail
  MODULAR_SPONSOR_SLOTS.forEach((slot, idx) => {
    const tex = createSponsorSlotTexture(slot, rendererMaxAnisotropy);
    textures.push(tex);
    const slotBoard = createFramedWallBoard(1.62, 0.52, tex, mats);
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    slotBoard.position.set(col === 0 ? -0.85 : 0.85, row === 0 ? 0.3 : -0.3, 0.012);
    sponsorWallGroup.add(slotBoard);
  });

  // Collect face materials for clean disposal
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial && obj.material.map) {
      if (textures.includes(obj.material.map)) {
        materials.push(obj.material);
      }
    }
  });

  return {
    group,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
    },
  };
}

export function buildGardenSignage(
  rendererMaxAnisotropy: number,
  mats: WorkshopMaterials
): SponsorSignageHandle {
  const group = new THREE.Group();
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  const brandTex = createBrandBannerTexture(rendererMaxAnisotropy);
  textures.push(brandTex);

  // 1. North Hero "Game X Africa" Arch Banner behind the Vertical Rack Stand (frames camera forward view)
  const northArchGroup = new THREE.Group();
  northArchGroup.position.set(0, 0, -4.84);
  group.add(northArchGroup);

  [-1.24, 1.24].forEach((px) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.66, 0.08), mats.darkMetalMat);
    post.position.set(px, 1.33, 0);
    post.castShadow = true;
    northArchGroup.add(post);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.11), mats.brassMat);
    cap.position.set(px, 2.67, 0);
    northArchGroup.add(cap);
  });

  const northCrossbeam = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.06, 0.07), mats.darkMetalMat);
  northCrossbeam.position.set(0, 2.61, 0);
  northArchGroup.add(northCrossbeam);

  const northBrandBoard = createFramedWallBoard(2.46, 0.92, brandTex, mats);
  northBrandBoard.position.set(0, 2.08, 0.04);
  northArchGroup.add(northBrandBoard);

  // 2. West Fence "Game X Africa" Brand Banner (matching Kitchen West Wall placement)
  const westBrandBoard = createFramedWallBoard(2.15, 0.8, brandTex, mats);
  westBrandBoard.position.set(-4.75, 1.24, -0.35);
  westBrandBoard.rotation.y = Math.PI * 0.5;
  group.add(westBrandBoard);

  // 3. East Fence Modular Sponsor Slot Rail (matching Kitchen East Wall 2x2 sponsor grid)
  const sponsorFenceGroup = new THREE.Group();
  sponsorFenceGroup.position.set(4.75, 1.18, -0.35);
  sponsorFenceGroup.rotation.y = -Math.PI * 0.5;
  group.add(sponsorFenceGroup);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.35, 1.16, 0.022), mats.cabinetDarkMat);
  rail.position.z = -0.01;
  sponsorFenceGroup.add(rail);

  MODULAR_SPONSOR_SLOTS.forEach((slot, idx) => {
    const tex = createSponsorSlotTexture(slot, rendererMaxAnisotropy);
    textures.push(tex);
    const slotBoard = createFramedWallBoard(1.52, 0.48, tex, mats);
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    slotBoard.position.set(col === 0 ? -0.8 : 0.8, row === 0 ? 0.28 : -0.28, 0.012);
    sponsorFenceGroup.add(slotBoard);
  });

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial && obj.material.map) {
      if (textures.includes(obj.material.map)) {
        materials.push(obj.material);
      }
    }
  });

  return {
    group,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
    },
  };
}
