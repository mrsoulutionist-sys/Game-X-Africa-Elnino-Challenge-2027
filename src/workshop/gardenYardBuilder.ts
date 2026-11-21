import * as THREE from 'three';
import {
  computeTierLiveMetrics,
  getCropById,
  type CanopyStyle,
  type TierSaveState,
  type WeatherMode,
} from './crops';
import type { AABB } from './kitchenRoomBuilder';
import type { WorkshopMaterials } from './materials';
import { buildGardenSignage } from './sponsorSignage';

export interface GardenResilienceState {
  jojoInstalled: boolean;
  jojoLitres: number;
  jojoCapacity: number;
  shadeClothInstalled: boolean;
  weatherMode: WeatherMode;
}

export interface GardenYardHandle {
  group: THREE.Group;
  colliders: AABB[];
  rackAnchor: THREE.Vector3;
  jojoAnchor: THREE.Vector3;
  weatherAnchor: THREE.Vector3;
  kitchenDoorAnchor: THREE.Vector3;
  compostDoorAnchor: THREE.Vector3;
  setGardenState: (
    rackSize: number,
    tiers: TierSaveState[],
    cutawayMode: boolean,
    resilience?: GardenResilienceState
  ) => void;
  update: (time: number, nowMs: number) => void;
  dispose: () => void;
}

const PORT_X_OFFSETS = [-0.42, -0.14, 0.14, 0.42];
const PIPE_RADIUS = 0.056;

function createGardenSignTexture(text: string, sub: string, accentHex = '#34d399'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 144);
  ctx.fillStyle = accentHex;
  ctx.font = 'bold 24px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(sub, 256, 56);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
  ctx.fillText(text, 256, 114);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPlantCanopyMesh(
  style: CanopyStyle,
  leafColorHex: number,
  accentColorHex: number,
  stemMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const sprout = new THREE.Group();
  const mainLeafMat = new THREE.MeshStandardMaterial({
    color: leafColorHex,
    roughness: 0.48,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const accentLeafMat = new THREE.MeshStandardMaterial({
    color: accentColorHex,
    roughness: 0.44,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  disposables.push(mainLeafMat, accentLeafMat);

  if (style === 'upright') {
    for (let s = 0; s < 5; s++) {
      const shoot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.007, 0.16, 7),
        s % 2 === 0 ? mainLeafMat : accentLeafMat
      );
      const ang = (s / 5) * Math.PI * 2;
      shoot.position.set(Math.cos(ang) * 0.012, 0.08, Math.sin(ang) * 0.012);
      shoot.rotation.z = Math.cos(ang) * 0.14;
      shoot.rotation.x = Math.sin(ang) * 0.14;
      sprout.add(shoot);
    }
    return sprout;
  }

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.12, 8), stemMat);
  stem.position.y = 0.06;
  sprout.add(stem);

  const leafGeom = new THREE.SphereGeometry(style === 'broad' ? 0.042 : 0.032, 9, 7);
  leafGeom.scale(style === 'broad' ? 1.25 : 1.0, 0.24, style === 'rosette' ? 1.35 : 1.55);
  disposables.push(leafGeom);

  const count = style === 'rosette' ? 8 : 6;
  for (let l = 0; l < count; l++) {
    const pivot = new THREE.Group();
    const tier = Math.floor(l / 2);
    pivot.position.y = 0.028 + tier * 0.026;
    pivot.rotation.y = l * 1.95;

    const leaf = new THREE.Mesh(leafGeom, l % 2 === 0 ? mainLeafMat : accentLeafMat);
    leaf.position.set(0, 0.006, style === 'rosette' ? 0.032 : 0.042);
    leaf.rotation.x = style === 'rosette' ? 0.25 : 0.42 - tier * 0.08;
    pivot.add(leaf);
    sprout.add(pivot);
  }

  return sprout;
}

export function buildGardenYard(
  mats: WorkshopMaterials,
  maxAnisotropy = 4
): GardenYardHandle {
  const group = new THREE.Group();
  const colliders: AABB[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const signage = buildGardenSignage(maxAnisotropy, mats);
  group.add(signage.group);
  disposables.push({ dispose: signage.dispose });

  // 1. Stone Courtyard Patio + Perimeter Grass Borders
  const patioMat = new THREE.MeshStandardMaterial({
    color: 0xb8b2a6,
    roughness: 0.86,
    metalness: 0.02,
  });
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x4f7f45,
    roughness: 0.92,
    metalness: 0.0,
  });
  const fenceWoodMat = new THREE.MeshStandardMaterial({
    color: 0x7c5838,
    roughness: 0.78,
    metalness: 0.02,
  });
  const emptyBracketMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.5,
  });
  const jojoGreenMat = new THREE.MeshStandardMaterial({
    color: 0x1b5e36,
    roughness: 0.46,
    metalness: 0.08,
  });
  const shadeNetMat = new THREE.MeshStandardMaterial({
    color: 0x0f2d1f,
    roughness: 0.88,
    metalness: 0.0,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
  });
  const weatherDomeMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.95,
    roughness: 0.28,
  });
  disposables.push(
    patioMat,
    grassMat,
    fenceWoodMat,
    emptyBracketMat,
    jojoGreenMat,
    shadeNetMat,
    weatherDomeMat
  );

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), grassMat);
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  group.add(ground);

  const patio = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.04, 9.6), patioMat);
  patio.position.set(0, 0.01, -0.2);
  patio.receiveShadow = true;
  group.add(patio);

  // Wooden Garden Perimeter Fence (North, West, East)
  const addFencePanel = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fenceWoodMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  addFencePanel(9.8, 1.85, 0.14, 0, 0.925, -4.95);
  addFencePanel(0.14, 1.85, 9.8, -4.85, 0.925, -0.1);
  addFencePanel(0.14, 1.85, 9.8, 4.85, 0.925, -0.1);

  // Raised planter border greenery along North fence
  addFencePanel(7.6, 0.36, 0.75, 0, 0.18, -4.45);
  for (let i = 0; i < 9; i++) {
    const shrub = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.28 + (i % 3) * 0.07, 1),
      i % 2 === 0 ? mats.leafMat : mats.leafLightMat
    );
    shrub.position.set(-3.2 + i * 0.8, 0.52, -4.45);
    shrub.castShadow = true;
    group.add(shrub);
  }

  // 2. Kitchen Return Wall & Door behind player at z = 4.35
  addFencePanel(9.8, 3.0, 0.2, 0, 1.5, 4.45);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.36, 2.34, 0.26), mats.cabinetDarkMat);
  doorFrame.position.set(0, 1.17, 4.42);
  group.add(doorFrame);

  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.18, 0.08), mats.cabinetMat);
  doorPanel.position.set(0, 1.12, 4.38);
  group.add(doorPanel);

  const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.15, 0.09), mats.pvcAcrylicWindowMat);
  doorGlass.position.set(0, 1.48, 4.38);
  group.add(doorGlass);

  const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.08), mats.brassMat);
  doorHandle.position.set(0.42, 1.05, 4.32);
  group.add(doorHandle);

  const returnSignTex = createGardenSignTexture('KITCHEN LAB', '← ENTER WORKSHOP');
  disposables.push(returnSignTex);
  const returnSignMat = new THREE.MeshBasicMaterial({ map: returnSignTex });
  disposables.push(returnSignMat);
  const returnSign = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.38), returnSignMat);
  returnSign.position.set(0, 2.6, 4.33);
  returnSign.rotation.y = Math.PI;
  group.add(returnSign);

  const doorBeacon = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.4, 28),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
  );
  doorBeacon.rotation.x = -Math.PI * 0.5;
  doorBeacon.position.set(0, 0.04, 3.85);
  group.add(doorBeacon);
  disposables.push(doorBeacon.material as THREE.Material);

  // Door 3 Gate (Recycling & Composting Station) on South-East Wall (x = 2.65, z = 4.38)
  const compostDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.36, 2.34, 0.26), mats.cabinetDarkMat);
  compostDoorFrame.position.set(2.65, 1.17, 4.42);
  group.add(compostDoorFrame);

  const compostDoorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.18, 0.08), mats.butcherBlockMat);
  compostDoorPanel.position.set(2.65, 1.12, 4.38);
  group.add(compostDoorPanel);

  const compostDoorWindow = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.15, 0.09), mats.leafMat);
  compostDoorWindow.position.set(2.65, 1.48, 4.38);
  group.add(compostDoorWindow);

  const compostDoorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.08), mats.brassMat);
  compostDoorHandle.position.set(3.07, 1.05, 4.32);
  group.add(compostDoorHandle);

  const compostSignTex = createGardenSignTexture('DOOR 3 · COMPOST', 'RECYCLE & MULCH →', '#fbbf24');
  disposables.push(compostSignTex);
  const compostSignMat = new THREE.MeshBasicMaterial({ map: compostSignTex });
  disposables.push(compostSignMat);
  const compostSign = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.38), compostSignMat);
  compostSign.position.set(2.65, 2.6, 4.33);
  compostSign.rotation.y = Math.PI;
  group.add(compostSign);

  const compostBeacon = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.4, 28),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide })
  );
  compostBeacon.rotation.x = -Math.PI * 0.5;
  compostBeacon.position.set(2.65, 0.04, 3.85);
  group.add(compostBeacon);
  disposables.push(compostBeacon.material as THREE.Material);

  // 3. Craftable JoJo Rainwater Harvesting Tank Station (x = 2.25, z = -1.75)
  const jojoRoot = new THREE.Group();
  jojoRoot.position.set(2.25, 0.03, -1.75);
  group.add(jojoRoot);
  colliders.push({ minX: 1.65, maxX: 2.85, minZ: -2.35, maxZ: -1.15 });

  const jojoPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.58, 0.1, 24), patioMat);
  jojoPlinth.position.y = 0.05;
  jojoPlinth.receiveShadow = true;
  jojoRoot.add(jojoPlinth);

  const jojoGhost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.46, 1.24, 20, 1, true),
    emptyBracketMat
  );
  jojoGhost.position.y = 0.72;
  jojoRoot.add(jojoGhost);

  const jojoInstalledGroup = new THREE.Group();
  jojoRoot.add(jojoInstalledGroup);

  const jojoBody = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.47, 1.24, 24), jojoGreenMat);
  jojoBody.position.y = 0.72;
  jojoBody.castShadow = true;
  jojoBody.receiveShadow = true;
  jojoInstalledGroup.add(jojoBody);

  // Ribbed horizontal rings typical of South African JoJo tanks
  [0.34, 0.62, 0.9, 1.18].forEach((ry) => {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.468, 0.015, 8, 28), jojoGreenMat);
    rib.rotation.x = Math.PI * 0.5;
    rib.position.y = ry;
    jojoInstalledGroup.add(rib);
  });

  const jojoLid = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.06, 18), mats.darkMetalMat);
  jojoLid.position.set(0, 1.36, 0);
  jojoInstalledGroup.add(jojoLid);

  // Brass bottom tap facing forward/left
  const jojoTap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10), mats.brassMat);
  jojoTap.rotation.x = Math.PI * 0.5;
  jojoTap.position.set(0, 0.24, 0.5);
  jojoInstalledGroup.add(jojoTap);

  // Clear vertical sight-gauge water column on the front of the JoJo tank
  const gaugeTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 1.0, 12, 1, true),
    mats.pvcAcrylicWindowMat
  );
  gaugeTube.position.set(-0.22, 0.72, 0.47);
  jojoInstalledGroup.add(gaugeTube);

  const gaugeWaterPivot = new THREE.Group();
  gaugeWaterPivot.position.set(-0.22, 0.22, 0.47);
  const gaugeWaterBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.98, 12),
    mats.waterMat
  );
  gaugeWaterBar.position.y = 0.49;
  gaugeWaterPivot.add(gaugeWaterBar);
  jojoInstalledGroup.add(gaugeWaterPivot);

  const jojoSignTex = createGardenSignTexture('JOJO TANK', 'RAINWATER HARVEST', '#38bdf8');
  disposables.push(jojoSignTex);
  const jojoSignMat = new THREE.MeshBasicMaterial({ map: jojoSignTex });
  disposables.push(jojoSignMat);
  const jojoSign = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.27), jojoSignMat);
  jojoSign.position.set(0, 1.56, 0);
  jojoRoot.add(jojoSign);

  // 4. Solar El Niño Weather Forecast Mast (x = -2.25, z = -1.75)
  const weatherRoot = new THREE.Group();
  weatherRoot.position.set(-2.25, 0.03, -1.75);
  group.add(weatherRoot);
  colliders.push({ minX: -2.65, maxX: -1.85, minZ: -2.15, maxZ: -1.35 });

  const weatherPost = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 1.85, 12), mats.stainlessMat);
  weatherPost.position.y = 0.925;
  weatherPost.castShadow = true;
  weatherRoot.add(weatherPost);

  const weatherBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.08, 16), mats.darkMetalMat);
  weatherBase.position.y = 0.04;
  weatherRoot.add(weatherBase);

  const solarPanel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.28), mats.cabinetDarkMat);
  solarPanel.position.set(0, 1.48, 0.14);
  solarPanel.rotation.x = 0.45;
  weatherRoot.add(solarPanel);

  const weatherDome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), weatherDomeMat);
  weatherDome.position.set(0, 1.9, 0);
  weatherRoot.add(weatherDome);

  const anemometerGroup = new THREE.Group();
  anemometerGroup.position.set(0, 2.04, 0);
  for (let a = 0; a < 3; a++) {
    const arm = new THREE.Group();
    arm.rotation.y = (a * Math.PI * 2) / 3;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 6), mats.chromeMat);
    rod.rotation.z = Math.PI * 0.5;
    rod.position.x = 0.09;
    arm.add(rod);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), mats.brassMat);
    cup.position.x = 0.18;
    arm.add(cup);
    anemometerGroup.add(arm);
  }
  weatherRoot.add(anemometerGroup);

  const weatherSignTex = createGardenSignTexture('EL NIÑO RADAR', 'FORECAST STATION', '#fbbf24');
  disposables.push(weatherSignTex);
  const weatherSignMat = new THREE.MeshBasicMaterial({ map: weatherSignTex });
  disposables.push(weatherSignMat);
  const weatherSign = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.28), weatherSignMat);
  weatherSign.position.set(0, 1.15, 0.06);
  weatherRoot.add(weatherSign);

  // 5. Centerpiece Modular Vertical Hydroponic Stand (at x = 0, z = -0.85)
  const rackRoot = new THREE.Group();
  rackRoot.position.set(0, 0.03, -0.85);
  group.add(rackRoot);
  colliders.push({ minX: -1.1, maxX: 1.1, minZ: -1.55, maxZ: -0.15 });

  const rackBeacon = new THREE.Mesh(
    new THREE.RingGeometry(1.18, 1.26, 36),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
  );
  rackBeacon.rotation.x = -Math.PI * 0.5;
  rackBeacon.position.set(0, 0.02, 0.15);
  rackRoot.add(rackBeacon);
  disposables.push(rackBeacon.material as THREE.Material);

  const dynamicRackGroup = new THREE.Group();
  rackRoot.add(dynamicRackGroup);

  interface TierRuntimeVisual {
    tier: TierSaveState;
    waterGroup: THREE.Group;
    sprouts: THREE.Group[];
    pulses: THREE.Mesh[];
    harvestRing: THREE.Mesh;
  }

  let tierVisuals: TierRuntimeVisual[] = [];
  let cachedRackSig = '';
  let activeWeatherMode: WeatherMode = 'normal';
  let activeShadeCloth = false;

  const clearDynamicRack = () => {
    while (dynamicRackGroup.children.length > 0) {
      const child = dynamicRackGroup.children[0];
      dynamicRackGroup.remove(child);
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
    }
    tierVisuals = [];
  };

  const setGardenState = (
    rackSize: number,
    tiers: TierSaveState[],
    cutawayMode: boolean,
    resilience?: GardenResilienceState
  ) => {
    const clampedSize = Math.max(2, Math.min(6, rackSize));
    const jojoInstalled = resilience?.jojoInstalled ?? false;
    const jojoLitres = resilience?.jojoLitres ?? 18;
    const jojoCapacity = resilience?.jojoCapacity ?? 60;
    const shadeClothInstalled = resilience?.shadeClothInstalled ?? false;
    const weatherMode = resilience?.weatherMode ?? 'normal';

    activeWeatherMode = weatherMode;
    activeShadeCloth = shadeClothInstalled;

    // Update live JoJo tank visibility & sight gauge without rebuilding the rack
    jojoGhost.visible = !jojoInstalled;
    jojoInstalledGroup.visible = jojoInstalled;
    const fillRatio = Math.max(0.04, Math.min(1, jojoLitres / Math.max(1, jojoCapacity)));
    gaugeWaterPivot.visible = jojoLitres > 0;
    gaugeWaterPivot.scale.y = fillRatio;

    // Update solar weather beacon color
    if (weatherMode === 'heatwave') {
      weatherDomeMat.color.setHex(0xef4444);
      weatherDomeMat.emissive.setHex(0xdc2626);
    } else if (weatherMode === 'elnino_watch') {
      weatherDomeMat.color.setHex(0xf59e0b);
      weatherDomeMat.emissive.setHex(0xd97706);
    } else {
      weatherDomeMat.color.setHex(0x10b981);
      weatherDomeMat.emissive.setHex(0x059669);
    }

    const sig = JSON.stringify({
      clampedSize,
      cutawayMode,
      shadeClothInstalled,
      tiers: tiers.map((t) => ({
        i: t.tierIndex,
        p: t.pipeInstalled,
        c: t.cropId,
        w: t.wateredAtMs !== null,
      })),
    });

    if (sig === cachedRackSig) {
      tiers.forEach((t, idx) => {
        if (tierVisuals[idx]) tierVisuals[idx].tier = t;
      });
      return;
    }
    cachedRackSig = sig;
    clearDynamicRack();

    const topHeight = 0.45 + (clampedSize - 1) * 0.31 + 0.25;

    // A-frame steel uprights on left & right
    [-0.78, 0.78].forEach((ux) => {
      const frontLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, topHeight + 0.1, 0.055),
        mats.darkMetalMat
      );
      frontLeg.position.set(ux, topHeight * 0.5, 0.12);
      frontLeg.rotation.x = -0.14;
      frontLeg.castShadow = true;
      dynamicRackGroup.add(frontLeg);

      const backLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, topHeight + 0.08, 0.055),
        mats.darkMetalMat
      );
      backLeg.position.set(ux, topHeight * 0.5, -0.34);
      backLeg.rotation.x = 0.16;
      backLeg.castShadow = true;
      dynamicRackGroup.add(backLeg);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.92), mats.darkMetalMat);
      foot.position.set(ux, 0.02, -0.1);
      dynamicRackGroup.add(foot);
    });

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.05, 0.05), mats.darkMetalMat);
    topBar.position.set(0, topHeight - 0.04, -0.11);
    dynamicRackGroup.add(topBar);

    // Optional Craftable 40% Shade-Cloth Canopy over the Vertical Rack
    if (shadeClothInstalled) {
      const canopyY = topHeight + 0.34;
      [
        [-0.82, 0.38],
        [0.82, 0.38],
        [-0.82, -0.42],
        [0.82, -0.42],
      ].forEach(([px, pz]) => {
        const poleH = pz > 0 ? 0.38 : 0.46;
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016, 0.016, poleH, 8),
          mats.stainlessMat
        );
        pole.position.set(px, topHeight + poleH * 0.5 - 0.04, pz);
        dynamicRackGroup.add(pole);
      });

      const shadeMesh = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.016, 1.06), shadeNetMat);
      shadeMesh.position.set(0, canopyY, -0.02);
      shadeMesh.rotation.x = 0.1;
      shadeMesh.castShadow = true;
      dynamicRackGroup.add(shadeMesh);
    }

    for (let i = 0; i < clampedSize; i++) {
      const tier = tiers[i] ?? {
        tierIndex: i,
        pipeInstalled: false,
        cropId: null,
        plantedAtMs: null,
        wateredAtMs: null,
        waterDurationHours: 84,
        harvested: false,
      };
      const ty = 0.4 + i * 0.31;
      const tz = 0.24 - i * 0.095;

      [-0.45, 0.45].forEach((cx) => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.22), mats.stainlessMat);
        arm.position.set(cx, ty - PIPE_RADIUS - 0.015, tz);
        dynamicRackGroup.add(arm);
      });
      const tierBar = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.03, 0.035), mats.darkMetalMat);
      tierBar.position.set(0, ty - PIPE_RADIUS - 0.025, tz);
      dynamicRackGroup.add(tierBar);

      if (!tier.pipeInstalled) {
        const ghostPipe = new THREE.Mesh(
          new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, 1.18, 16, 1, true),
          emptyBracketMat
        );
        ghostPipe.rotation.z = -Math.PI * 0.5;
        ghostPipe.position.set(0, ty, tz);
        dynamicRackGroup.add(ghostPipe);
        continue;
      }

      const pipeGroup = new THREE.Group();
      pipeGroup.position.set(0, ty, tz);
      dynamicRackGroup.add(pipeGroup);

      const shellMat = cutawayMode ? mats.pvcXrayMat : mats.pvcMat;
      const pipeBody = new THREE.Mesh(
        new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, 1.18, 22, 1, true, 0.62, Math.PI * 2 - 1.24),
        shellMat
      );
      pipeBody.rotation.z = -Math.PI * 0.5;
      pipeBody.castShadow = true;
      pipeGroup.add(pipeBody);

      const windowPane = new THREE.Mesh(
        new THREE.CylinderGeometry(PIPE_RADIUS + 0.001, PIPE_RADIUS + 0.001, 1.12, 14, 1, true, -0.62, 1.24),
        mats.pvcAcrylicWindowMat
      );
      windowPane.rotation.z = -Math.PI * 0.5;
      pipeGroup.add(windowPane);

      const elbow = new THREE.Mesh(
        new THREE.TorusGeometry(0.058, PIPE_RADIUS * 1.02, 10, 16, Math.PI * 0.5),
        shellMat
      );
      elbow.position.set(-0.59, 0.058, 0);
      elbow.rotation.z = Math.PI;
      pipeGroup.add(elbow);

      const funnel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.064, 0.038, 0.075, 16, 1, true),
        mats.pvcMat
      );
      funnel.position.set(-0.648, 0.13, 0);
      pipeGroup.add(funnel);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(PIPE_RADIUS * 1.07, PIPE_RADIUS * 1.07, 0.05, 18),
        shellMat
      );
      cap.rotation.z = Math.PI * 0.5;
      cap.position.set(0.6, 0, 0);
      pipeGroup.add(cap);

      const waterGroup = new THREE.Group();
      waterGroup.position.set(0, -PIPE_RADIUS + 0.008, 0);
      const waterBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.16, 0.048, PIPE_RADIUS * 1.5),
        mats.waterMat
      );
      waterBar.position.y = 0.024;
      waterGroup.add(waterBar);
      waterGroup.visible = tier.wateredAtMs !== null;
      pipeGroup.add(waterGroup);

      const harvestRing = new THREE.Mesh(
        new THREE.RingGeometry(0.56, 0.6, 4),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
      );
      harvestRing.rotation.x = -Math.PI * 0.5;
      harvestRing.position.y = PIPE_RADIUS + 0.015;
      harvestRing.visible = false;
      pipeGroup.add(harvestRing);
      disposables.push(harvestRing.material as THREE.Material);

      const cropDef = getCropById(tier.cropId);
      const sprouts: THREE.Group[] = [];
      const pulses: THREE.Mesh[] = [];

      PORT_X_OFFSETS.forEach((px) => {
        const pod = new THREE.Group();
        pod.position.set(px, PIPE_RADIUS, 0);

        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.026, 0.045, 12), mats.netCupMat);
        cup.position.y = -0.016;
        pod.add(cup);

        const wick = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0055, 0.0055, 0.088, 8),
          tier.wateredAtMs !== null ? mats.wickWetMat : mats.wickDryMat
        );
        wick.position.y = -0.062;
        pod.add(wick);

        const pulse = new THREE.Mesh(
          new THREE.SphereGeometry(0.0085, 8, 6),
          mats.waterStreamMat
        );
        pulse.position.y = -0.095;
        pulse.visible = tier.wateredAtMs !== null;
        pod.add(pulse);
        pulses.push(pulse);

        const sub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.033, 0.028, 0.018, 12),
          tier.wateredAtMs !== null ? mats.substrateWetMat : mats.substrateDryMat
        );
        sub.position.y = 0.002;
        pod.add(sub);

        if (cropDef) {
          const sprout = createPlantCanopyMesh(
            cropDef.canopyStyle,
            cropDef.leafColorHex,
            cropDef.accentColorHex,
            mats.stemMat,
            disposables
          );
          sprout.position.y = 0.01;
          sprout.scale.set(0.05, 0.05, 0.05);
          pod.add(sprout);
          sprouts.push(sprout);
        }

        pipeGroup.add(pod);
      });

      tierVisuals.push({
        tier,
        waterGroup,
        sprouts,
        pulses,
        harvestRing,
      });
    }
  };

  const update = (time: number, nowMs: number) => {
    const pulseScale = 1 + Math.sin(time * 3.8) * 0.03;
    rackBeacon.scale.set(pulseScale, pulseScale, 1);

    const windSpeed =
      activeWeatherMode === 'heatwave' ? 6.5 : activeWeatherMode === 'elnino_watch' ? 4.2 : 1.8;
    anemometerGroup.rotation.y = time * windSpeed;

    tierVisuals.forEach((tv, idx) => {
      const live = computeTierLiveMetrics(tv.tier, nowMs, activeWeatherMode, activeShadeCloth);

      if (live.waterPct > 0) {
        tv.waterGroup.visible = true;
        tv.waterGroup.scale.y = Math.max(0.18, live.waterPct / 100);
        tv.pulses.forEach((p, pidx) => {
          p.visible = true;
          const phase = (time * 0.55 + pidx * 0.25 + idx * 0.15) % 1;
          p.position.y = -0.102 + phase * 0.088;
        });
      } else {
        tv.waterGroup.visible = false;
        tv.pulses.forEach((p) => {
          p.visible = false;
        });
      }

      if (tv.sprouts.length > 0) {
        const s = 0.12 + (live.growthPct / 100) * 0.92;
        tv.sprouts.forEach((sp, sidx) => {
          sp.scale.set(s, s, s);
          sp.rotation.z = Math.sin(time * 1.4 + sidx + idx) * 0.035;
        });
      }

      tv.harvestRing.visible = live.harvestReady;
    });
  };

  const dispose = () => {
    clearDynamicRack();
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    disposables.forEach((d) => d.dispose());
  };

  return {
    group,
    colliders,
    rackAnchor: new THREE.Vector3(0, 0, -0.85),
    jojoAnchor: new THREE.Vector3(2.25, 0, -1.75),
    weatherAnchor: new THREE.Vector3(-2.25, 0, -1.75),
    kitchenDoorAnchor: new THREE.Vector3(0, 0, 4.15),
    compostDoorAnchor: new THREE.Vector3(2.65, 0, 4.15),
    setGardenState,
    update,
    dispose,
  };
}
