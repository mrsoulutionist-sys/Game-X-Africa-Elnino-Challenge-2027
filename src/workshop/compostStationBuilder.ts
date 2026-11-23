import * as THREE from 'three';
import { workshopAudio } from './audio';
import type {
  CompostContainerType,
  Door3ProgressState,
  DripBottleType,
  MulchMaterialType,
} from './compostData';
import type { AABB } from './kitchenRoomBuilder';
import type { WorkshopMaterials } from './materials';
import { buildCompostSignage } from './sponsorSignage';

export type CompostAnchorTarget =
  | 'drip_bench'
  | 'compost_bay'
  | 'mulch_bench'
  | 'garden_door'
  | 'kitchen_door';

export type CompostTimedAnimKind =
  | 'none'
  | 'ws1_bottle_select'
  | 'ws1_bury'
  | 'ws1_pour_cap'
  | 'ws2_container'
  | 'ws2_gather'
  | 'ws2_twigs'
  | 'ws2_greens'
  | 'ws2_browns'
  | 'ws2_mist'
  | 'ws3_sheet_select'
  | 'ws3_place_collar'
  | 'ws3_scatter_leaves';

export interface Door3ManualStepResult {
  stepDone: boolean;
  subProgress: number;
  completedCount: number;
  totalCount: number;
}

export interface CompostStationHandle {
  group: THREE.Group;
  colliders: AABB[];
  anchors: Record<CompostAnchorTarget, THREE.Vector3>;
  interactableObjects: THREE.Object3D[];
  getRaycastTargets: (progress: Door3ProgressState) => THREE.Object3D[];
  stepManualTool: (
    progress: Door3ProgressState,
    dt: number,
    time: number,
    alignedIndex: number | null,
    isHolding: boolean
  ) => Door3ManualStepResult;
  startActionAnim: (kind: CompostTimedAnimKind) => void;
  setDoorOpenFactors: (gardenOpen: number, kitchenOpen: number) => void;
  setProgress: (progress: Door3ProgressState) => void;
  update: (dt: number, time: number) => void;
  dispose: () => void;
}

function createStationSignTexture(
  title: string,
  subtitle: string,
  accentHex = '#34d399'
): THREE.CanvasTexture {
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
  ctx.font = 'bold 22px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(subtitle, 256, 54);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.fillText(title, 256, 112);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPetBottleMesh(
  bodyMat: THREE.Material,
  capMat: THREE.Material,
  waterMat?: THREE.Material
): { group: THREE.Group; waterFill?: THREE.Mesh; cap?: THREE.Mesh } {
  const g = new THREE.Group();
  const baseBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.052, 0.21, 16), bodyMat);
  baseBarrel.position.y = 0.105;
  baseBarrel.castShadow = true;
  g.add(baseBarrel);

  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.054, 0.065, 16), bodyMat);
  shoulder.position.y = 0.242;
  g.add(shoulder);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.028, 12), bodyMat);
  neck.position.y = 0.285;
  g.add(neck);

  const rib = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.004, 6, 18), bodyMat);
  rib.rotation.x = Math.PI * 0.5;
  rib.position.y = 0.13;
  g.add(rib);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.024, 12), capMat);
  cap.position.y = 0.308;
  g.add(cap);

  let waterFill: THREE.Mesh | undefined;
  if (waterMat) {
    waterFill = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.046, 0.18, 14), waterMat);
    waterFill.position.y = 0.095;
    g.add(waterFill);
  }

  return { group: g, waterFill, cap };
}

export function buildCompostStation(
  mats: WorkshopMaterials,
  maxAnisotropy = 4
): CompostStationHandle {
  const group = new THREE.Group();
  const colliders: AABB[] = [];
  const interactableObjects: THREE.Object3D[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const signage = buildCompostSignage(maxAnisotropy, mats);
  group.add(signage.group);
  disposables.push({ dispose: signage.dispose });

  // Materials (zero expensive transmission pass, fast everywhere)
  const paverMat = new THREE.MeshStandardMaterial({ color: 0xa99e8e, roughness: 0.88, metalness: 0.02 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4b7a42, roughness: 0.92 });
  const fenceWoodMat = new THREE.MeshStandardMaterial({ color: 0x7c5838, roughness: 0.78 });
  const soilBedMat = new THREE.MeshStandardMaterial({ color: 0x4a3321, roughness: 0.95 });
  const soilMoistMat = new THREE.MeshStandardMaterial({
    color: 0x26180d,
    emissive: 0x0c4a6e,
    emissiveIntensity: 0.25,
    roughness: 0.65,
  });
  const rootMat = new THREE.MeshStandardMaterial({ color: 0xe6d3a7, roughness: 0.75 });
  const petClearMat = new THREE.MeshPhysicalMaterial({
    color: 0xcbeafe,
    roughness: 0.14,
    metalness: 0.02,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const petGreenMat = new THREE.MeshPhysicalMaterial({
    color: 0x34d399,
    roughness: 0.16,
    metalness: 0.02,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const petBlueWaterBottleMat = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    roughness: 0.12,
    metalness: 0.02,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const cardboardMat = new THREE.MeshStandardMaterial({ color: 0xc49562, roughness: 0.85 });
  const newspaperMat = new THREE.MeshStandardMaterial({ color: 0xd6d3cb, roughness: 0.88 });
  const dryLeafMat = new THREE.MeshStandardMaterial({ color: 0xb4692c, roughness: 0.9 });
  const compostGreensMat = new THREE.MeshStandardMaterial({ color: 0x358f48, roughness: 0.84 });
  const compostBrownsMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  const bucketBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5 });
  const ghostMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    wireframe: true,
    transparent: true,
    opacity: 0.48,
  });
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  const evapWispMat = new THREE.MeshBasicMaterial({
    color: 0xfb923c,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const moistureHaloMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  const awlWoodMat = new THREE.MeshStandardMaterial({ color: 0x9a4d22, roughness: 0.55 });
  const trowelBladeMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.28, metalness: 0.84 });

  disposables.push(
    paverMat,
    grassMat,
    fenceWoodMat,
    soilBedMat,
    soilMoistMat,
    rootMat,
    petClearMat,
    petGreenMat,
    petBlueWaterBottleMat,
    cardboardMat,
    newspaperMat,
    dryLeafMat,
    compostGreensMat,
    compostBrownsMat,
    bucketBlueMat,
    crateMat,
    ghostMat,
    hitboxMat,
    evapWispMat,
    moistureHaloMat,
    awlWoodMat,
    trowelBladeMat
  );

  const getBottleMat = (type: DripBottleType | null) =>
    type === 'green_sparkling'
      ? petGreenMat
      : type === 'clear_water'
        ? petBlueWaterBottleMat
        : petClearMat;

  // ============================================================================
  // 1. Courtyard Ground, Fencing & Return Door 2 Gate
  // ============================================================================
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), grassMat);
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  group.add(ground);

  const patio = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.04, 9.6), paverMat);
  patio.position.set(0, 0.01, -0.2);
  patio.receiveShadow = true;
  group.add(patio);

  const addFence = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fenceWoodMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  addFence(9.8, 1.85, 0.14, 0, 0.925, -4.95);
  addFence(0.14, 1.85, 9.8, -4.85, 0.925, -0.1);
  addFence(0.14, 1.85, 9.8, 4.85, 0.925, -0.1);
  addFence(9.8, 3.0, 0.2, 0, 1.5, 4.45);

  const buildCompostSouthDoor = (
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

    const signTex = createStationSignTexture(title, sub, accentHex);
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

  // West South Door -> Door 2: Garden Yard (-1.45)
  const gardenDoorPivot = buildCompostSouthDoor(
    -1.45,
    'DOOR 2 · GARDEN',
    'WALK BACK OUT →',
    '#34d399',
    0x34d399,
    mats.pvcAcrylicWindowMat
  );

  // East South Door -> Door 1: Kitchen Lab (+1.45) completing the Round Loop!
  const kitchenDoorPivot = buildCompostSouthDoor(
    1.45,
    'DOOR 1 · KITCHEN',
    'COMPLETE LOOP →',
    '#38bdf8',
    0x38bdf8,
    mats.pvcAcrylicWindowMat
  );

  // ============================================================================
  // 2. WORKSTATION 1 — 2L Bottle Drip-Feeder (West: x = -2.25, z = -1.15)
  // ============================================================================
  const ws1Group = new THREE.Group();
  ws1Group.position.set(-2.25, 0.03, -1.15);
  group.add(ws1Group);
  colliders.push({ minX: -3.05, maxX: -1.45, minZ: -1.75, maxZ: -0.55 });

  const ws1Table = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.78, 0.98), mats.butcherBlockMat);
  ws1Table.position.y = 0.39;
  ws1Table.castShadow = true;
  ws1Table.receiveShadow = true;
  ws1Group.add(ws1Table);

  // Recycling Shelf with 3 clickable 2L PET bottles
  const shelfBack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.54, 0.04), fenceWoodMat);
  shelfBack.position.set(-0.4, 1.05, -0.36);
  ws1Group.add(shelfBack);
  const shelfLedge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.24), mats.butcherBlockMat);
  shelfLedge.position.set(-0.4, 0.96, -0.24);
  ws1Group.add(shelfLedge);

  const shelfBottleSpecs: Array<{ id: DripBottleType; x: number; mat: THREE.Material }> = [
    { id: 'clear_soda', x: -0.58, mat: petClearMat },
    { id: 'green_sparkling', x: -0.4, mat: petGreenMat },
    { id: 'clear_water', x: -0.22, mat: petBlueWaterBottleMat },
  ];
  const shelfBottleRings: THREE.Mesh[] = [];
  const shelfBottleMeshes: THREE.Group[] = [];

  shelfBottleSpecs.forEach((spec) => {
    const built = createPetBottleMesh(spec.mat, mats.brassMat);
    built.group.position.set(spec.x, 0.975, -0.24);
    ws1Group.add(built.group);
    shelfBottleMeshes.push(built.group);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    disposables.push(ringMat);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.08, 20), ringMat);
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.set(spec.x, 0.98, -0.24);
    ws1Group.add(ring);
    shelfBottleRings.push(ring);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.16), hitboxMat);
    hit.position.set(spec.x, 1.14, -0.24);
    hit.userData.compostAction = 'select_bottle';
    hit.userData.bottleId = spec.id;
    ws1Group.add(hit);
    interactableObjects.push(hit);
  });

  // Cutaway Planter Bed (right side of bench) + Soil & Underground Roots
  const bedW = 0.78;
  const bedH = 0.28;
  const bedD = 0.56;
  const bedCenterX = 0.34;
  const bedBaseY = 0.78;
  const bedZ = 0.05;

  // Back, left, right wood walls + front cutaway acrylic pane so roots & buried bottle are visible!
  const bedBack = new THREE.Mesh(new THREE.BoxGeometry(bedW, bedH, 0.03), fenceWoodMat);
  bedBack.position.set(bedCenterX, bedBaseY + bedH * 0.5, bedZ - bedD * 0.5);
  ws1Group.add(bedBack);
  const bedLeft = new THREE.Mesh(new THREE.BoxGeometry(0.03, bedH, bedD), fenceWoodMat);
  bedLeft.position.set(bedCenterX - bedW * 0.5, bedBaseY + bedH * 0.5, bedZ);
  ws1Group.add(bedLeft);
  const bedRight = new THREE.Mesh(new THREE.BoxGeometry(0.03, bedH, bedD), fenceWoodMat);
  bedRight.position.set(bedCenterX + bedW * 0.5, bedBaseY + bedH * 0.5, bedZ);
  ws1Group.add(bedRight);
  const bedGlassFront = new THREE.Mesh(
    new THREE.BoxGeometry(bedW - 0.04, bedH, 0.016),
    mats.pvcAcrylicWindowMat
  );
  bedGlassFront.position.set(bedCenterX, bedBaseY + bedH * 0.5, bedZ + bedD * 0.5);
  ws1Group.add(bedGlassFront);

  const ws1Soil = new THREE.Mesh(new THREE.BoxGeometry(bedW - 0.06, bedH - 0.04, bedD - 0.05), soilBedMat);
  ws1Soil.position.set(bedCenterX, bedBaseY + (bedH - 0.04) * 0.5, bedZ);
  ws1Group.add(ws1Soil);

  // Underground root plume halo (lights up when drip is active!)
  const undergroundMoistureHalo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), moistureHaloMat);
  undergroundMoistureHalo.scale.set(1.3, 0.72, 0.9);
  undergroundMoistureHalo.position.set(0.35, 0.91, 0.07);
  undergroundMoistureHalo.visible = false;
  ws1Group.add(undergroundMoistureHalo);

  // Young tomato/spinach plant + visible roots inside cutaway soil bed
  const ws1PlantGroup = new THREE.Group();
  ws1PlantGroup.position.set(0.5, 1.03, 0.06);
  ws1Group.add(ws1PlantGroup);

  const ws1Stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.017, 0.3, 8), mats.stemMat);
  ws1Stem.position.y = 0.15;
  ws1PlantGroup.add(ws1Stem);
  for (let l = 0; l < 6; l++) {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.058, 9, 6), l % 2 === 0 ? mats.leafMat : mats.leafLightMat);
    lf.scale.set(1.25, 0.24, 0.85);
    const ang = (l * Math.PI * 2) / 6;
    lf.position.set(Math.cos(ang) * 0.06, 0.18 + (l % 2) * 0.07, Math.sin(ang) * 0.06);
    lf.rotation.y = ang;
    ws1PlantGroup.add(lf);
  }
  // Visible roots extending down toward the buried bottle
  [
    [-0.03, -0.08, 0.04, 0.45],
    [-0.07, -0.1, 0.09, 0.85],
    [0.02, -0.11, 0.06, -0.25],
    [-0.05, -0.14, 0.14, 0.6],
  ].forEach(([rx, ry, rz, rotZ]) => {
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.16, 6), rootMat);
    root.position.set(rx, ry, rz);
    root.rotation.z = rotZ;
    ws1PlantGroup.add(root);
  });

  // Mini "Surface Pour" Control Cup on far-left corner showing wasted heat evaporation wisps
  const controlCup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.12, 14), fenceWoodMat);
  controlCup.position.set(-0.66, 0.84, 0.26);
  ws1Group.add(controlCup);
  const controlWaterTop = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.015, 14), mats.waterMat);
  controlWaterTop.position.set(-0.66, 0.895, 0.26);
  ws1Group.add(controlWaterTop);
  const evapWisps: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), evapWispMat);
    wisp.scale.set(0.8, 1.5, 0.8);
    wisp.position.set(-0.66 + (i - 1.5) * 0.028, 0.94, 0.26);
    ws1Group.add(wisp);
    evapWisps.push(wisp);
  }

  // Active 2L Drip Bottle (on craft cradle when poking, then buries into soil bed beside roots!)
  const dripBottleBuilt = createPetBottleMesh(petClearMat, mats.brassMat, mats.waterMat);
  const dripBottleGroup = dripBottleBuilt.group;
  const dripWaterInner = dripBottleBuilt.waterFill!;
  const dripCap = dripBottleBuilt.cap!;
  dripBottleGroup.position.set(-0.34, 0.8, 0.16);
  ws1Group.add(dripBottleGroup);

  // 3 Poke-Hole Bullseyes on the bottle + revealed pinhole dots
  const pokeOffsets = [
    new THREE.Vector3(-0.036, 0.068, 0.044), // lower-third front-left
    new THREE.Vector3(0.036, 0.082, 0.044),  // lower-third front-right
    new THREE.Vector3(0, 0.325, 0.0),        // cap top pinhole
  ];
  const pokeBullseyeGroups: THREE.Group[] = [];
  const pokeBullseyeMats: THREE.MeshBasicMaterial[] = [];
  const pokeHitMeshes: THREE.Mesh[] = [];
  const pokeDoneDots: THREE.Mesh[] = [];
  const pokeDone = [false, false, false];
  const pokeProgress = [0, 0, 0];

  pokeOffsets.forEach((off, idx) => {
    const pg = new THREE.Group();
    pg.position.copy(off);
    if (idx < 2) {
      // Face +Z toward the player
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      });
      disposables.push(ringMat);
      pokeBullseyeMats.push(ringMat);

      const ring = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.026, 20), ringMat);
      pg.add(ring);
      const center = new THREE.Mesh(new THREE.CircleGeometry(0.007, 12), ringMat);
      center.position.z = 0.001;
      pg.add(center);
    } else {
      // Cap top facing +Y
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      });
      disposables.push(ringMat);
      pokeBullseyeMats.push(ringMat);

      const ring = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.026, 20), ringMat);
      ring.rotation.x = -Math.PI * 0.5;
      pg.add(ring);
      const center = new THREE.Mesh(new THREE.CircleGeometry(0.007, 12), ringMat);
      center.rotation.x = -Math.PI * 0.5;
      center.position.y = 0.001;
      pg.add(center);
    }

    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), hitboxMat);
    hit.userData.targetKind = 'door3_poke';
    hit.userData.targetIndex = idx;
    hit.userData.compostAction = 'poke_bottle';
    pg.add(hit);
    pokeHitMeshes.push(hit);
    interactableObjects.push(hit);

    dripBottleGroup.add(pg);
    pokeBullseyeGroups.push(pg);

    // Pinhole marker mesh revealed when poked
    const hole = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), mats.darkMetalMat);
    hole.position.copy(off);
    hole.visible = false;
    dripBottleGroup.add(hole);
    pokeDoneDots.push(hole);
  });

  // Animated 3D Craft Awl / Nail for Step 2
  const animAwl = new THREE.Group();
  animAwl.visible = false;
  const awlHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.09, 12), awlWoodMat);
  awlHandle.position.y = 0.085;
  animAwl.add(awlHandle);
  const awlCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.014, 12), mats.brassMat);
  awlCollar.position.y = 0.036;
  animAwl.add(awlCollar);
  const awlNeedle = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.048, 8), mats.chromeMat);
  awlNeedle.rotation.x = Math.PI;
  awlNeedle.position.y = 0.01;
  animAwl.add(awlNeedle);
  ws1Group.add(animAwl);

  // Animated 3D Hand Trowel + Flying Soil Clods for Step 3 (Bury)
  const animTrowel = new THREE.Group();
  animTrowel.visible = false;
  const trowelBlade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.006, 0.11), trowelBladeMat);
  trowelBlade.rotation.x = 0.35;
  animTrowel.add(trowelBlade);
  const trowelShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), mats.darkMetalMat);
  trowelShaft.position.set(0, 0.03, 0.06);
  trowelShaft.rotation.x = 0.85;
  animTrowel.add(trowelShaft);
  const trowelHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.013, 0.1, 10), awlWoodMat);
  trowelHandle.position.set(0, 0.06, 0.11);
  trowelHandle.rotation.x = 1.0;
  animTrowel.add(trowelHandle);
  ws1Group.add(animTrowel);

  const soilClodsGroup = new THREE.Group();
  soilClodsGroup.visible = false;
  ws1Group.add(soilClodsGroup);
  const soilClods: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number }> = [];
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.012, 0), soilBedMat);
    soilClodsGroup.add(c);
    soilClods.push({
      mesh: c,
      vx: ((i % 4) - 1.5) * 0.22,
      vy: 0.45 + (i % 3) * 0.18,
      vz: (((i * 3) % 4) - 1.5) * 0.2,
    });
  }

  // Animated 3D Pitcher + Pour Stream + Underground Root Drip Droplets for Step 4
  const animWs1Pitcher = new THREE.Group();
  animWs1Pitcher.visible = false;
  const pCup = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.16, 16), mats.pvcAcrylicWindowMat);
  animWs1Pitcher.add(pCup);
  const pWater = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.048, 0.11, 14), mats.waterMat);
  pWater.position.y = -0.018;
  animWs1Pitcher.add(pWater);
  ws1Group.add(animWs1Pitcher);

  const ws1PourStream = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.28, 10), mats.waterStreamMat);
  ws1PourStream.position.set(0.2, 1.32, 0.06);
  ws1PourStream.visible = false;
  ws1Group.add(ws1PourStream);

  // Underground drip droplets seeping from buried bottle holes toward the plant roots
  const dripDroplets: THREE.Mesh[] = [];
  for (let d = 0; d < 6; d++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), mats.waterStreamMat);
    drop.visible = false;
    ws1Group.add(drop);
    dripDroplets.push(drop);
  }

  // Bury target halo in soil bed
  const buryHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.065, 0.095, 22),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  buryHalo.rotation.x = -Math.PI * 0.5;
  buryHalo.position.set(0.2, 1.032, 0.06);
  buryHalo.visible = false;
  ws1Group.add(buryHalo);
  disposables.push(buryHalo.material as THREE.Material);

  const ws1BedHit = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.45, 0.64), hitboxMat);
  ws1BedHit.position.set(0.32, 1.0, 0.06);
  ws1BedHit.userData.compostAction = 'ws1_bed';
  ws1Group.add(ws1BedHit);
  interactableObjects.push(ws1BedHit);

  const ws1SignTex = createStationSignTexture('1 · 2L DRIP-FEEDER', 'WORKSTATION 1', '#38bdf8');
  disposables.push(ws1SignTex);
  const ws1SignMat = new THREE.MeshBasicMaterial({ map: ws1SignTex });
  disposables.push(ws1SignMat);
  const ws1Sign = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.36), ws1SignMat);
  ws1Sign.position.set(0, 1.66, -0.34);
  ws1Group.add(ws1Sign);

  const ws1Beacon = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 0.98, 32),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.68, side: THREE.DoubleSide })
  );
  ws1Beacon.rotation.x = -Math.PI * 0.5;
  ws1Beacon.position.set(0, 0.02, 0.06);
  ws1Group.add(ws1Beacon);
  disposables.push(ws1Beacon.material as THREE.Material);

  // ============================================================================
  // 3. WORKSTATION 2 — Bucket / Crate / Pallet Composter (Center: x = 0, z = -1.9)
  // ============================================================================
  const ws2Group = new THREE.Group();
  ws2Group.position.set(0, 0.03, -1.9);
  group.add(ws2Group);
  colliders.push({ minX: -0.95, maxX: 0.95, minZ: -2.6, maxZ: -1.2 });

  const ws2Pad = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 1.32), fenceWoodMat);
  ws2Pad.position.y = 0.03;
  ws2Pad.receiveShadow = true;
  ws2Group.add(ws2Pad);

  const ws2Ghost = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.68, 0.75), ghostMat);
  ws2Ghost.position.set(0, 0.4, -0.05);
  ws2Group.add(ws2Ghost);

  // 3 Mini Clickable Container Picks on Left Plinth
  const containerPickBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.34), mats.butcherBlockMat);
  containerPickBase.position.set(-1.12, 0.06, 0.24);
  ws2Group.add(containerPickBase);

  const pickSpecs: Array<{ id: CompostContainerType; x: number; color: number }> = [
    { id: 'bucket', x: -1.4, color: 0x1d4ed8 },
    { id: 'crate', x: -1.12, color: 0x0f766e },
    { id: 'pallet', x: -0.84, color: 0x9a6539 },
  ];
  const pickMiniRings: THREE.Mesh[] = [];
  pickSpecs.forEach((ps) => {
    const pMat = new THREE.MeshStandardMaterial({ color: ps.color, roughness: 0.5 });
    disposables.push(pMat);
    const geom =
      ps.id === 'bucket'
        ? new THREE.CylinderGeometry(0.08, 0.065, 0.18, 14)
        : new THREE.BoxGeometry(0.16, 0.15, 0.16);
    const mesh = new THREE.Mesh(geom, pMat);
    mesh.position.set(ps.x, 0.21, 0.24);
    mesh.castShadow = true;
    ws2Group.add(mesh);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    disposables.push(ringMat);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.095, 0.118, 18), ringMat);
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.set(ps.x, 0.125, 0.24);
    ws2Group.add(ring);
    pickMiniRings.push(ring);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), hitboxMat);
    hit.position.set(ps.x, 0.22, 0.24);
    hit.userData.compostAction = 'select_container';
    hit.userData.containerId = ps.id;
    ws2Group.add(hit);
    interactableObjects.push(hit);
  });

  // Full-scale Active Composter Container Group (drops & animates into center pad)
  const activeContainerGroup = new THREE.Group();
  activeContainerGroup.position.set(0, 0, -0.05);
  ws2Group.add(activeContainerGroup);

  const bucketModel = new THREE.Group();
  const bucketMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.22, 0.62, 22, 1, true),
    bucketBlueMat
  );
  bucketMesh.position.y = 0.37;
  bucketMesh.castShadow = true;
  bucketModel.add(bucketMesh);
  const bucketBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), bucketBlueMat);
  bucketBottom.position.y = 0.07;
  bucketModel.add(bucketBottom);
  const bucketRim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 8, 22), mats.darkMetalMat);
  bucketRim.rotation.x = Math.PI * 0.5;
  bucketRim.position.y = 0.68;
  bucketModel.add(bucketRim);
  // Visible drilled aeration holes around bucket side
  for (let h = 0; h < 6; h++) {
    const ang = (h / 6) * Math.PI * 2;
    const hMesh = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), mats.darkMetalMat);
    hMesh.position.set(Math.sin(ang) * 0.26, 0.38, Math.cos(ang) * 0.26);
    hMesh.rotation.y = ang;
    bucketModel.add(hMesh);
  }
  activeContainerGroup.add(bucketModel);

  const crateModel = new THREE.Group();
  const crateBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.54), crateMat);
  crateBase.position.y = 0.08;
  crateModel.add(crateBase);
  [-0.25, 0.25].forEach((cz) => {
    [0.18, 0.34, 0.5].forEach((cy) => {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.065, 0.035), crateMat);
      slat.position.set(0, cy, cz);
      crateModel.add(slat);
    });
  });
  [-0.33, 0.33].forEach((cx) => {
    [0.18, 0.34, 0.5].forEach((cy) => {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.065, 0.54), crateMat);
      slat.position.set(cx, cy, 0);
      crateModel.add(slat);
    });
  });
  // Cardboard inner side liner
  [-0.3, 0.3].forEach((cx) => {
    const liner = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.38, 0.46), cardboardMat);
    liner.position.set(cx, 0.31, 0);
    crateModel.add(liner);
  });
  activeContainerGroup.add(crateModel);

  const palletModel = new THREE.Group();
  [-0.46, 0.46].forEach((px) => {
    [0.18, 0.38, 0.58, 0.78].forEach((py) => {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.96), fenceWoodMat);
      plank.position.set(px, py, 0);
      plank.castShadow = true;
      palletModel.add(plank);
    });
  });
  [-0.46, 0.46].forEach((pz) => {
    [0.18, 0.38, 0.58, 0.78].forEach((py) => {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 0.05), fenceWoodMat);
      plank.position.set(0, py, pz);
      plank.castShadow = true;
      palletModel.add(plank);
    });
  });
  activeContainerGroup.add(palletModel);

  // Door 1 Greens Basket & Door 2/Recycling Browns Basket beside Bay
  const greensCrate = new THREE.Group();
  greensCrate.position.set(-0.68, 0.06, 0.46);
  const gBasket = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.28), compostGreensMat);
  gBasket.position.y = 0.09;
  greensCrate.add(gBasket);
  for (let i = 0; i < 5; i++) {
    const scrap = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.042, 0),
      i % 2 === 0 ? mats.leafLightMat : mats.sawGripMat
    );
    scrap.position.set(((i % 3) - 1) * 0.07, 0.2, Math.floor(i / 3) * 0.07 - 0.03);
    greensCrate.add(scrap);
  }
  ws2Group.add(greensCrate);

  const brownsCrate = new THREE.Group();
  brownsCrate.position.set(0.68, 0.06, 0.46);
  const bBasket = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.28), cardboardMat);
  bBasket.position.y = 0.09;
  brownsCrate.add(bBasket);
  for (let i = 0; i < 6; i++) {
    const scrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.02, 0.05),
      i % 2 === 0 ? dryLeafMat : newspaperMat
    );
    scrap.position.set(((i % 3) - 1) * 0.07, 0.2, Math.floor(i / 3) * 0.07 - 0.03);
    scrap.rotation.y = i * 0.7;
    brownsCrate.add(scrap);
  }
  ws2Group.add(brownsCrate);

  const ws2BayHit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.1), hitboxMat);
  ws2BayHit.position.set(0, 0.5, 0.1);
  ws2BayHit.userData.compostAction = 'ws2_bay';
  ws2Group.add(ws2BayHit);
  interactableObjects.push(ws2BayHit);

  // Compost strata layers inside container
  const twigsLayer = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.38), compostBrownsMat);
  twigsLayer.position.set(0, 0.12, -0.05);
  ws2Group.add(twigsLayer);
  const greensLayer = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.38), compostGreensMat);
  greensLayer.position.set(0, 0.23, -0.05);
  ws2Group.add(greensLayer);
  const brownsLayer = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.38), cardboardMat);
  brownsLayer.position.set(0, 0.37, -0.05);
  ws2Group.add(brownsLayer);
  const mistFinishLayer = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.38), soilMoistMat);
  mistFinishLayer.position.set(0, 0.48, -0.05);
  ws2Group.add(mistFinishLayer);

  // Animated Flying Ingredient/Layer Chunks + Spray Mister + Mist Droplets + Warm Steam
  const flyingScrapsGroup = new THREE.Group();
  flyingScrapsGroup.visible = false;
  ws2Group.add(flyingScrapsGroup);
  const flyingScraps: Array<{ mesh: THREE.Mesh; startX: number; startZ: number; delay: number }> = [];
  for (let i = 0; i < 12; i++) {
    const isGreen = i % 2 === 0;
    const scrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.028, 0.045),
      isGreen ? mats.leafLightMat : dryLeafMat
    );
    flyingScrapsGroup.add(scrap);
    flyingScraps.push({
      mesh: scrap,
      startX: isGreen ? -0.68 : 0.68,
      startZ: 0.46,
      delay: (i % 6) * 0.1,
    });
  }

  const animMister = new THREE.Group();
  animMister.visible = false;
  const mistBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 0.16, 12), mats.pvcMat);
  animMister.add(mistBottle);
  const mistHead = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.11), mats.brassMat);
  mistHead.position.set(0, 0.095, -0.02);
  animMister.add(mistHead);
  ws2Group.add(animMister);

  const mistDrops: THREE.Mesh[] = [];
  for (let m = 0; m < 10; m++) {
    const md = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), mats.waterStreamMat);
    md.visible = false;
    ws2Group.add(md);
    mistDrops.push(md);
  }

  const compostSteamWisps: THREE.Mesh[] = [];
  for (let s = 0; s < 4; s++) {
    const sw = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), mats.pvcAcrylicWindowMat);
    sw.visible = false;
    ws2Group.add(sw);
    compostSteamWisps.push(sw);
  }

  const ws2SignTex = createStationSignTexture('2 · COMPOST BAY', 'WORKSTATION 2', '#34d399');
  disposables.push(ws2SignTex);
  const ws2SignMat = new THREE.MeshBasicMaterial({ map: ws2SignTex });
  disposables.push(ws2SignMat);
  const ws2Sign = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.36), ws2SignMat);
  ws2Sign.position.set(0, 1.32, -0.58);
  ws2Group.add(ws2Sign);

  const ws2Beacon = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.04, 32),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
  );
  ws2Beacon.rotation.x = -Math.PI * 0.5;
  ws2Beacon.position.set(0, 0.02, 0.05);
  ws2Group.add(ws2Beacon);
  disposables.push(ws2Beacon.material as THREE.Material);

  // ============================================================================
  // 4. WORKSTATION 3 — Cardboard Mulch & Moisture Shield (East: x = 2.25, z = -1.15)
  // ============================================================================
  const ws3Group = new THREE.Group();
  ws3Group.position.set(2.25, 0.03, -1.15);
  group.add(ws3Group);
  colliders.push({ minX: 1.45, maxX: 3.05, minZ: -1.75, maxZ: -0.55 });

  const ws3Table = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.78, 0.98), mats.butcherBlockMat);
  ws3Table.position.y = 0.39;
  ws3Table.castShadow = true;
  ws3Table.receiveShadow = true;
  ws3Group.add(ws3Table);

  // Clickable Stacks: Cardboard vs. Newspaper on Back-Left
  const cardStack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.36), cardboardMat);
  cardStack.position.set(-0.52, 0.805, -0.2);
  ws3Group.add(cardStack);
  const cardStackHit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.4), hitboxMat);
  cardStackHit.position.set(-0.52, 0.84, -0.2);
  cardStackHit.userData.compostAction = 'select_mulch';
  cardStackHit.userData.mulchId = 'cardboard' as MulchMaterialType;
  ws3Group.add(cardStackHit);
  interactableObjects.push(cardStackHit);

  const paperStack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.34), newspaperMat);
  paperStack.position.set(-0.14, 0.8, -0.2);
  paperStack.rotation.y = 0.08;
  ws3Group.add(paperStack);
  const paperStackHit = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.38), hitboxMat);
  paperStackHit.position.set(-0.14, 0.84, -0.2);
  paperStackHit.userData.compostAction = 'select_mulch';
  paperStackHit.userData.mulchId = 'newspaper' as MulchMaterialType;
  ws3Group.add(paperStackHit);
  interactableObjects.push(paperStackHit);

  // Cutting Mat on Front-Left (`x = -0.34, z = 0.18`)
  const cutSheetGroup = new THREE.Group();
  cutSheetGroup.position.set(-0.34, 0.79, 0.18);
  ws3Group.add(cutSheetGroup);

  const cutSheetRect = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.34), cardboardMat);
  cutSheetGroup.add(cutSheetRect);

  // Glowing Amber Collar & Center Slit Target Marks (2 manual steps: Ring + Slit!)
  const collarCutTargets: THREE.Group[] = [];
  const collarCutMats: THREE.MeshBasicMaterial[] = [];
  const collarCutHits: THREE.Mesh[] = [];
  const cutSubDone = [false, false];
  const cutSubProgress = [0, 0];

  const ringTargetG = new THREE.Group();
  ringTargetG.position.set(0, 0.012, 0);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });
  disposables.push(ringMat);
  collarCutMats.push(ringMat);
  const collarGuideRing = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.135, 28), ringMat);
  collarGuideRing.rotation.x = -Math.PI * 0.5;
  ringTargetG.add(collarGuideRing);
  const ringHit = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), hitboxMat);
  ringHit.userData.targetKind = 'door3_cut';
  ringHit.userData.targetIndex = 0;
  ringHit.userData.compostAction = 'cut_collar';
  ringTargetG.add(ringHit);
  collarCutHits.push(ringHit);
  interactableObjects.push(ringHit);
  cutSheetGroup.add(ringTargetG);
  collarCutTargets.push(ringTargetG);

  const slitTargetG = new THREE.Group();
  slitTargetG.position.set(0.06, 0.015, 0);
  const slitMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });
  disposables.push(slitMat);
  collarCutMats.push(slitMat);
  const slitBar = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.022), slitMat);
  slitBar.rotation.x = -Math.PI * 0.5;
  slitTargetG.add(slitBar);
  const slitHit = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), hitboxMat);
  slitHit.userData.targetKind = 'door3_cut';
  slitHit.userData.targetIndex = 1;
  slitHit.userData.compostAction = 'cut_collar';
  slitTargetG.add(slitHit);
  collarCutHits.push(slitHit);
  interactableObjects.push(slitHit);
  cutSheetGroup.add(slitTargetG);
  collarCutTargets.push(slitTargetG);

  // Animated 3D Steel Scissors
  const animScissors = new THREE.Group();
  animScissors.visible = false;
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.02), mats.chromeMat);
  bladeA.position.x = -0.05;
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.02), mats.chromeMat);
  bladeB.position.x = -0.05;
  const handleA = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 14), mats.sawGripMat);
  handleA.rotation.x = Math.PI * 0.5;
  handleA.position.set(0.045, 0, 0.022);
  const handleB = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 14), mats.sawGripMat);
  handleB.rotation.x = Math.PI * 0.5;
  handleB.position.set(0.045, 0, -0.022);
  animScissors.add(bladeA, bladeB, handleA, handleB);
  ws3Group.add(animScissors);

  // Right Planter Bed (with Plant Stem, Thriving Canopy & Buried 2L Drip Bottle)
  const ws3BedBox = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.62), fenceWoodMat);
  ws3BedBox.position.set(0.32, 0.89, 0.04);
  ws3Group.add(ws3BedBox);
  const ws3Soil = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.54), soilBedMat);
  ws3Soil.position.set(0.32, 0.91, 0.04);
  ws3Group.add(ws3Soil);

  const ws3PlantGroup = new THREE.Group();
  ws3PlantGroup.position.set(0.38, 1.01, 0.04);
  ws3Group.add(ws3PlantGroup);
  const ws3Stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.3, 8), mats.stemMat);
  ws3Stem.position.y = 0.15;
  ws3PlantGroup.add(ws3Stem);
  for (let l = 0; l < 6; l++) {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), mats.leafLightMat);
    lf.scale.set(1.2, 0.25, 0.85);
    const ang = (l * Math.PI * 2) / 6 + 0.3;
    lf.position.set(Math.cos(ang) * 0.06, 0.19 + (l % 2) * 0.06, Math.sin(ang) * 0.06);
    lf.rotation.y = ang;
    ws3PlantGroup.add(lf);
  }

  // Already-buried 2L Drip Bottle beside stem
  const ws3BottleBuilt = createPetBottleMesh(petGreenMat, mats.brassMat, mats.waterMat);
  ws3BottleBuilt.group.scale.setScalar(0.85);
  ws3BottleBuilt.group.position.set(0.14, 0.9, 0.04);
  ws3Group.add(ws3BottleBuilt.group);

  // Slit Mulch Collar Mesh (travels smoothly from cutting mat to plant stem!)
  const mulchCollarGroup = new THREE.Group();
  const mulchCollarMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.032, 0.21, 26),
    cardboardMat
  );
  mulchCollarMesh.rotation.x = -Math.PI * 0.5;
  mulchCollarGroup.add(mulchCollarMesh);
  // Visible radial cut slit notch line across collar
  const collarSlitLine = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.004, 0.012), mats.darkMetalMat);
  collarSlitLine.position.set(0.12, 0.003, 0);
  mulchCollarGroup.add(collarSlitLine);
  mulchCollarGroup.position.set(-0.34, 0.805, 0.18);
  ws3Group.add(mulchCollarGroup);

  // Dry Leaf Blanket (16 leaves that cascade down from the air onto the collar!)
  const leafBlanketGroup = new THREE.Group();
  const dryLeafMeshes: Array<{ mesh: THREE.Mesh; targetX: number; targetY: number; targetZ: number; delay: number }> = [];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const rad = 0.075 + (i % 3) * 0.052;
    const tx = 0.38 + Math.cos(ang) * rad;
    const ty = 1.028 + (i % 2) * 0.006;
    const tz = 0.04 + Math.sin(ang) * rad;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.011, 0.042), dryLeafMat);
    leaf.position.set(tx, ty, tz);
    leaf.rotation.y = ang * 1.7;
    leafBlanketGroup.add(leaf);
    dryLeafMeshes.push({ mesh: leaf, targetX: tx, targetY: ty, targetZ: tz, delay: i * 0.045 });
  }
  ws3Group.add(leafBlanketGroup);

  const ws3BedHit = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.42, 0.64), hitboxMat);
  ws3BedHit.position.set(0.32, 1.0, 0.04);
  ws3BedHit.userData.compostAction = 'ws3_bed';
  ws3Group.add(ws3BedHit);
  interactableObjects.push(ws3BedHit);

  const ws3SignTex = createStationSignTexture('3 · MULCH SHIELD', 'WORKSTATION 3', '#fbbf24');
  disposables.push(ws3SignTex);
  const ws3SignMat = new THREE.MeshBasicMaterial({ map: ws3SignTex });
  disposables.push(ws3SignMat);
  const ws3Sign = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.36), ws3SignMat);
  ws3Sign.position.set(0, 1.66, -0.34);
  ws3Group.add(ws3Sign);

  const ws3Beacon = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 0.98, 32),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.68, side: THREE.DoubleSide })
  );
  ws3Beacon.rotation.x = -Math.PI * 0.5;
  ws3Beacon.position.set(0, 0.02, 0.06);
  ws3Group.add(ws3Beacon);
  disposables.push(ws3Beacon.material as THREE.Material);

  // ============================================================================
  // Animation Driver State
  // ============================================================================
  let currentProgress: Door3ProgressState = {
    dripBottleType: null,
    dripStep: 0,
    compostContainer: null,
    compostStep: 0,
    compostRejectTested: 0,
    mulchMaterial: null,
    mulchStep: 0,
  };
  let activeAnim: CompostTimedAnimKind = 'none';
  let animElapsed = 0;

  const setProgress = (p: Door3ProgressState) => {
    currentProgress = p;

    // Reset manual sub-progress if reset back below step
    if (p.dripStep < 2) {
      if (p.dripStep === 0) {
        pokeDone[0] = false;
        pokeDone[1] = false;
        pokeDone[2] = false;
        pokeProgress[0] = 0;
        pokeProgress[1] = 0;
        pokeProgress[2] = 0;
      }
    } else {
      pokeDone[0] = true;
      pokeDone[1] = true;
      pokeDone[2] = true;
    }

    if (p.mulchStep < 2) {
      if (p.mulchStep === 0) {
        cutSubDone[0] = false;
        cutSubDone[1] = false;
        cutSubProgress[0] = 0;
        cutSubProgress[1] = 0;
      }
    } else {
      cutSubDone[0] = true;
      cutSubDone[1] = true;
    }

    // WS1 static rest pose (overridden smoothly during active timed animations)
    const activeBottleMat = getBottleMat(p.dripBottleType);
    dripBottleGroup.children.forEach((ch) => {
      if (ch instanceof THREE.Mesh && ch !== dripWaterInner && ch !== dripCap && !pokeDoneDots.includes(ch)) {
        ch.material = activeBottleMat;
      }
    });
    dripBottleGroup.visible = p.dripStep >= 1;
    if (activeAnim !== 'ws1_bottle_select' && activeAnim !== 'ws1_bury') {
      dripBottleGroup.position.set(
        p.dripStep >= 3 ? 0.2 : -0.34,
        p.dripStep >= 3 ? 0.87 : 0.8,
        p.dripStep >= 3 ? 0.06 : 0.16
      );
      dripBottleGroup.rotation.set(0, 0, 0);
    }

    const showPokeTargets = p.dripStep === 1;
    pokeBullseyeGroups.forEach((pg, i) => {
      pg.visible = showPokeTargets && !pokeDone[i];
      pokeDoneDots[i].visible = p.dripStep >= 2 || pokeDone[i];
    });
    buryHalo.visible = p.dripStep === 2 && activeAnim !== 'ws1_bury';

    if (activeAnim !== 'ws1_pour_cap') {
      dripWaterInner.visible = p.dripStep >= 4;
      dripWaterInner.scale.y = p.dripStep >= 4 ? 1 : 0.01;
      dripCap.visible = p.dripStep >= 1;
      dripCap.position.y = p.dripStep >= 4 || p.dripStep <= 2 ? 0.308 : 0.36;
    }
    undergroundMoistureHalo.visible = p.dripStep >= 4;
    ws1Soil.material = p.dripStep >= 4 ? soilMoistMat : soilBedMat;
    ws1PlantGroup.scale.setScalar(p.dripStep >= 4 ? 1.18 : 1.0);

    // WS2 rest pose
    ws2Ghost.visible = !p.compostContainer;
    bucketModel.visible = p.compostContainer === 'bucket';
    crateModel.visible = p.compostContainer === 'crate';
    palletModel.visible = p.compostContainer === 'pallet';
    if (activeAnim !== 'ws2_container') {
      activeContainerGroup.position.y = 0;
    }
    const scaleXZ = p.compostContainer === 'pallet' ? 1.65 : p.compostContainer === 'crate' ? 1.05 : 0.72;
    [twigsLayer, greensLayer, brownsLayer, mistFinishLayer].forEach((m) => {
      m.scale.set(scaleXZ, 1, scaleXZ);
    });
    twigsLayer.visible = p.compostStep >= 3;
    greensLayer.visible = p.compostStep >= 4;
    brownsLayer.visible = p.compostStep >= 5;
    mistFinishLayer.visible = p.compostStep >= 6;
    compostSteamWisps.forEach((sw) => {
      sw.visible = p.compostStep >= 6;
    });

    // WS3 rest pose
    const activeMulchMat = p.mulchMaterial === 'newspaper' ? newspaperMat : cardboardMat;
    cutSheetRect.material = activeMulchMat;
    mulchCollarMesh.material = activeMulchMat;
    cutSheetGroup.visible = p.mulchStep === 1;
    collarCutTargets.forEach((tg, i) => {
      tg.visible = p.mulchStep === 1 && !cutSubDone[i];
    });
    mulchCollarGroup.visible = p.mulchStep >= 2;
    if (activeAnim !== 'ws3_place_collar') {
      mulchCollarGroup.position.set(
        p.mulchStep >= 3 ? 0.38 : -0.34,
        p.mulchStep >= 3 ? 1.016 : 0.805,
        p.mulchStep >= 3 ? 0.04 : 0.18
      );
      mulchCollarGroup.rotation.set(0, 0, 0);
    }
    leafBlanketGroup.visible = p.mulchStep >= 4 || activeAnim === 'ws3_scatter_leaves';
    if (activeAnim !== 'ws3_scatter_leaves') {
      dryLeafMeshes.forEach((l) => {
        l.mesh.position.set(l.targetX, l.targetY, l.targetZ);
      });
    }
    ws3Soil.material = p.mulchStep >= 4 ? soilMoistMat : soilBedMat;
    ws3PlantGroup.scale.setScalar(p.mulchStep >= 4 ? 1.24 : 1.0);
  };

  const getRaycastTargets = (p: Door3ProgressState): THREE.Object3D[] => {
    if (p.dripStep === 1) {
      return pokeHitMeshes.filter((_, i) => !pokeDone[i]);
    }
    if (p.mulchStep === 1) {
      return collarCutHits.filter((_, i) => !cutSubDone[i]);
    }
    return [];
  };

  const stepManualTool = (
    p: Door3ProgressState,
    dt: number,
    time: number,
    alignedIndex: number | null,
    isHolding: boolean
  ): Door3ManualStepResult => {
    // 1) Workstation 1: Poke 3 pinholes with animated craft awl
    if (p.dripStep === 1) {
      pokeBullseyeMats.forEach((mat, i) => {
        if (pokeDone[i]) {
          mat.color.setHex(0x10b981);
          mat.opacity = 0.35;
        } else if (alignedIndex === i) {
          mat.color.setHex(0x34d399);
          mat.opacity = 1.0;
        } else {
          mat.color.setHex(0xfbbf24);
          mat.opacity = 0.72 + Math.sin(time * 4.5 + i) * 0.22;
        }
      });

      const activeIdx = alignedIndex !== null && !pokeDone[alignedIndex] ? alignedIndex : null;
      if (activeIdx !== null && isHolding) {
        const targetLocal = pokeOffsets[activeIdx];
        const basePos = dripBottleGroup.position;
        animAwl.visible = true;
        const plunge = Math.abs(Math.sin(time * 24)) * 0.032;
        if (activeIdx < 2) {
          animAwl.rotation.set(-Math.PI * 0.5, 0, 0);
          animAwl.position.set(
            basePos.x + targetLocal.x,
            basePos.y + targetLocal.y,
            basePos.z + targetLocal.z + 0.045 - plunge
          );
        } else {
          animAwl.rotation.set(0, 0, 0);
          animAwl.position.set(
            basePos.x + targetLocal.x,
            basePos.y + targetLocal.y + 0.045 - plunge,
            basePos.z + targetLocal.z
          );
        }
        workshopAudio.playPinPoke();

        pokeProgress[activeIdx] = Math.min(1, pokeProgress[activeIdx] + dt / 0.52);
        if (pokeProgress[activeIdx] >= 1) {
          pokeDone[activeIdx] = true;
          pokeBullseyeGroups[activeIdx].visible = false;
          pokeDoneDots[activeIdx].visible = true;
          workshopAudio.playSnapComplete();
        }
      } else {
        animAwl.visible = false;
      }

      const completedCount = pokeDone.filter(Boolean).length;
      return {
        stepDone: completedCount === pokeDone.length,
        subProgress: activeIdx !== null ? pokeProgress[activeIdx] : 0,
        completedCount,
        totalCount: pokeDone.length,
      };
    }

    // 2) Workstation 3: Cut plant collar & center slit with animated steel scissors
    if (p.mulchStep === 1) {
      collarCutMats.forEach((mat, i) => {
        if (cutSubDone[i]) {
          mat.color.setHex(0x10b981);
          mat.opacity = 0.35;
        } else if (alignedIndex === i) {
          mat.color.setHex(0x34d399);
          mat.opacity = 1.0;
        } else {
          mat.color.setHex(0xfbbf24);
          mat.opacity = 0.72 + Math.sin(time * 4.5 + i) * 0.22;
        }
      });

      const activeIdx = alignedIndex !== null && !cutSubDone[alignedIndex] ? alignedIndex : null;
      if (activeIdx !== null && isHolding) {
        animScissors.visible = true;
        const snipAng = Math.abs(Math.sin(time * 22)) * 0.32;
        bladeA.rotation.y = snipAng;
        bladeB.rotation.y = -snipAng;
        handleA.rotation.z = snipAng * 0.5;
        handleB.rotation.z = -snipAng * 0.5;

        if (activeIdx === 0) {
          // Orbit around the collar perimeter
          const orbit = cutSubProgress[0] * Math.PI * 2;
          animScissors.position.set(-0.34 + Math.cos(orbit) * 0.13, 0.84, 0.18 + Math.sin(orbit) * 0.13);
          animScissors.rotation.set(0, -orbit + Math.PI * 0.5, 0);
        } else {
          // Slice straight inward along center slit
          const t = cutSubProgress[1];
          animScissors.position.set(-0.22 - t * 0.11, 0.84, 0.18);
          animScissors.rotation.set(0, 0, 0);
        }
        workshopAudio.playSnip();

        cutSubProgress[activeIdx] = Math.min(1, cutSubProgress[activeIdx] + dt / 0.75);
        if (cutSubProgress[activeIdx] >= 1) {
          cutSubDone[activeIdx] = true;
          collarCutTargets[activeIdx].visible = false;
          workshopAudio.playSnapComplete();
        }
      } else {
        animScissors.visible = false;
      }

      const completedCount = cutSubDone.filter(Boolean).length;
      return {
        stepDone: completedCount === cutSubDone.length,
        subProgress: activeIdx !== null ? cutSubProgress[activeIdx] : 0,
        completedCount,
        totalCount: cutSubDone.length,
      };
    }

    animAwl.visible = false;
    animScissors.visible = false;
    return { stepDone: false, subProgress: 0, completedCount: 0, totalCount: 0 };
  };

  const startActionAnim = (kind: CompostTimedAnimKind) => {
    activeAnim = kind;
    animElapsed = 0;

    // Reset transient helpers
    animTrowel.visible = false;
    soilClodsGroup.visible = false;
    animWs1Pitcher.visible = false;
    ws1PourStream.visible = false;
    flyingScrapsGroup.visible = false;
    animMister.visible = false;
    mistDrops.forEach((m) => (m.visible = false));

    if (kind === 'ws1_bottle_select') {
      dripBottleGroup.visible = true;
    } else if (kind === 'ws1_bury') {
      animTrowel.visible = true;
      soilClodsGroup.visible = true;
      buryHalo.visible = false;
    } else if (kind === 'ws1_pour_cap') {
      animWs1Pitcher.visible = true;
      dripWaterInner.visible = true;
    } else if (kind === 'ws2_gather' || kind === 'ws2_twigs' || kind === 'ws2_greens' || kind === 'ws2_browns') {
      flyingScrapsGroup.visible = true;
    } else if (kind === 'ws2_mist') {
      animMister.visible = true;
    } else if (kind === 'ws3_scatter_leaves') {
      leafBlanketGroup.visible = true;
    }
  };

  const update = (dt: number, time: number) => {
    // Ambient pulses
    const pulse = 1 + Math.sin(time * 3.5) * 0.04;
    ws1Beacon.scale.set(pulse, pulse, 1);
    ws2Beacon.scale.set(pulse, pulse, 1);
    ws3Beacon.scale.set(pulse, pulse, 1);

    shelfBottleRings.forEach((r, idx) => {
      r.visible = currentProgress.dripStep === 0;
      const s = 1 + Math.sin(time * 4 + idx) * 0.08;
      r.scale.set(s, s, 1);
    });
    pickMiniRings.forEach((r, idx) => {
      r.visible = currentProgress.compostStep === 0;
      const s = 1 + Math.sin(time * 4 + idx) * 0.08;
      r.scale.set(s, s, 1);
    });

    // Control pot orange heat-evaporation wisps (always active to teach surface evaporation!)
    evapWisps.forEach((w, i) => {
      const p = (time * 0.75 + i * 0.25) % 1;
      w.position.y = 0.92 + p * 0.24;
      w.scale.setScalar(0.75 + Math.sin(p * Math.PI) * 0.4);
    });

    // Active underground root-zone drip droplets when WS1 complete
    if (currentProgress.dripStep >= 4) {
      dripDroplets.forEach((d, i) => {
        d.visible = true;
        const p = (time * 0.8 + i * 0.17) % 1;
        d.position.set(
          0.2 + p * 0.22,
          0.92 - Math.sin(p * Math.PI) * 0.04,
          0.06 + ((i % 3) - 1) * 0.03
        );
      });
    } else {
      dripDroplets.forEach((d) => (d.visible = false));
    }

    // Active warm microbial steam wisps when WS2 complete
    if (currentProgress.compostStep >= 6) {
      compostSteamWisps.forEach((sw, i) => {
        sw.visible = true;
        const p = (time * 0.45 + i * 0.25) % 1;
        sw.position.set(((i % 2) - 0.5) * 0.2, 0.54 + p * 0.35, -0.05 + ((i > 1 ? 1 : -1) * 0.08));
        sw.scale.setScalar(0.8 + p * 0.8);
      });
    }

    // Timed 3D action sequences
    if (activeAnim === 'none') return;
    animElapsed += dt;

    if (activeAnim === 'ws1_bottle_select') {
      const t = Math.min(1, animElapsed / 0.65);
      const ease = 1 - Math.pow(1 - t, 3);
      dripBottleGroup.position.set(
        THREE.MathUtils.lerp(-0.4, -0.34, ease),
        THREE.MathUtils.lerp(0.98, 0.8, ease) + Math.sin(ease * Math.PI) * 0.24,
        THREE.MathUtils.lerp(-0.24, 0.16, ease)
      );
      if (t >= 1) activeAnim = 'none';
    } else if (activeAnim === 'ws1_bury') {
      const t = Math.min(1, animElapsed / 1.15);
      const ease = 1 - Math.pow(1 - t, 2.4);
      // Hand trowel digging beside the plant
      animTrowel.position.set(
        0.2 + Math.sin(animElapsed * 14) * 0.03,
        1.08 + Math.abs(Math.sin(animElapsed * 11)) * 0.08,
        0.18
      );
      animTrowel.rotation.z = Math.sin(animElapsed * 12) * 0.25;
      soilClods.forEach((c, idx) => {
        const lt = (animElapsed * 1.9 + idx * 0.06) % 0.45;
        c.mesh.position.set(0.2 + c.vx * lt, 1.03 + c.vy * lt - 1.5 * lt * lt, 0.06 + c.vz * lt);
      });
      // Bottle lifts from craft cradle and sinks halfway into cutaway soil bed beside roots
      if (t < 0.45) {
        const a = t / 0.45;
        dripBottleGroup.position.set(
          THREE.MathUtils.lerp(-0.34, 0.2, a),
          THREE.MathUtils.lerp(0.8, 1.05, a) + Math.sin(a * Math.PI) * 0.14,
          THREE.MathUtils.lerp(0.16, 0.06, a)
        );
      } else {
        const b = (t - 0.45) / 0.55;
        dripBottleGroup.position.set(0.2, THREE.MathUtils.lerp(1.05, 0.87, b), 0.06);
      }
      if (t >= 1) {
        animTrowel.visible = false;
        soilClodsGroup.visible = false;
        activeAnim = 'none';
        setProgress(currentProgress);
      }
    } else if (activeAnim === 'ws1_pour_cap') {
      const t = Math.min(1, animElapsed / 1.35);
      animWs1Pitcher.position.set(0.32, 1.48, 0.06);
      animWs1Pitcher.rotation.z = Math.min(0.95, t * 2.2);
      ws1PourStream.visible = t > 0.14 && t < 0.78;
      ws1PourStream.scale.set(0.9 + Math.sin(time * 24) * 0.15, 1, 0.9 + Math.sin(time * 24) * 0.15);
      dripWaterInner.visible = true;
      dripWaterInner.scale.y = Math.min(1, Math.max(0.05, t * 1.25));
      // Screw pinhole cap smoothly onto bottle neck at end
      dripCap.position.y = t < 0.78 ? 0.38 : THREE.MathUtils.lerp(0.38, 0.308, (t - 0.78) / 0.22);
      dripCap.rotation.y = t >= 0.78 ? (t - 0.78) * 18 : 0;
      if (t >= 1) {
        animWs1Pitcher.visible = false;
        ws1PourStream.visible = false;
        activeAnim = 'none';
        setProgress(currentProgress);
      }
    } else if (activeAnim === 'ws2_container') {
      const t = Math.min(1, animElapsed / 0.7);
      const bounce = Math.abs(Math.sin(t * Math.PI * 1.5)) * (1 - t) * 0.25;
      activeContainerGroup.position.y = (1 - t) * 0.9 + bounce;
      if (t >= 1) {
        activeContainerGroup.position.y = 0;
        activeAnim = 'none';
      }
    } else if (
      activeAnim === 'ws2_gather' ||
      activeAnim === 'ws2_twigs' ||
      activeAnim === 'ws2_greens' ||
      activeAnim === 'ws2_browns'
    ) {
      const t = Math.min(1, animElapsed / 0.85);
      flyingScraps.forEach((fs) => {
        const lt = THREE.MathUtils.clamp((t - fs.delay * 0.4) / 0.65, 0, 1);
        const startX = activeAnim === 'ws2_greens' ? -0.68 : activeAnim === 'ws2_browns' || activeAnim === 'ws2_twigs' ? 0.68 : fs.startX;
        const startZ = fs.startZ;
        fs.mesh.position.set(
          THREE.MathUtils.lerp(startX, 0, lt),
          0.22 + Math.sin(lt * Math.PI) * 0.75,
          THREE.MathUtils.lerp(startZ, -0.05, lt)
        );
        fs.mesh.rotation.x = lt * 6;
        fs.mesh.rotation.y = lt * 4;
      });
      if (t >= 1) {
        flyingScrapsGroup.visible = false;
        activeAnim = 'none';
        setProgress(currentProgress);
      }
    } else if (activeAnim === 'ws2_mist') {
      const t = Math.min(1, animElapsed / 1.15);
      animMister.position.set(Math.sin(t * Math.PI * 3) * 0.24, 0.88, 0.08);
      animMister.rotation.x = -0.35;
      mistDrops.forEach((md, i) => {
        md.visible = true;
        const mp = (animElapsed * 2.8 + i * 0.12) % 0.6;
        md.position.set(
          animMister.position.x + ((i % 5) - 2) * 0.045,
          0.84 - mp * 0.6,
          -0.05 + (Math.floor(i / 5) - 0.5) * 0.12
        );
      });
      if (t >= 1) {
        animMister.visible = false;
        mistDrops.forEach((md) => (md.visible = false));
        activeAnim = 'none';
        setProgress(currentProgress);
      }
    } else if (activeAnim === 'ws3_place_collar') {
      const t = Math.min(1, animElapsed / 0.9);
      const ease = 1 - Math.pow(1 - t, 2.5);
      mulchCollarGroup.visible = true;
      mulchCollarGroup.position.set(
        THREE.MathUtils.lerp(-0.34, 0.38, ease),
        THREE.MathUtils.lerp(0.805, 1.016, ease) + Math.sin(ease * Math.PI) * 0.32,
        THREE.MathUtils.lerp(0.18, 0.04, ease)
      );
      mulchCollarGroup.rotation.y = Math.sin(ease * Math.PI) * 0.35;
      if (t >= 1) {
        mulchCollarGroup.rotation.y = 0;
        activeAnim = 'none';
        setProgress(currentProgress);
      }
    } else if (activeAnim === 'ws3_scatter_leaves') {
      const t = Math.min(1, animElapsed / 1.15);
      dryLeafMeshes.forEach((l) => {
        const lt = THREE.MathUtils.clamp((t - l.delay * 0.55) / 0.55, 0, 1);
        const sway = Math.sin(lt * Math.PI * 3 + l.delay * 10) * 0.04 * (1 - lt);
        l.mesh.position.set(
          l.targetX + sway,
          THREE.MathUtils.lerp(l.targetY + 0.58, l.targetY, lt * lt),
          l.targetZ + sway * 0.5
        );
      });
      if (t >= 1) {
        activeAnim = 'none';
        setProgress(currentProgress);
      }
    }
  };

  const dispose = () => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    disposables.forEach((d) => d.dispose());
  };

  const setDoorOpenFactors = (gardenOpen: number, kitchenOpen: number) => {
    gardenDoorPivot.rotation.y = THREE.MathUtils.clamp(gardenOpen, 0, 1) * 1.25;
    kitchenDoorPivot.rotation.y = THREE.MathUtils.clamp(kitchenOpen, 0, 1) * 1.25;
  };

  setProgress(currentProgress);

  return {
    group,
    colliders,
    anchors: {
      drip_bench: new THREE.Vector3(-2.25, 0, -1.15),
      compost_bay: new THREE.Vector3(0, 0, -1.9),
      mulch_bench: new THREE.Vector3(2.25, 0, -1.15),
      garden_door: new THREE.Vector3(-1.45, 0, 4.15),
      kitchen_door: new THREE.Vector3(1.45, 0, 4.15),
    },
    interactableObjects,
    getRaycastTargets,
    stepManualTool,
    startActionAnim,
    setDoorOpenFactors,
    setProgress,
    update,
    dispose,
  };
}
