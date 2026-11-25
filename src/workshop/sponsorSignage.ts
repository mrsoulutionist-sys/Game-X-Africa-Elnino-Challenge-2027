import * as THREE from 'three';
import {
  SPONSOR_CATALOG_BY_ID,
  type SponsorSlotAssignment,
} from '../firebase/sponsorService';
import type { WorkshopMaterials } from './materials';

export interface SponsorSlotConfig {
  id: string;
  slotNumber: string;
  category: string;
  partnerName: string;
  tagline: string;
  accentHex: string;
}

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

interface DynamicCanvasTarget {
  slotId: string;
  variant: 'hero' | 'card' | 'plaque';
  defaultTitle: string;
  defaultSub: string;
  defaultAccent: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
}

const imageCache = new Map<string, HTMLImageElement>();

function getOrLoadSponsorImage(
  dataUrl: string,
  onReady: (img: HTMLImageElement) => void
): HTMLImageElement | null {
  if (!dataUrl) return null;
  const cached = imageCache.get(dataUrl);
  if (cached) {
    if (cached.complete && cached.naturalWidth > 0) {
      return cached;
    }
    cached.addEventListener('load', () => onReady(cached), { once: true });
    return null;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.addEventListener('load', () => onReady(img), { once: true });
  img.src = dataUrl;
  imageCache.set(dataUrl, img);
  return null;
}

function drawHeroDefault(target: DynamicCanvasTarget): void {
  const { ctx, canvas } = target;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#111a22';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(52, 211, 153, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#10b981');
  grad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = grad;
  ctx.fillRect(28, 32, 12, h - 64);

  ctx.save();
  ctx.translate(124, h * 0.5);
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

  ctx.textAlign = 'left';
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

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 20);
}

function drawFittedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): void {
  const iw = Math.max(1, img.naturalWidth || img.width);
  const ih = Math.max(1, img.naturalHeight || img.height);
  const scale = Math.min(boxW / iw, boxH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = boxX + (boxW - dw) * 0.5;
  const dy = boxY + (boxH - dh) * 0.5;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function renderTargetCanvas(
  target: DynamicCanvasTarget,
  assignment?: SponsorSlotAssignment
): void {
  const { ctx, canvas } = target;
  const w = canvas.width;
  const h = canvas.height;
  const catalog = SPONSOR_CATALOG_BY_ID[target.slotId];

  const isActive = Boolean(assignment?.active);
  if (!isActive && target.variant === 'hero') {
    drawHeroDefault(target);
    target.texture.needsUpdate = true;
    return;
  }

  const bgHex = isActive && assignment?.bgHex ? assignment.bgHex : catalog?.defaultBgHex || '#0f172a';
  const accentHex =
    isActive && assignment?.accentHex
      ? assignment.accentHex
      : target.defaultAccent || catalog?.defaultAccentHex || '#34d399';
  const titleText =
    isActive && assignment?.partnerName
      ? assignment.partnerName
      : target.defaultTitle || catalog?.defaultPartnerName || 'OPEN SPONSOR SLOT';
  const subText =
    isActive && assignment?.tagline
      ? assignment.tagline
      : target.defaultSub || catalog?.defaultTagline || 'Available via Admin Sponsor Manager';

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, w, h);

  // Subtle architectural grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Border + Accent Bar
  ctx.strokeStyle = isActive ? accentHex : 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = Math.max(3, Math.round(h * 0.02));
  if (!isActive) {
    ctx.setLineDash([10, 7]);
  }
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.setLineDash([]);

  ctx.fillStyle = accentHex;
  ctx.fillRect(20, 18, Math.max(60, w * 0.18), Math.max(5, Math.round(h * 0.025)));

  const displayMode = isActive ? assignment!.displayMode : 'text';
  const logoUrl = isActive ? assignment!.logoDataUrl : '';
  let loadedImg: HTMLImageElement | null = null;
  if (logoUrl && (displayMode === 'logo' || displayMode === 'both')) {
    loadedImg = getOrLoadSponsorImage(logoUrl, () => {
      renderTargetCanvas(target, assignment);
    });
  }

  if (displayMode === 'logo' && loadedImg) {
    // Crisp white/soft pill backing so dark or transparent brand logos pop cleanly
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const padX = w * 0.06;
    const padY = h * 0.14;
    ctx.fillRect(padX, padY, w - padX * 2, h - padY * 2);
    drawFittedImage(ctx, loadedImg, padX + 12, padY + 10, w - (padX + 12) * 2, h - (padY + 10) * 2);
    target.texture.needsUpdate = true;
    return;
  }

  if (displayMode === 'both' && loadedImg) {
    const logoBoxW = Math.round(w * 0.34);
    const logoBoxH = Math.round(h * 0.68);
    const lx = 26;
    const ly = Math.round((h - logoBoxH) * 0.5) + 4;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(lx, ly, logoBoxW, logoBoxH);
    drawFittedImage(ctx, loadedImg, lx + 8, ly + 8, logoBoxW - 16, logoBoxH - 16);

    const textX = lx + logoBoxW + 24;
    const maxTextW = w - textX - 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = accentHex;
    ctx.font = `bold ${Math.max(14, Math.round(h * 0.095))}px ui-monospace, monospace`;
    ctx.fillText((catalog?.categoryLabel || 'SPONSOR').toUpperCase(), textX, Math.round(h * 0.25), maxTextW);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.max(24, Math.round(h * 0.19))}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(titleText.toUpperCase(), textX, Math.round(h * 0.56), maxTextW);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = `600 ${Math.max(15, Math.round(h * 0.105))}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(subText, textX, Math.round(h * 0.78), maxTextW);

    target.texture.needsUpdate = true;
    return;
  }

  // Wording / Default layout
  const padL = 26;
  const maxW = w - padL * 2;
  ctx.textAlign = 'left';

  const headerTag = isActive
    ? `SPONSORED · ${(catalog?.label || 'PARTNER SLOT').toUpperCase()}`
    : `AVAILABLE SLOT · ${(catalog?.label || target.slotId).toUpperCase()}`;
  ctx.fillStyle = isActive ? accentHex : '#94a3b8';
  ctx.font = `bold ${Math.max(14, Math.round(h * 0.095))}px ui-monospace, monospace`;
  ctx.fillText(headerTag, padL, Math.round(h * 0.27), maxW);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.max(26, Math.round(h * 0.22))}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(titleText.toUpperCase(), padL, Math.round(h * 0.57), maxW);

  ctx.fillStyle = accentHex;
  ctx.font = `600 ${Math.max(16, Math.round(h * 0.115))}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(subText, padL, Math.round(h * 0.8), maxW);

  target.texture.needsUpdate = true;
}

export class DynamicSponsorController {
  private targets: DynamicCanvasTarget[] = [];
  private currentSlots: Record<string, SponsorSlotAssignment> = {};

  public registerTarget(params: {
    slotId: string;
    variant: 'hero' | 'card' | 'plaque';
    widthPx: number;
    heightPx: number;
    maxAnisotropy: number;
    defaultTitle?: string;
    defaultSub?: string;
    defaultAccent?: string;
  }): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = params.widthPx;
    canvas.height = params.heightPx;
    const ctx = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = params.maxAnisotropy;

    const catalog = SPONSOR_CATALOG_BY_ID[params.slotId];
    const target: DynamicCanvasTarget = {
      slotId: params.slotId,
      variant: params.variant,
      defaultTitle: params.defaultTitle ?? catalog?.defaultPartnerName ?? 'OPEN SLOT',
      defaultSub: params.defaultSub ?? catalog?.defaultTagline ?? 'Sponsor Slot Available',
      defaultAccent: params.defaultAccent ?? catalog?.defaultAccentHex ?? '#34d399',
      canvas,
      ctx,
      texture,
    };

    this.targets.push(target);
    renderTargetCanvas(target, this.currentSlots[params.slotId]);
    return texture;
  }

  public applySlots(slots: Record<string, SponsorSlotAssignment>): void {
    this.currentSlots = slots;
    for (const target of this.targets) {
      renderTargetCanvas(target, slots[target.slotId]);
    }
  }

  public dispose(): void {
    for (const target of this.targets) {
      target.texture.dispose();
    }
    this.targets = [];
  }
}

function createFramedWallBoard(
  width: number,
  height: number,
  tex: THREE.CanvasTexture,
  mats: WorkshopMaterials
): THREE.Group {
  const board = new THREE.Group();

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.06, height + 0.06, 0.032),
    mats.darkMetalMat
  );
  frame.castShadow = true;
  frame.receiveShadow = true;
  board.add(frame);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.02, height + 0.02, 0.036),
    mats.brassMat
  );
  board.add(trim);

  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.42,
    metalness: 0.05,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  face.position.z = 0.02;
  board.add(face);

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

/**
 * Compact framed plaque for mounting directly on Kitchen, Garden & Compost props
 * (Counter, Drill, Hacksaw, Table, PVC Pipe, Seeds, Fridge, JoJo Tank, Benches, etc.)
 */
export function createPropBrandPlaque(params: {
  controller: DynamicSponsorController;
  slotId: string;
  width: number;
  height: number;
  mats: WorkshopMaterials;
  maxAnisotropy: number;
  defaultTitle?: string;
  defaultSub?: string;
  defaultAccent?: string;
  disposables: Array<{ dispose: () => void }>;
}): THREE.Group {
  const {
    controller,
    slotId,
    width,
    height,
    mats,
    maxAnisotropy,
    defaultTitle,
    defaultSub,
    defaultAccent,
    disposables,
  } = params;

  const tex = controller.registerTarget({
    slotId,
    variant: 'plaque',
    widthPx: 512,
    heightPx: 192,
    maxAnisotropy,
    defaultTitle,
    defaultSub,
    defaultAccent,
  });

  const group = new THREE.Group();
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.024, height + 0.024, 0.014),
    mats.darkMetalMat
  );
  group.add(backing);

  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.4,
    metalness: 0.06,
  });
  disposables.push(faceMat);

  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  face.position.z = 0.0085;
  group.add(face);

  return group;
}

export interface SponsorSignageHandle {
  group: THREE.Group;
  updateSlots: (slots: Record<string, SponsorSlotAssignment>) => void;
  dispose: () => void;
}

export function buildWorkshopWallSignage(
  rendererMaxAnisotropy: number,
  mats: WorkshopMaterials,
  externalController?: DynamicSponsorController
): SponsorSignageHandle {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const controller = externalController ?? new DynamicSponsorController();

  const westHeroTex = controller.registerTarget({
    slotId: 'kitchen_panel_west',
    variant: 'hero',
    widthPx: 1024,
    heightPx: 384,
    maxAnisotropy: rendererMaxAnisotropy,
  });
  const westBrandBoard = createFramedWallBoard(2.4, 0.9, westHeroTex, mats);
  westBrandBoard.position.set(-4.48, 2.52, -0.55);
  westBrandBoard.rotation.y = Math.PI * 0.5;
  group.add(westBrandBoard);

  const northHeroTex = controller.registerTarget({
    slotId: 'kitchen_panel_north',
    variant: 'hero',
    widthPx: 1024,
    heightPx: 384,
    maxAnisotropy: rendererMaxAnisotropy,
  });
  const northBrandBoard = createFramedWallBoard(1.85, 0.68, northHeroTex, mats);
  northBrandBoard.position.set(0.92, 1.56, -4.36);
  group.add(northBrandBoard);

  const sponsorWallGroup = new THREE.Group();
  sponsorWallGroup.position.set(4.48, 2.52, 0.18);
  sponsorWallGroup.rotation.y = -Math.PI * 0.5;
  group.add(sponsorWallGroup);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.55, 1.24, 0.022), mats.cabinetDarkMat);
  rail.position.z = -0.01;
  sponsorWallGroup.add(rail);

  const kitchenRailIds = ['kitchen_rail_1', 'kitchen_rail_2', 'kitchen_rail_3', 'kitchen_rail_4'];
  kitchenRailIds.forEach((slotId, idx) => {
    const legacy = MODULAR_SPONSOR_SLOTS[idx];
    const tex = controller.registerTarget({
      slotId,
      variant: 'card',
      widthPx: 512,
      heightPx: 256,
      maxAnisotropy: rendererMaxAnisotropy,
      defaultTitle: legacy.partnerName,
      defaultSub: legacy.tagline,
      defaultAccent: legacy.accentHex,
    });
    const slotBoard = createFramedWallBoard(1.62, 0.52, tex, mats);
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    slotBoard.position.set(col === 0 ? -0.85 : 0.85, row === 0 ? 0.3 : -0.3, 0.012);
    sponsorWallGroup.add(slotBoard);
  });

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial && obj.material.map) {
      materials.push(obj.material);
    }
  });

  return {
    group,
    updateSlots: (slots) => controller.applySlots(slots),
    dispose: () => {
      if (!externalController) controller.dispose();
      materials.forEach((m) => m.dispose());
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
    },
  };
}

export function buildGardenSignage(
  rendererMaxAnisotropy: number,
  mats: WorkshopMaterials,
  externalController?: DynamicSponsorController
): SponsorSignageHandle {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const controller = externalController ?? new DynamicSponsorController();

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

  const archTex = controller.registerTarget({
    slotId: 'garden_arch_panel',
    variant: 'hero',
    widthPx: 1024,
    heightPx: 384,
    maxAnisotropy: rendererMaxAnisotropy,
  });
  const northBrandBoard = createFramedWallBoard(2.46, 0.92, archTex, mats);
  northBrandBoard.position.set(0, 2.08, 0.04);
  northArchGroup.add(northBrandBoard);

  const westTex = controller.registerTarget({
    slotId: 'garden_west_panel',
    variant: 'hero',
    widthPx: 1024,
    heightPx: 384,
    maxAnisotropy: rendererMaxAnisotropy,
  });
  const westBrandBoard = createFramedWallBoard(2.15, 0.8, westTex, mats);
  westBrandBoard.position.set(-4.75, 1.24, -0.35);
  westBrandBoard.rotation.y = Math.PI * 0.5;
  group.add(westBrandBoard);

  const sponsorFenceGroup = new THREE.Group();
  sponsorFenceGroup.position.set(4.75, 1.18, -0.35);
  sponsorFenceGroup.rotation.y = -Math.PI * 0.5;
  group.add(sponsorFenceGroup);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.35, 1.16, 0.022), mats.cabinetDarkMat);
  rail.position.z = -0.01;
  sponsorFenceGroup.add(rail);

  const gardenRailIds = ['garden_rail_1', 'garden_rail_2', 'garden_rail_3', 'garden_rail_4'];
  gardenRailIds.forEach((slotId, idx) => {
    const legacy = MODULAR_SPONSOR_SLOTS[idx];
    const tex = controller.registerTarget({
      slotId,
      variant: 'card',
      widthPx: 512,
      heightPx: 256,
      maxAnisotropy: rendererMaxAnisotropy,
      defaultTitle: legacy.partnerName,
      defaultSub: legacy.tagline,
      defaultAccent: legacy.accentHex,
    });
    const slotBoard = createFramedWallBoard(1.52, 0.48, tex, mats);
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    slotBoard.position.set(col === 0 ? -0.8 : 0.8, row === 0 ? 0.28 : -0.28, 0.012);
    sponsorFenceGroup.add(slotBoard);
  });

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial && obj.material.map) {
      materials.push(obj.material);
    }
  });

  return {
    group,
    updateSlots: (slots) => controller.applySlots(slots),
    dispose: () => {
      if (!externalController) controller.dispose();
      materials.forEach((m) => m.dispose());
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
    },
  };
}

export function buildCompostSignage(
  rendererMaxAnisotropy: number,
  mats: WorkshopMaterials,
  externalController?: DynamicSponsorController
): SponsorSignageHandle {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const controller = externalController ?? new DynamicSponsorController();

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

  const archTex = controller.registerTarget({
    slotId: 'compost_arch_panel',
    variant: 'hero',
    widthPx: 1024,
    heightPx: 384,
    maxAnisotropy: rendererMaxAnisotropy,
  });
  const northBrandBoard = createFramedWallBoard(2.46, 0.92, archTex, mats);
  northBrandBoard.position.set(0, 2.08, 0.04);
  northArchGroup.add(northBrandBoard);

  const westTex = controller.registerTarget({
    slotId: 'compost_west_panel',
    variant: 'hero',
    widthPx: 1024,
    heightPx: 384,
    maxAnisotropy: rendererMaxAnisotropy,
  });
  const westBrandBoard = createFramedWallBoard(2.15, 0.8, westTex, mats);
  westBrandBoard.position.set(-4.75, 1.24, -0.35);
  westBrandBoard.rotation.y = Math.PI * 0.5;
  group.add(westBrandBoard);

  const sponsorFenceGroup = new THREE.Group();
  sponsorFenceGroup.position.set(4.75, 1.18, -0.35);
  sponsorFenceGroup.rotation.y = -Math.PI * 0.5;
  group.add(sponsorFenceGroup);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.35, 1.16, 0.022), mats.cabinetDarkMat);
  rail.position.z = -0.01;
  sponsorFenceGroup.add(rail);

  const compostRailIds = ['compost_rail_1', 'compost_rail_2', 'compost_rail_3', 'compost_rail_4'];
  compostRailIds.forEach((slotId, idx) => {
    const legacy = MODULAR_SPONSOR_SLOTS[idx];
    const tex = controller.registerTarget({
      slotId,
      variant: 'card',
      widthPx: 512,
      heightPx: 256,
      maxAnisotropy: rendererMaxAnisotropy,
      defaultTitle: legacy.partnerName,
      defaultSub: legacy.tagline,
      defaultAccent: legacy.accentHex,
    });
    const slotBoard = createFramedWallBoard(1.52, 0.48, tex, mats);
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    slotBoard.position.set(col === 0 ? -0.8 : 0.8, row === 0 ? 0.28 : -0.28, 0.012);
    sponsorFenceGroup.add(slotBoard);
  });

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial && obj.material.map) {
      materials.push(obj.material);
    }
  });

  return {
    group,
    updateSlots: (slots) => controller.applySlots(slots),
    dispose: () => {
      if (!externalController) controller.dispose();
      materials.forEach((m) => m.dispose());
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
    },
  };
}
