import * as THREE from 'three';
import { workshopAudio } from './audio';
import {
  WEATHER_FORECASTS,
  computeTierLiveMetrics,
  getCropById,
  type CanopyStyle,
  type TierSaveState,
  type WeatherMode,
} from './crops';
import type { AABB } from './kitchenRoomBuilder';
import type { WorkshopMaterials } from './materials';
import type { BuiltRackRecord, RackMaterialId } from './rackMaterials';
import {
  buildGardenSignage,
  createPropBrandPlaque,
  type DynamicSponsorController,
} from './sponsorSignage';
import { createWeatherFxSystem } from './weatherFx';

export type RackBuildStep = 1 | 2 | 3 | 4 | 5;

export interface RackBuildSessionState {
  activeRackIndex: number | null;
  step: RackBuildStep;
  materialId: RackMaterialId;
  uprightsDone: [boolean, boolean];
  slatsDone: [boolean, boolean, boolean];
  drainsDone: [boolean, boolean, boolean, boolean];
  linerDone: boolean;
  quickBuilt?: boolean;
}

export interface RackManualToolResult {
  stepDone: boolean;
  subProgress: number;
  completedCount: number;
  totalCount: number;
  subActionLabel: string;
  justCompletedSubTarget?: boolean;
}

export interface GardenResilienceState {
  jojoInstalled: boolean;
  jojoLitres: number;
  jojoCapacity: number;
  shadeClothInstalled: boolean;
  windbreakInstalled: boolean;
  stormBraceInstalled: boolean;
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
  setDoorOpenFactors: (kitchenOpen: number, compostOpen: number) => void;
  setGardenState: (
    rackSize: number,
    tiers: TierSaveState[],
    cutawayMode: boolean,
    resilience?: GardenResilienceState,
    builtRacks?: BuiltRackRecord[],
    rackBuildSession?: RackBuildSessionState | null
  ) => void;
  getRackRaycastTargets: (session: RackBuildSessionState | null) => THREE.Object3D[];
  stepRackManualTool: (
    session: RackBuildSessionState | null,
    dt: number,
    time: number,
    alignedIndex: number | null,
    isHolding: boolean
  ) => RackManualToolResult;
  resetRackBuildToolProgress: () => void;
  update: (dt: number, time: number, nowMs: number) => void;
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
  maxAnisotropy = 4,
  sponsorController?: DynamicSponsorController
): GardenYardHandle {
  const group = new THREE.Group();
  const colliders: AABB[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const signage = buildGardenSignage(maxAnisotropy, mats, sponsorController);
  group.add(signage.group);
  disposables.push({ dispose: signage.dispose });

  const weatherFx = createWeatherFxSystem();
  group.add(weatherFx.group);
  disposables.push({ dispose: weatherFx.dispose });

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
  const harvestRingMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const drainPortMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
  disposables.push(
    patioMat,
    grassMat,
    fenceWoodMat,
    emptyBracketMat,
    jojoGreenMat,
    shadeNetMat,
    weatherDomeMat,
    harvestRingMat,
    drainPortMat
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

  // 2. South Fence & Walk-Through Doors: Door 1 Kitchen (-1.45) & Door 3 Compost (+1.45)
  addFencePanel(9.8, 3.0, 0.2, 0, 1.5, 4.45);

  const buildGardenSouthDoor = (
    xPos: number,
    title: string,
    sub: string,
    accentHex: string,
    portalHex: number,
    glassMat: THREE.Material
  ): THREE.Group => {
    const dGroup = new THREE.Group();
    dGroup.position.set(xPos, 0, 4.38);

    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.34, 0.26), mats.cabinetDarkMat);
    frameL.position.set(-0.62, 1.17, 0.04);
    dGroup.add(frameL);
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.34, 0.26), mats.cabinetDarkMat);
    frameR.position.set(0.62, 1.17, 0.04);
    dGroup.add(frameR);
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.14, 0.26), mats.cabinetDarkMat);
    frameTop.position.set(0, 2.27, 0.04);
    dGroup.add(frameTop);

    const leafPivot = new THREE.Group();
    leafPivot.position.set(-0.56, 0, 0);
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.18, 0.08), mats.cabinetMat);
    doorPanel.position.set(0.56, 1.12, 0);
    leafPivot.add(doorPanel);

    const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.15, 0.09), glassMat);
    doorGlass.position.set(0.56, 1.48, 0);
    leafPivot.add(doorGlass);

    const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.08), mats.brassMat);
    doorHandle.position.set(0.98, 1.05, -0.06);
    leafPivot.add(doorHandle);
    dGroup.add(leafPivot);

    const signTex = createGardenSignTexture(title, sub, accentHex);
    disposables.push(signTex);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    disposables.push(signMat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.38), signMat);
    sign.position.set(0, 2.6, -0.05);
    sign.rotation.y = Math.PI;
    dGroup.add(sign);

    const beacon = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.4, 28),
      new THREE.MeshBasicMaterial({ color: portalHex, side: THREE.DoubleSide })
    );
    beacon.rotation.x = -Math.PI * 0.5;
    beacon.position.set(0, 0.04, -0.52);
    dGroup.add(beacon);
    disposables.push(beacon.material as THREE.Material);

    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(1.16, 0.56),
      new THREE.MeshBasicMaterial({
        color: portalHex,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
      })
    );
    pad.rotation.x = -Math.PI * 0.5;
    pad.position.set(0, 0.035, -0.36);
    dGroup.add(pad);
    disposables.push(pad.material as THREE.Material);

    group.add(dGroup);
    return leafPivot;
  };

  const kitchenDoorPivot = buildGardenSouthDoor(
    -1.45,
    'DOOR 1 · KITCHEN',
    'WALK THROUGH →',
    '#38bdf8',
    0x38bdf8,
    mats.pvcAcrylicWindowMat
  );
  const compostDoorPivot = buildGardenSouthDoor(
    1.45,
    'DOOR 3 · COMPOST',
    'WALK THROUGH →',
    '#fbbf24',
    0xfbbf24,
    mats.leafMat
  );

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

  if (sponsorController) {
    const jojoTopPlaque = createPropBrandPlaque({
      controller: sponsorController,
      slotId: 'garden_jojo',
      width: 0.92,
      height: 0.3,
      mats,
      maxAnisotropy,
      disposables,
    });
    jojoTopPlaque.position.set(0, 1.58, 0);
    jojoRoot.add(jojoTopPlaque);

    const jojoChestPlaque = createPropBrandPlaque({
      controller: sponsorController,
      slotId: 'garden_jojo',
      width: 0.56,
      height: 0.22,
      mats,
      maxAnisotropy,
      disposables,
    });
    jojoChestPlaque.position.set(0.14, 0.78, 0.48);
    jojoInstalledGroup.add(jojoChestPlaque);
  } else {
    const jojoSignTex = createGardenSignTexture('JOJO TANK', 'RAINWATER HARVEST', '#38bdf8');
    disposables.push(jojoSignTex);
    const jojoSignMat = new THREE.MeshBasicMaterial({ map: jojoSignTex });
    disposables.push(jojoSignMat);
    const jojoSign = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.27), jojoSignMat);
    jojoSign.position.set(0, 1.56, 0);
    jojoRoot.add(jojoSign);
  }

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

  if (sponsorController) {
    const weatherPlaque = createPropBrandPlaque({
      controller: sponsorController,
      slotId: 'garden_weather_mast',
      width: 0.94,
      height: 0.3,
      mats,
      maxAnisotropy,
      disposables,
    });
    weatherPlaque.position.set(0, 1.15, 0.06);
    weatherRoot.add(weatherPlaque);
  } else {
    const weatherSignTex = createGardenSignTexture('EL NIÑO RADAR', 'FORECAST STATION', '#fbbf24');
    disposables.push(weatherSignTex);
    const weatherSignMat = new THREE.MeshBasicMaterial({ map: weatherSignTex });
    disposables.push(weatherSignMat);
    const weatherSign = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.28), weatherSignMat);
    weatherSign.position.set(0, 1.15, 0.06);
    weatherRoot.add(weatherSign);
  }

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

  if (sponsorController) {
    // Windbreak & Storm Defense Kit sign beside the rack
    const kitPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.028, 0.96, 8),
      mats.darkMetalMat
    );
    kitPost.position.set(1.36, 0.48, 0.05);
    rackRoot.add(kitPost);

    const stormKitPlaque = createPropBrandPlaque({
      controller: sponsorController,
      slotId: 'garden_storm_kit',
      width: 0.72,
      height: 0.26,
      mats,
      maxAnisotropy,
      disposables,
    });
    stormKitPlaque.position.set(1.36, 0.96, 0.07);
    rackRoot.add(stormKitPlaque);
  }

  // Windbreak Netting Screen Group & Storm Brace + Rain Diverter Group
  const windbreakGroup = new THREE.Group();
  const windbreakNetMat = new THREE.MeshStandardMaterial({
    color: 0x166534,
    roughness: 0.85,
    transparent: true,
    opacity: 0.56,
    side: THREE.DoubleSide,
  });
  disposables.push(windbreakNetMat);
  [
    [-1.18, 0.65, -0.12],
    [1.18, 0.65, -0.12],
    [-1.18, 0.65, -0.82],
    [1.18, 0.65, -0.82],
  ].forEach(([px, py, pz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 1.35, 8), mats.stainlessMat);
    pole.position.set(px, py, pz);
    windbreakGroup.add(pole);
  });
  // Side & rear woven windbreak panels
  const leftScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 1.18), windbreakNetMat);
  leftScreen.position.set(-1.18, 0.66, -0.47);
  leftScreen.rotation.y = Math.PI * 0.5;
  windbreakGroup.add(leftScreen);

  const rightScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 1.18), windbreakNetMat);
  rightScreen.position.set(1.18, 0.66, -0.47);
  rightScreen.rotation.y = Math.PI * 0.5;
  windbreakGroup.add(rightScreen);

  const backScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 1.18), windbreakNetMat);
  backScreen.position.set(0, 0.66, -0.82);
  windbreakGroup.add(backScreen);

  windbreakGroup.visible = false;
  rackRoot.add(windbreakGroup);

  const stormBraceGroup = new THREE.Group();
  [
    [-0.96, 0.42, 0.46, -0.38, 0.46],
    [0.96, 0.42, 0.46, 0.38, 0.46],
    [-0.96, 0.42, -0.58, -0.38, -0.58],
    [0.96, 0.42, -0.58, 0.38, -0.58],
  ].forEach(([gx, gy, gz, rotZ, _unused]) => {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.16, 8), mats.brassMat);
    peg.position.set(gx, 0.08, gz);
    stormBraceGroup.add(peg);
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.94, 6), mats.stainlessMat);
    strap.position.set(gx * 0.85, gy, gz * 0.72);
    strap.rotation.z = rotZ;
    stormBraceGroup.add(strap);
  });
  // JoJo Tank Rainwater Gutter Diverter Pipe running overhead into JoJo Lid
  const gutterPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.65, 10), mats.pvcMat);
  gutterPipe.position.set(1.38, 1.48, -0.45);
  gutterPipe.rotation.z = 0.22;
  gutterPipe.rotation.y = -0.48;
  stormBraceGroup.add(gutterPipe);

  stormBraceGroup.visible = false;
  rackRoot.add(stormBraceGroup);

  // Persistent sponsor plaque objects stored separately from clearDynamicRack disposal
  const rackCrownPlaque = sponsorController
    ? createPropBrandPlaque({
        controller: sponsorController,
        slotId: 'garden_rack',
        width: 1.12,
        height: 0.32,
        mats,
        maxAnisotropy,
        disposables,
      })
    : null;
  if (rackCrownPlaque) {
    rackCrownPlaque.position.set(0, 1.38, -0.11);
    rackRoot.add(rackCrownPlaque);
  }

  const shadePlaque = sponsorController
    ? createPropBrandPlaque({
        controller: sponsorController,
        slotId: 'garden_shade_cloth',
        width: 1.18,
        height: 0.24,
        mats,
        maxAnisotropy,
        disposables,
      })
    : null;
  if (shadePlaque) {
    shadePlaque.visible = false;
    rackRoot.add(shadePlaque);
  }

  const dynamicRackGroup = new THREE.Group();
  rackRoot.add(dynamicRackGroup);

  // --------------------------------------------------------------------------
  // 5b. In-World 3D 5-Step Rack Assembly Overlay (Uprights, Slats, 3D Drill, Liner)
  // --------------------------------------------------------------------------
  const rackBuildOverlayGroup = new THREE.Group();
  rackBuildOverlayGroup.visible = false;
  rackRoot.add(rackBuildOverlayGroup);

  const bayTargetGroup = new THREE.Group();
  rackBuildOverlayGroup.add(bayTargetGroup);

  // Small 3D Material Sample Caddy beside the rack during Step 1
  const swatchCaddy = new THREE.Group();
  swatchCaddy.position.set(-1.32, 0, -0.05);
  swatchCaddy.visible = false;
  const caddyPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.78, 10), mats.darkMetalMat);
  caddyPost.position.y = 0.39;
  swatchCaddy.add(caddyPost);
  const caddyTray = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.28), mats.cabinetDarkMat);
  caddyTray.position.y = 0.79;
  swatchCaddy.add(caddyTray);
  const swatchBlock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.18), mats.rackReclaimedPvcMat);
  swatchBlock.position.y = 0.855;
  swatchBlock.rotation.y = 0.25;
  swatchCaddy.add(swatchBlock);
  rackBuildOverlayGroup.add(swatchCaddy);

  const rackHitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  disposables.push(rackHitboxMat);

  const makeBullseyeTarget = (
    outerR: number,
    innerR: number,
    hitRadius: number,
    kind: string,
    index: number
  ) => {
    const tg = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    disposables.push(ringMat, coreMat);

    const ring = new THREE.Mesh(new THREE.RingGeometry(innerR, outerR, 24), ringMat);
    tg.add(ring);
    const core = new THREE.Mesh(new THREE.CircleGeometry(innerR * 0.52, 16), coreMat);
    core.position.z = 0.002;
    tg.add(core);

    const hitSphere = new THREE.Mesh(new THREE.SphereGeometry(hitRadius, 10, 8), rackHitboxMat);
    hitSphere.userData.targetKind = kind;
    hitSphere.userData.targetIndex = index;
    tg.add(hitSphere);

    bayTargetGroup.add(tg);
    return { group: tg, ringMat, coreMat, hitSphere };
  };

  // Step 2: 2 Side Upright targets (Left -0.75, Right +0.75)
  const uprightTargets = [-0.75, 0.75].map((ux, idx) => {
    const t = makeBullseyeTarget(0.088, 0.056, 0.19, 'rack_upright', idx);
    t.group.position.set(ux, -0.02, 0.075);
    return t;
  });

  // Step 3: 3 Horizontal Cross Slat fastener targets spaced across front edge (non-overlapping in Z)
  const SLAT_TARGET_X = [-0.46, 0, 0.46];
  const slatTargets = SLAT_TARGET_X.map((sx, idx) => {
    const t = makeBullseyeTarget(0.072, 0.044, 0.17, 'rack_slat', idx);
    t.group.position.set(sx, -PIPE_RADIUS - 0.014, 0.115);
    t.group.rotation.x = -0.28;
    return t;
  });

  // Step 4a: 4 Cordless Drill drainage hole bullseyes
  const drillTargets = PORT_X_OFFSETS.map((px, idx) => {
    const t = makeBullseyeTarget(0.056, 0.032, 0.135, 'rack_drill', idx);
    t.group.position.set(px, -PIPE_RADIUS + 0.016, 0.058);
    t.group.rotation.x = -Math.PI * 0.28;
    return t;
  });

  // Step 4b: Center Waterproof Liner fit target
  const linerTarget = makeBullseyeTarget(0.115, 0.074, 0.24, 'rack_liner', 0);
  linerTarget.group.position.set(0, -PIPE_RADIUS + 0.028, 0.09);
  linerTarget.group.rotation.x = -0.3;

  // Step 5: Completed Rack Emerald Placement Halo
  const step5HaloMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
  disposables.push(step5HaloMat);
  const step5Halo = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.3, 0.28), step5HaloMat);
  step5HaloMat.wireframe = true;
  step5Halo.position.set(0, -0.02, 0);
  step5Halo.visible = false;
  bayTargetGroup.add(step5Halo);

  // 3D Animated Ratchet / Wrench Tool (Steps 2 & 3)
  const animWrench = new THREE.Group();
  animWrench.visible = false;
  const wHandle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.22, 0.018), mats.chromeMat);
  wHandle.position.y = 0.11;
  animWrench.add(wHandle);
  const wGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.11, 10), mats.drillBodyMat);
  wGrip.position.y = 0.19;
  animWrench.add(wGrip);
  const wHead = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.038, 12), mats.stainlessMat);
  wHead.rotation.x = Math.PI * 0.5;
  wHead.position.set(0, 0, -0.015);
  animWrench.add(wHead);
  bayTargetGroup.add(animWrench);

  // 3D Animated Cordless Drill (Step 4a - identical styling to Kitchen drill)
  const animRackDrill = new THREE.Group();
  animRackDrill.visible = false;
  const rdBody = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.16, 12), mats.drillBodyMat);
  rdBody.position.y = 0.16;
  animRackDrill.add(rdBody);
  const rdGrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.115, 0.046), mats.drillBodyMat);
  rdGrip.position.set(-0.068, 0.15, 0);
  rdGrip.rotation.z = 0.35;
  animRackDrill.add(rdGrip);
  const rdBit = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.065, 14, 1, true), mats.brassMat);
  rdBit.position.y = 0.045;
  animRackDrill.add(rdBit);
  animRackDrill.rotation.x = 0.28;
  bayTargetGroup.add(animRackDrill);

  // 3D Animated Liner Roll (Step 4b)
  const animLinerRoll = new THREE.Group();
  animLinerRoll.visible = false;
  const rollCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.24, 14), mats.rackLinerMat);
  rollCyl.rotation.x = Math.PI * 0.5;
  animLinerRoll.add(rollCyl);
  bayTargetGroup.add(animLinerRoll);

  // 3D Shavings & Spark Burst Particles (Steps 2–4)
  const rackShavingsGroup = new THREE.Group();
  rackShavingsGroup.visible = false;
  bayTargetGroup.add(rackShavingsGroup);
  const rackShavingParticles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number }> = [];
  for (let i = 0; i < 14; i++) {
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.006, 0.008), mats.brassMat);
    rackShavingsGroup.add(chip);
    rackShavingParticles.push({
      mesh: chip,
      vx: ((i % 5) - 2) * 0.17,
      vy: 0.32 + (i % 3) * 0.15,
      vz: (((i * 3) % 5) - 2) * 0.15,
    });
  }

  let uprightHoldProgress = [0, 0];
  let slatHoldProgress = [0, 0, 0];
  let drillHoldProgress = [0, 0, 0, 0];
  let linerHoldProgress = 0;

  const resetRackBuildToolProgress = () => {
    uprightHoldProgress = [0, 0];
    slatHoldProgress = [0, 0, 0];
    drillHoldProgress = [0, 0, 0, 0];
    linerHoldProgress = 0;
    animWrench.visible = false;
    animRackDrill.visible = false;
    animLinerRoll.visible = false;
    rackShavingsGroup.visible = false;
  };

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
  let activeWindbreak = false;
  let activeStormBrace = false;

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

  const resolveRackFrameMat = (materialId: RackMaterialId): THREE.Material => {
    switch (materialId) {
      case 'reclaimed_pvc':
        return mats.rackReclaimedPvcMat;
      case 'pallet_wood':
        return mats.rackPalletWoodMat;
      case 'scrap_metal':
        return mats.rackScrapMetalMat;
      case 'upcycled_hdpe':
        return mats.rackUpcycledHdpeMat;
      case 'standard_pvc':
        return mats.rackStandardPvcMat;
      case 'standard_timber':
        return mats.rackStandardTimberMat;
      default:
        return mats.darkMetalMat;
    }
  };

  const setGardenState = (
    rackSize: number,
    tiers: TierSaveState[],
    cutawayMode: boolean,
    resilience?: GardenResilienceState,
    builtRacks?: BuiltRackRecord[],
    rackBuildSession?: RackBuildSessionState | null
  ) => {
    const clampedSize = Math.max(1, Math.min(6, rackSize));
    const jojoInstalled = resilience?.jojoInstalled ?? false;
    const jojoLitres = resilience?.jojoLitres ?? 18;
    const jojoCapacity = resilience?.jojoCapacity ?? 60;
    const shadeClothInstalled = resilience?.shadeClothInstalled ?? false;
    const windbreakInstalled = resilience?.windbreakInstalled ?? false;
    const stormBraceInstalled = resilience?.stormBraceInstalled ?? false;
    const weatherMode = resilience?.weatherMode ?? 'normal';

    activeWeatherMode = weatherMode;
    activeShadeCloth = shadeClothInstalled;
    activeWindbreak = windbreakInstalled;
    activeStormBrace = stormBraceInstalled;

    windbreakGroup.visible = windbreakInstalled;
    stormBraceGroup.visible = stormBraceInstalled;

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
    } else if (weatherMode === 'elnino_watch' || weatherMode === 'windy') {
      weatherDomeMat.color.setHex(0xf59e0b);
      weatherDomeMat.emissive.setHex(0xd97706);
    } else if (weatherMode === 'rain_storm') {
      weatherDomeMat.color.setHex(0x38bdf8);
      weatherDomeMat.emissive.setHex(0x0284c7);
    } else {
      weatherDomeMat.color.setHex(0x10b981);
      weatherDomeMat.emissive.setHex(0x059669);
    }

    const topHeightPreview = 0.45 + (clampedSize - 1) * 0.31 + 0.25;
    if (rackCrownPlaque) {
      rackCrownPlaque.position.set(0, topHeightPreview + 0.12, -0.11);
    }
    if (shadePlaque) {
      shadePlaque.visible = shadeClothInstalled;
      shadePlaque.position.set(0, topHeightPreview + 0.34, 0.51);
    }

    // Update persistent 3D Assembly Overlay & target visibility
    const activeIdx = rackBuildSession?.activeRackIndex ?? null;
    if (activeIdx !== null && activeIdx >= 0 && activeIdx < clampedSize && rackBuildSession) {
      const ty = 0.4 + activeIdx * 0.31;
      const tz = 0.24 - activeIdx * 0.095;
      rackBuildOverlayGroup.visible = true;
      bayTargetGroup.position.set(0, ty, tz);

      swatchCaddy.visible = rackBuildSession.step === 1;
      swatchBlock.material = resolveRackFrameMat(
        rackBuildSession.materialId
      ) as THREE.MeshStandardMaterial;

      const s = rackBuildSession.step;
      uprightTargets.forEach((t, idx) => {
        t.group.visible = s === 2 && !rackBuildSession.uprightsDone[idx];
      });
      slatTargets.forEach((t, idx) => {
        t.group.visible = s === 3 && !rackBuildSession.slatsDone[idx];
      });
      const allDrainsDone = rackBuildSession.drainsDone.every(Boolean);
      drillTargets.forEach((t, idx) => {
        t.group.visible = s === 4 && !rackBuildSession.drainsDone[idx];
      });
      linerTarget.group.visible = s === 4 && allDrainsDone && !rackBuildSession.linerDone;
      step5Halo.visible = s === 5;
    } else {
      rackBuildOverlayGroup.visible = false;
      swatchCaddy.visible = false;
      step5Halo.visible = false;
    }

    const builtMap = new Map<number, BuiltRackRecord>();
    if (Array.isArray(builtRacks)) {
      builtRacks.forEach((b) => builtMap.set(b.rackIndex, b));
    }

    const sig = JSON.stringify({
      clampedSize,
      cutawayMode,
      shadeClothInstalled,
      built: Array.from({ length: clampedSize }, (_, idx) => builtMap.get(idx)?.materialId ?? 'unbuilt'),
      buildSession:
        activeIdx !== null && rackBuildSession
          ? {
              i: activeIdx,
              s: rackBuildSession.step,
              m: rackBuildSession.materialId,
              u: rackBuildSession.uprightsDone,
              sl: rackBuildSession.slatsDone,
              d: rackBuildSession.drainsDone,
              l: rackBuildSession.linerDone,
            }
          : null,
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
    const firstBuilt = builtMap.get(0) ?? builtRacks?.[0];
    const spineMat = firstBuilt
      ? resolveRackFrameMat(firstBuilt.materialId)
      : rackBuildSession && rackBuildSession.activeRackIndex !== null
        ? resolveRackFrameMat(rackBuildSession.materialId)
        : mats.rackUnbuiltGhostMat;

    // A-frame spine uprights on left & right
    [-0.78, 0.78].forEach((ux) => {
      const frontLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, topHeight + 0.1, 0.055),
        spineMat
      );
      frontLeg.position.set(ux, topHeight * 0.5, 0.12);
      frontLeg.rotation.x = -0.14;
      frontLeg.castShadow = Boolean(firstBuilt);
      dynamicRackGroup.add(frontLeg);

      const backLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, topHeight + 0.08, 0.055),
        spineMat
      );
      backLeg.position.set(ux, topHeight * 0.5, -0.34);
      backLeg.rotation.x = 0.16;
      backLeg.castShadow = Boolean(firstBuilt);
      dynamicRackGroup.add(backLeg);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.92), spineMat);
      foot.position.set(ux, 0.02, -0.1);
      dynamicRackGroup.add(foot);
    });

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.05, 0.05), spineMat);
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
      const builtSpec = builtMap.get(i);
      const isRackBuilt = Boolean(builtSpec);
      const isActivelyAssembling = activeIdx === i && Boolean(rackBuildSession);
      const sessionMat = rackBuildSession
        ? resolveRackFrameMat(rackBuildSession.materialId)
        : mats.darkMetalMat;
      const bayMat = builtSpec
        ? resolveRackFrameMat(builtSpec.materialId)
        : isActivelyAssembling
          ? sessionMat
          : mats.rackUnbuiltGhostMat;
      const ty = 0.4 + i * 0.31;
      const tz = 0.24 - i * 0.095;

      // 2 Vertical Side Upright Bay Brackets
      [-0.75, 0.75].forEach((ux, uIdx) => {
        const uprightSolid =
          isRackBuilt ||
          (isActivelyAssembling &&
            rackBuildSession !== null &&
            rackBuildSession !== undefined &&
            (rackBuildSession.step > 2 ||
              (rackBuildSession.step === 2 && rackBuildSession.uprightsDone[uIdx])));
        const bayUpright = new THREE.Mesh(
          new THREE.BoxGeometry(0.068, 0.26, 0.08),
          uprightSolid ? bayMat : mats.rackUnbuiltGhostMat
        );
        bayUpright.position.set(ux, ty - 0.02, tz);
        bayUpright.castShadow = uprightSolid;
        dynamicRackGroup.add(bayUpright);
      });

      // 3 Horizontal Cross Slats (Rear, Center, Front)
      [-0.085, 0, 0.085].forEach((szOffset, sIdx) => {
        const slatSolid =
          isRackBuilt ||
          (isActivelyAssembling &&
            rackBuildSession !== null &&
            rackBuildSession !== undefined &&
            (rackBuildSession.step > 3 ||
              (rackBuildSession.step === 3 && rackBuildSession.slatsDone[sIdx])));
        const crossSlat = new THREE.Mesh(
          new THREE.BoxGeometry(1.52, 0.028, 0.032),
          slatSolid ? bayMat : mats.rackUnbuiltGhostMat
        );
        crossSlat.position.set(0, ty - PIPE_RADIUS - 0.026, tz + szOffset);
        crossSlat.castShadow = slatSolid;
        dynamicRackGroup.add(crossSlat);
      });

      if (!isRackBuilt) {
        if (isActivelyAssembling && rackBuildSession && rackBuildSession.step >= 4) {
          // Step 4 & 5: Drill bed deck + drilled drainage rings + optional liner
          const deckBoard = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.012, 0.21),
            bayMat
          );
          deckBoard.position.set(0, ty - PIPE_RADIUS - 0.012, tz);
          dynamicRackGroup.add(deckBoard);

          if (rackBuildSession.linerDone || rackBuildSession.step === 5) {
            const linerTray = new THREE.Mesh(
              new THREE.BoxGeometry(1.42, 0.014, 0.22),
              mats.rackLinerMat
            );
            linerTray.position.set(0, ty - PIPE_RADIUS - 0.004, tz);
            dynamicRackGroup.add(linerTray);
          }

          PORT_X_OFFSETS.forEach((px, dIdx) => {
            if (rackBuildSession.drainsDone[dIdx] || rackBuildSession.step === 5) {
              const boreHole = new THREE.Mesh(
                new THREE.CircleGeometry(0.016, 12),
                mats.darkMetalMat
              );
              boreHole.rotation.x = -Math.PI * 0.5;
              boreHole.position.set(px, ty - PIPE_RADIUS + 0.003, tz);
              dynamicRackGroup.add(boreHole);

              const drainRing = new THREE.Mesh(
                new THREE.RingGeometry(0.016, 0.028, 12),
                drainPortMat
              );
              drainRing.rotation.x = -Math.PI * 0.5;
              drainRing.position.set(px, ty - PIPE_RADIUS + 0.004, tz);
              dynamicRackGroup.add(drainRing);
            }
          });
        } else {
          // Translucent unbuilt footprint guide
          const ghostDeck = new THREE.Mesh(
            new THREE.BoxGeometry(1.36, 0.02, 0.2),
            mats.rackUnbuiltGhostMat
          );
          ghostDeck.position.set(0, ty - PIPE_RADIUS - 0.006, tz);
          dynamicRackGroup.add(ghostDeck);
        }
        continue;
      }

      // Fitted Waterproof Moisture Liner & 4 Drilled Drainage Ports on assembled rack bay
      const linerTray = new THREE.Mesh(
        new THREE.BoxGeometry(1.42, 0.014, 0.22),
        mats.rackLinerMat
      );
      linerTray.position.set(0, ty - PIPE_RADIUS - 0.008, tz);
      dynamicRackGroup.add(linerTray);

      PORT_X_OFFSETS.forEach((px) => {
        const drainRing = new THREE.Mesh(
          new THREE.RingGeometry(0.012, 0.022, 12),
          drainPortMat
        );
        drainRing.rotation.x = -Math.PI * 0.5;
        drainRing.position.set(px, ty - PIPE_RADIUS + 0.001, tz);
        dynamicRackGroup.add(drainRing);
      });

      [-0.45, 0.45].forEach((cx) => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.026, 0.21), mats.stainlessMat);
        arm.position.set(cx, ty - PIPE_RADIUS - 0.002, tz);
        dynamicRackGroup.add(arm);
      });

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
        harvestRingMat
      );
      harvestRing.rotation.x = -Math.PI * 0.5;
      harvestRing.position.y = PIPE_RADIUS + 0.015;
      harvestRing.visible = false;
      pipeGroup.add(harvestRing);

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

  const getRackRaycastTargets = (session: RackBuildSessionState | null): THREE.Object3D[] => {
    if (!session || session.activeRackIndex === null) return [];
    if (session.step === 2) {
      return uprightTargets
        .filter((_, idx) => !session.uprightsDone[idx])
        .map((t) => t.hitSphere);
    }
    if (session.step === 3) {
      return slatTargets
        .filter((_, idx) => !session.slatsDone[idx])
        .map((t) => t.hitSphere);
    }
    if (session.step === 4) {
      const anyHoleLeft = session.drainsDone.some((d) => !d);
      if (anyHoleLeft) {
        return drillTargets
          .filter((_, idx) => !session.drainsDone[idx])
          .map((t) => t.hitSphere);
      }
      if (!session.linerDone) {
        return [linerTarget.hitSphere];
      }
    }
    return [];
  };

  const stepRackManualTool = (
    session: RackBuildSessionState | null,
    dt: number,
    time: number,
    alignedIndex: number | null,
    isHolding: boolean
  ): RackManualToolResult => {
    animWrench.visible = false;
    animRackDrill.visible = false;
    animLinerRoll.visible = false;
    rackShavingsGroup.visible = false;

    if (!session || session.activeRackIndex === null) {
      return {
        stepDone: false,
        subProgress: 0,
        completedCount: 0,
        totalCount: 0,
        subActionLabel: 'Build Rack',
      };
    }

    const pulseBullseye = (
      ringMat: THREE.MeshBasicMaterial,
      coreMat: THREE.MeshBasicMaterial,
      isAligned: boolean,
      phaseOffset: number
    ) => {
      if (isAligned) {
        ringMat.color.setHex(0x34d399);
        ringMat.opacity = 1.0;
        coreMat.color.setHex(0x6ee7b7);
        coreMat.opacity = 0.95;
      } else {
        const pulse = 0.72 + Math.sin(time * 4.5 + phaseOffset) * 0.22;
        ringMat.color.setHex(0xfbbf24);
        ringMat.opacity = pulse;
        coreMat.color.setHex(0xfef08a);
        coreMat.opacity = pulse * 0.85;
      }
    };

    // Step 2: 2 Side Uprights
    if (session.step === 2) {
      uprightTargets.forEach((t, idx) => {
        pulseBullseye(t.ringMat, t.coreMat, alignedIndex === idx && !session.uprightsDone[idx], idx);
      });

      const activeIdx =
        alignedIndex !== null && alignedIndex >= 0 && alignedIndex < 2 && !session.uprightsDone[alignedIndex]
          ? alignedIndex
          : null;

      let justCompleted = false;
      if (activeIdx !== null) {
        const ux = activeIdx === 0 ? -0.75 : 0.75;
        animWrench.visible = true;
        animWrench.position.set(ux, -0.02, 0.11);
        animWrench.rotation.z = isHolding ? Math.sin(time * 18) * 0.42 : 0.25;

        if (isHolding) {
          rackShavingsGroup.visible = true;
          rackShavingsGroup.position.set(ux, -0.02, 0.08);
          rackShavingParticles.forEach((p, idx) => {
            const lt = (time * 2.0 + idx * 0.04) % 0.4;
            p.mesh.position.set(p.vx * lt, p.vy * lt * 0.7 - 1.2 * lt * lt, p.vz * lt);
          });
          workshopAudio.playSawStroke();

          uprightHoldProgress[activeIdx] = Math.min(1, uprightHoldProgress[activeIdx] + dt / 0.65);
          if (uprightHoldProgress[activeIdx] >= 1) {
            session.uprightsDone[activeIdx] = true;
            justCompleted = true;
            workshopAudio.playSnapComplete();
          }
        }
      }

      const completedCount = session.uprightsDone.filter(Boolean).length;
      return {
        stepDone: completedCount === 2,
        subProgress: activeIdx !== null ? uprightHoldProgress[activeIdx] : 0,
        completedCount,
        totalCount: 2,
        subActionLabel: 'Hold: Fasten Upright',
        justCompletedSubTarget: justCompleted,
      };
    }

    // Step 3: 3 Horizontal Cross Slats
    if (session.step === 3) {
      slatTargets.forEach((t, idx) => {
        pulseBullseye(t.ringMat, t.coreMat, alignedIndex === idx && !session.slatsDone[idx], idx);
      });

      const activeIdx =
        alignedIndex !== null && alignedIndex >= 0 && alignedIndex < 3 && !session.slatsDone[alignedIndex]
          ? alignedIndex
          : null;

      let justCompleted = false;
      if (activeIdx !== null) {
        const sx = SLAT_TARGET_X[activeIdx];
        animWrench.visible = true;
        animWrench.position.set(sx, -PIPE_RADIUS + 0.01, 0.14);
        animWrench.rotation.z = isHolding ? Math.sin(time * 20) * 0.45 : -0.25;

        if (isHolding) {
          rackShavingsGroup.visible = true;
          rackShavingsGroup.position.set(sx, -PIPE_RADIUS, 0.11);
          rackShavingParticles.forEach((p, idx) => {
            const lt = (time * 2.0 + idx * 0.04) % 0.4;
            p.mesh.position.set(p.vx * lt, p.vy * lt * 0.7 - 1.2 * lt * lt, p.vz * lt);
          });
          workshopAudio.playSawStroke();

          slatHoldProgress[activeIdx] = Math.min(1, slatHoldProgress[activeIdx] + dt / 0.6);
          if (slatHoldProgress[activeIdx] >= 1) {
            session.slatsDone[activeIdx] = true;
            justCompleted = true;
            workshopAudio.playSnapComplete();
          }
        }
      }

      const completedCount = session.slatsDone.filter(Boolean).length;
      return {
        stepDone: completedCount === 3,
        subProgress: activeIdx !== null ? slatHoldProgress[activeIdx] : 0,
        completedCount,
        totalCount: 3,
        subActionLabel: 'Hold: Attach Cross Slat',
        justCompletedSubTarget: justCompleted,
      };
    }

    // Step 4: 4 Cordless Drill Drainage Holes + 1 Moisture Liner
    if (session.step === 4) {
      const allDrainsDone = session.drainsDone.every(Boolean);

      if (!allDrainsDone) {
        drillTargets.forEach((t, idx) => {
          pulseBullseye(t.ringMat, t.coreMat, alignedIndex === idx && !session.drainsDone[idx], idx);
        });

        const activeIdx =
          alignedIndex !== null && alignedIndex >= 0 && alignedIndex < 4 && !session.drainsDone[alignedIndex]
            ? alignedIndex
            : null;

        let justCompleted = false;
        if (activeIdx !== null) {
          const px = PORT_X_OFFSETS[activeIdx];
          animRackDrill.visible = true;
          const plunge = isHolding ? 0.015 + drillHoldProgress[activeIdx] * 0.04 : 0;
          animRackDrill.position.set(px, -PIPE_RADIUS + 0.075 - plunge, 0.06);

          if (isHolding) {
            rdBit.rotation.y += dt * 34;
            rackShavingsGroup.visible = true;
            rackShavingsGroup.position.set(px, -PIPE_RADIUS + 0.01, 0.04);
            rackShavingParticles.forEach((p, idx) => {
              const lt = (time * 2.2 + idx * 0.05) % 0.45;
              p.mesh.position.set(p.vx * lt, p.vy * lt * 0.7 - 1.2 * lt * lt, p.vz * lt);
            });
            workshopAudio.playDrillPulse();

            drillHoldProgress[activeIdx] = Math.min(1, drillHoldProgress[activeIdx] + dt / 0.68);
            if (drillHoldProgress[activeIdx] >= 1) {
              session.drainsDone[activeIdx] = true;
              justCompleted = true;
              workshopAudio.playSnapComplete();
            }
          }
        }

        const drilledCount = session.drainsDone.filter(Boolean).length;
        return {
          stepDone: false,
          subProgress: activeIdx !== null ? drillHoldProgress[activeIdx] : 0,
          completedCount: drilledCount,
          totalCount: 4,
          subActionLabel: 'Hold: Drill Drain Hole',
          justCompletedSubTarget: justCompleted,
        };
      }

      // Step 4b: Fit Moisture Liner
      pulseBullseye(linerTarget.ringMat, linerTarget.coreMat, alignedIndex === 0 && !session.linerDone, 0);
      const isAlignedLiner = alignedIndex === 0 && !session.linerDone;
      let justCompleted = false;

      if (isAlignedLiner) {
        animLinerRoll.visible = true;
        animLinerRoll.position.set(-0.55 + linerHoldProgress * 1.1, -PIPE_RADIUS + 0.04, 0);
        animLinerRoll.rotation.z = -linerHoldProgress * 6;

        if (isHolding) {
          workshopAudio.playPlanting();
          linerHoldProgress = Math.min(1, linerHoldProgress + dt / 0.62);
          if (linerHoldProgress >= 1) {
            session.linerDone = true;
            justCompleted = true;
            workshopAudio.playSnapComplete();
          }
        }
      }

      return {
        stepDone: session.linerDone,
        subProgress: isAlignedLiner ? linerHoldProgress : 0,
        completedCount: session.linerDone ? 1 : 0,
        totalCount: 1,
        subActionLabel: 'Hold: Fit Moisture Liner',
        justCompletedSubTarget: justCompleted,
      };
    }

    return {
      stepDone: false,
      subProgress: 0,
      completedCount: 0,
      totalCount: 0,
      subActionLabel: 'Build Rack',
    };
  };

  const update = (dt: number, time: number, nowMs: number) => {
    const pulseScale = 1 + Math.sin(time * 3.8) * 0.03;
    rackBeacon.scale.set(pulseScale, pulseScale, 1);

    if (step5Halo.visible) {
      step5HaloMat.opacity = 0.48 + Math.sin(time * 5.2) * 0.28;
    }
    if (swatchCaddy.visible) {
      swatchBlock.rotation.y = time * 0.7;
    }

    const forecast = WEATHER_FORECASTS[activeWeatherMode] ?? WEATHER_FORECASTS.normal;
    const windSpeed = forecast.windSpeedMult * 3.2;
    anemometerGroup.rotation.y = time * windSpeed;

    weatherFx.update(dt, time, activeWeatherMode, activeWindbreak, activeStormBrace);

    const swayDamp =
      (activeWindbreak ? 0.38 : 1.0) * (activeStormBrace ? 0.72 : 1.0);
    const leafSwayAmp = Math.min(0.14, 0.025 + forecast.windSpeedMult * 0.038 * swayDamp);
    const leafSwayFreq = 1.4 + forecast.windSpeedMult * 1.9;

    tierVisuals.forEach((tv, idx) => {
      const live = computeTierLiveMetrics(
        tv.tier,
        nowMs,
        activeWeatherMode,
        activeShadeCloth,
        activeWindbreak,
        activeStormBrace
      );

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
          sp.rotation.z = Math.sin(time * leafSwayFreq + sidx + idx) * leafSwayAmp;
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

  const setDoorOpenFactors = (kitchenOpen: number, compostOpen: number) => {
    kitchenDoorPivot.rotation.y = THREE.MathUtils.clamp(kitchenOpen, 0, 1) * 1.25;
    compostDoorPivot.rotation.y = THREE.MathUtils.clamp(compostOpen, 0, 1) * 1.25;
  };

  return {
    group,
    colliders,
    rackAnchor: new THREE.Vector3(0, 0, -0.85),
    jojoAnchor: new THREE.Vector3(2.25, 0, -1.75),
    weatherAnchor: new THREE.Vector3(-2.25, 0, -1.75),
    kitchenDoorAnchor: new THREE.Vector3(-1.45, 0, 4.15),
    compostDoorAnchor: new THREE.Vector3(1.45, 0, 4.15),
    setDoorOpenFactors,
    setGardenState,
    getRackRaycastTargets,
    stepRackManualTool,
    resetRackBuildToolProgress,
    update,
    dispose,
  };
}
