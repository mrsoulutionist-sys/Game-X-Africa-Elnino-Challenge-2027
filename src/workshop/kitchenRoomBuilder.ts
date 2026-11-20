import * as THREE from 'three';
import type { WorkshopMaterials } from './materials';
import { buildWorkshopWallSignage } from './sponsorSignage';
import type { BuildStepId, TargetZoneId } from './steps';

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ZoneAnchor {
  id: TargetZoneId;
  label: string;
  position: THREE.Vector3;
  interactRadius: number;
  beaconGroup: THREE.Group;
  beaconRing: THREE.Mesh;
  beaconArrow: THREE.Mesh;
}

export interface KitchenRoomHandle {
  group: THREE.Group;
  colliders: AABB[];
  targetZones: Record<TargetZoneId, ZoneAnchor>;
  interactableObjects: THREE.Object3D[];
  sinkWaterStream: THREE.Mesh;
  setActiveStepVisuals: (step: BuildStepId, isFillingSink: boolean) => void;
  update: (time: number, isFillingSink: boolean) => void;
  dispose: () => void;
}

function tagTargetZone(obj: THREE.Object3D, zone: TargetZoneId): void {
  obj.userData.targetZone = zone;
  obj.traverse((child) => {
    child.userData.targetZone = zone;
  });
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  castShadow = true,
  receiveShadow = true
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  return mesh;
}

function createHacksawProp(mats: WorkshopMaterials): THREE.Group {
  const g = new THREE.Group();

  // Wooden cutting block underneath
  addBox(g, 0.24, 0.025, 0.14, 0, 0.0125, 0, mats.butcherBlockMat);

  const saw = new THREE.Group();
  saw.position.set(0, 0.045, 0);
  saw.rotation.y = 0.22;
  saw.rotation.x = Math.PI * 0.5;

  // Bow frame spine + uprights
  addBox(saw, 0.42, 0.018, 0.016, 0, 0.08, 0, mats.sawFrameMat);
  addBox(saw, 0.018, 0.1, 0.016, -0.2, 0.032, 0, mats.sawFrameMat);
  addBox(saw, 0.018, 0.08, 0.016, 0.2, 0.042, 0, mats.sawFrameMat);

  // Serrated steel blade
  addBox(saw, 0.39, 0.014, 0.003, 0, -0.01, 0, mats.chromeMat);

  // Ergonomic amber handle
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.11, 12), mats.sawGripMat);
  grip.position.set(0.245, 0.025, 0);
  grip.rotation.z = -0.35;
  grip.castShadow = true;
  saw.add(grip);

  // Wingnut tensioner
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.016, 8), mats.brassMat);
  nut.rotation.z = Math.PI * 0.5;
  nut.position.set(-0.22, -0.01, 0);
  saw.add(nut);

  g.add(saw);
  return g;
}

function createDrillProp(mats: WorkshopMaterials): THREE.Group {
  const g = new THREE.Group();

  // Rubber tool pad
  addBox(g, 0.28, 0.012, 0.2, 0, 0.006, 0, mats.matPadMat);

  const drill = new THREE.Group();
  drill.position.set(0, 0.012, 0);
  drill.rotation.y = -0.35;

  // Battery base seated flush
  addBox(drill, 0.11, 0.042, 0.075, 0, 0.021, 0, mats.darkMetalMat);

  // Pistol grip
  const grip = addBox(drill, 0.042, 0.125, 0.048, -0.01, 0.095, 0, mats.drillBodyMat);
  grip.rotation.z = -0.18;

  // Motor housing
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.17, 14), mats.drillBodyMat);
  motor.rotation.z = Math.PI * 0.5;
  motor.position.set(0.01, 0.165, 0);
  motor.castShadow = true;
  drill.add(motor);

  // Chuck
  const chuck = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.055, 14), mats.darkMetalMat);
  chuck.rotation.z = Math.PI * 0.5;
  chuck.position.set(0.115, 0.165, 0);
  chuck.castShadow = true;
  drill.add(chuck);

  // Toothed hole-saw cup bit
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.029, 0.029, 0.045, 16, 1, true),
    mats.brassMat
  );
  cup.rotation.z = Math.PI * 0.5;
  cup.position.set(0.17, 0.165, 0);
  cup.castShadow = true;
  drill.add(cup);

  const arbor = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 8), mats.chromeMat);
  arbor.rotation.z = Math.PI * 0.5;
  arbor.position.set(0.172, 0.165, 0);
  drill.add(arbor);

  g.add(drill);
  return g;
}

function createWicksAndCaddyProp(mats: WorkshopMaterials): THREE.Group {
  const g = new THREE.Group();

  // Wooden organizer tray
  addBox(g, 0.36, 0.02, 0.24, 0, 0.01, 0, mats.butcherBlockMat);

  // Jar of terracotta LECA clay pebbles
  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.062, 0.13, 16),
    mats.pvcAcrylicWindowMat
  );
  jar.position.set(-0.09, 0.085, 0.02);
  g.add(jar);

  // LECA pebbles inside jar
  for (let i = 0; i < 14; i++) {
    const angle = i * 1.9;
    const rad = (i % 3) * 0.017;
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.014, 0), mats.lecaMat);
    pebble.position.set(
      -0.09 + Math.cos(angle) * rad,
      0.036 + Math.floor(i / 4) * 0.022,
      0.02 + Math.sin(angle) * rad
    );
    g.add(pebble);
  }

  // Coiled cotton capillary wicks bundle
  for (let w = 0; w < 4; w++) {
    const wick = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 18), mats.wickDryMat);
    wick.rotation.x = Math.PI * 0.5;
    wick.position.set(0.075, 0.028 + w * 0.014, -0.025);
    wick.castShadow = true;
    g.add(wick);
  }

  // Small seed packet box
  addBox(g, 0.085, 0.024, 0.11, 0.075, 0.032, 0.06, mats.leafMat);
  addBox(g, 0.06, 0.026, 0.04, 0.075, 0.033, 0.06, mats.seedMat);

  return g;
}

function createPitcherProp(mats: WorkshopMaterials): { group: THREE.Group; waterFill: THREE.Mesh } {
  const group = new THREE.Group();

  // Clear pitcher cylinder body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.058, 0.19, 18, 1, true),
    mats.pvcAcrylicWindowMat
  );
  body.position.y = 0.098;
  group.add(body);

  // Pitcher base disk
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.008, 18), mats.pvcMat);
  base.position.y = 0.004;
  group.add(base);

  // Top rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.005, 8, 18), mats.pvcMat);
  rim.rotation.x = Math.PI * 0.5;
  rim.position.y = 0.192;
  group.add(rim);

  // Handle
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.048, 0.007, 8, 14, Math.PI),
    mats.pvcMat
  );
  handle.rotation.z = -Math.PI * 0.5;
  handle.position.set(0.066, 0.105, 0);
  group.add(handle);

  // Internal water level mesh (hidden until filled at sink)
  const waterFill = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.054, 0.14, 16),
    mats.waterMat
  );
  waterFill.position.y = 0.078;
  waterFill.visible = false;
  group.add(waterFill);

  return { group, waterFill };
}

function createBeacon(x: number, y: number, z: number): {
  group: THREE.Group;
  ring: THREE.Mesh;
  arrow: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 32), ringMat);
  ring.rotation.x = -Math.PI * 0.5;
  ring.position.y = 0.015;
  group.add(ring);

  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  const arrow = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), arrowMat);
  arrow.position.y = 0.36;
  group.add(arrow);

  return { group, ring, arrow };
}

export function buildKitchenWorkshopRoom(
  mats: WorkshopMaterials,
  maxAnisotropy = 4
): KitchenRoomHandle {
  const group = new THREE.Group();
  const colliders: AABB[] = [];
  const interactableObjects: THREE.Object3D[] = [];
  const disposableExtras: Array<{ dispose: () => void }> = [];

  // Game X Africa Wall Branding & Modular Sponsor Slots
  const wallSignage = buildWorkshopWallSignage(maxAnisotropy, mats);
  group.add(wallSignage.group);
  disposableExtras.push(wallSignage);

  // 1. Floor & Ceiling (Room span: X[-4.55, 4.55], Z[-4.4, 4.25], Y[0, 3.35])
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 8.7), mats.floorMat);
  floor.rotation.x = -Math.PI * 0.5;
  floor.position.set(0, 0, -0.08);
  floor.receiveShadow = true;
  group.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 8.7), mats.ceilingMat);
  ceiling.rotation.x = Math.PI * 0.5;
  ceiling.position.set(0, 3.35, -0.08);
  group.add(ceiling);

  // Walls
  addBox(group, 9.2, 3.35, 0.14, 0, 1.675, -4.46, mats.wallMat, false, true); // North
  addBox(group, 9.2, 3.35, 0.14, 0, 1.675, 4.32, mats.wallMat, false, true); // South
  addBox(group, 0.14, 3.35, 8.8, -4.58, 1.675, -0.08, mats.wallMat, false, true); // West
  addBox(group, 0.14, 3.35, 8.8, 4.58, 1.675, -0.08, mats.wallMat, false, true); // East

  // Baseboards on South & open walls
  addBox(group, 9.1, 0.1, 0.03, 0, 0.05, 4.24, mats.cabinetDarkMat, false, true);

  // 2. Daylight Kitchen Window behind Sink (x = -1.9, z = -4.38)
  addBox(group, 1.65, 1.32, 0.06, -1.9, 1.95, -4.38, mats.cabinetDarkMat, false, false);
  const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.16), mats.windowGlowMat);
  windowPane.position.set(-1.9, 1.95, -4.345);
  group.add(windowPane);
  // Window mullions
  addBox(group, 0.035, 1.18, 0.02, -1.9, 1.95, -4.335, mats.wallMat, false, false);
  addBox(group, 1.52, 0.035, 0.02, -1.9, 1.95, -4.335, mats.wallMat, false, false);

  // 3. Tiled Subway Backsplash Panels
  // North backsplash left & right of window + below window
  addBox(group, 1.85, 1.18, 0.025, -3.58, 1.49, -4.38, mats.tileMat, false, true);
  addBox(group, 3.6, 1.18, 0.025, 0.72, 1.49, -4.38, mats.tileMat, false, true);
  addBox(group, 1.66, 0.39, 0.025, -1.9, 1.095, -4.38, mats.tileMat, false, true);
  // West backsplash
  addBox(group, 0.025, 1.18, 6.08, -4.5, 1.49, -0.44, mats.tileMat, false, true);
  // East backsplash
  addBox(group, 0.025, 1.18, 3.85, 4.5, 1.49, 0.175, mats.tileMat, false, true);

  // 4. North Counter Run (X[-4.5, 2.55], Z[-4.38, -3.48], top y = 0.90)
  addBox(group, 7.05, 0.08, 0.82, -0.975, 0.04, -3.96, mats.cabinetDarkMat); // toe-kick
  addBox(group, 7.05, 0.78, 0.86, -0.975, 0.47, -3.94, mats.cabinetMat); // base cabinet
  // Cabinet door accents along North counter
  for (let i = 0; i < 8; i++) {
    const cx = -4.05 + i * 0.88;
    addBox(group, 0.78, 0.64, 0.025, cx, 0.48, -3.505, mats.cabinetDarkMat, false, true);
    addBox(group, 0.018, 0.14, 0.025, cx + 0.28, 0.58, -3.485, mats.chromeMat, false, false);
  }
  // North Quartz Countertop split around recessed sink (sink opening X[-2.30, -1.50], Z[-4.20, -3.66])
  addBox(group, 2.2, 0.045, 0.92, -3.4, 0.882, -3.92, mats.quartzMat); // left of sink
  addBox(group, 4.05, 0.045, 0.92, 0.525, 0.882, -3.92, mats.quartzMat); // right of sink
  addBox(group, 0.82, 0.045, 0.2, -1.9, 0.882, -4.28, mats.quartzMat); // behind sink
  addBox(group, 0.82, 0.045, 0.2, -1.9, 0.882, -3.56, mats.quartzMat); // front rim of sink

  colliders.push({ minX: -4.55, maxX: 2.58, minZ: -4.45, maxZ: -3.44 });

  // Upper North Cabinets (flanking the daylight window)
  addBox(group, 1.55, 0.92, 0.4, -3.65, 2.55, -4.18, mats.cabinetMat);
  addBox(group, 2.95, 0.92, 0.4, 0.92, 2.55, -4.18, mats.cabinetMat);

  // 5. Stainless Steel Kitchen Sink & Gooseneck Faucet (x = -1.9, z = -3.92)
  const sinkGroup = new THREE.Group();
  sinkGroup.position.set(-1.9, 0.905, -3.92);
  // Sink rim
  addBox(sinkGroup, 0.84, 0.012, 0.56, 0, 0.004, 0, mats.stainlessMat);
  // Recessed basin walls & bottom
  addBox(sinkGroup, 0.78, 0.014, 0.5, 0, -0.17, 0, mats.stainlessMat); // bottom
  addBox(sinkGroup, 0.015, 0.17, 0.5, -0.385, -0.085, 0, mats.stainlessMat);
  addBox(sinkGroup, 0.015, 0.17, 0.5, 0.385, -0.085, 0, mats.stainlessMat);
  addBox(sinkGroup, 0.78, 0.17, 0.015, 0, -0.085, -0.245, mats.stainlessMat);
  addBox(sinkGroup, 0.78, 0.17, 0.015, 0, -0.085, 0.245, mats.stainlessMat);
  // Drain strainer
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.008, 16), mats.darkMetalMat);
  drain.position.set(0, -0.16, 0);
  sinkGroup.add(drain);

  // Faucet base & lever handle
  const faucetBase = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.04, 14), mats.chromeMat);
  faucetBase.position.set(0, 0.022, -0.29);
  sinkGroup.add(faucetBase);
  const faucetHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 10), mats.chromeMat);
  faucetHandle.rotation.z = -0.5;
  faucetHandle.position.set(0.075, 0.045, -0.29);
  sinkGroup.add(faucetHandle);

  // Curved Gooseneck Faucet (TubeGeometry)
  const gooseneckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.03, -0.29),
    new THREE.Vector3(0, 0.24, -0.29),
    new THREE.Vector3(0, 0.37, -0.21),
    new THREE.Vector3(0, 0.36, -0.08),
    new THREE.Vector3(0, 0.27, -0.04),
  ]);
  const gooseneck = new THREE.Mesh(new THREE.TubeGeometry(gooseneckCurve, 24, 0.014, 12, false), mats.chromeMat);
  gooseneck.castShadow = true;
  sinkGroup.add(gooseneck);

  // Animated tap water stream
  const sinkWaterStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.014, 0.43, 12),
    mats.waterStreamMat
  );
  sinkWaterStream.position.set(0, 0.055, -0.04);
  sinkWaterStream.visible = false;
  sinkGroup.add(sinkWaterStream);

  tagTargetZone(sinkGroup, 'sink');
  interactableObjects.push(sinkGroup);
  group.add(sinkGroup);

  // 6. Stainless Steel Refrigerator (X[2.72, 4.38], Z[-4.38, -3.45], height 2.18)
  const fridge = new THREE.Group();
  fridge.position.set(3.55, 0, -3.92);
  addBox(fridge, 1.56, 2.16, 0.88, 0, 1.08, 0, mats.stainlessMat);
  // Left & Right upper French doors
  addBox(fridge, 0.74, 1.38, 0.04, -0.38, 1.44, 0.45, mats.stainlessMat);
  addBox(fridge, 0.74, 1.38, 0.04, 0.38, 1.44, 0.45, mats.stainlessMat);
  // Lower freezer drawer
  addBox(fridge, 1.5, 0.66, 0.04, 0, 0.37, 0.45, mats.stainlessMat);
  // Vertical brushed chrome handles + horizontal freezer handle
  addBox(fridge, 0.024, 0.74, 0.035, -0.08, 1.38, 0.495, mats.chromeMat);
  addBox(fridge, 0.024, 0.74, 0.035, 0.08, 1.38, 0.495, mats.chromeMat);
  addBox(fridge, 0.88, 0.024, 0.035, 0, 0.61, 0.495, mats.chromeMat);
  // Water/ice recess
  addBox(fridge, 0.24, 0.34, 0.03, -0.38, 1.42, 0.462, mats.darkMetalMat);
  group.add(fridge);
  colliders.push({ minX: 2.7, maxX: 4.45, minZ: -4.45, maxZ: -3.4 });

  // 7. West Counter Run (X[-4.52, -3.56], Z[-3.48, 2.6], top y = 0.90)
  addBox(group, 0.84, 0.08, 6.08, -4.08, 0.04, -0.44, mats.cabinetDarkMat);
  addBox(group, 0.88, 0.78, 6.08, -4.06, 0.47, -0.44, mats.cabinetMat);
  addBox(group, 0.94, 0.045, 6.08, -4.03, 0.882, -0.44, mats.quartzMat);
  for (let i = 0; i < 6; i++) {
    const cz = -2.9 + i * 0.96;
    addBox(group, 0.025, 0.64, 0.84, -3.61, 0.48, cz, mats.cabinetDarkMat, false, true);
    addBox(group, 0.025, 0.14, 0.018, -3.59, 0.58, cz + 0.3, mats.chromeMat, false, false);
  }
  // Open oak workshop shelf on West wall
  addBox(group, 0.34, 0.038, 3.2, -4.34, 1.72, -0.5, mats.butcherBlockMat);
  colliders.push({ minX: -4.55, maxX: -3.52, minZ: -3.52, maxZ: 2.65 });

  // 8. East Counter Run (X[3.56, 4.52], Z[-1.75, 2.1], top y = 0.90)
  addBox(group, 0.84, 0.08, 3.85, 4.08, 0.04, 0.175, mats.cabinetDarkMat);
  addBox(group, 0.88, 0.78, 3.85, 4.06, 0.47, 0.175, mats.cabinetMat);
  addBox(group, 0.94, 0.045, 3.85, 4.03, 0.882, 0.175, mats.quartzMat);
  for (let i = 0; i < 4; i++) {
    const cz = -1.25 + i * 0.95;
    addBox(group, 0.025, 0.64, 0.82, 3.61, 0.48, cz, mats.cabinetDarkMat, false, true);
    addBox(group, 0.025, 0.14, 0.018, 3.59, 0.58, cz - 0.28, mats.chromeMat, false, false);
  }
  addBox(group, 0.34, 0.038, 2.4, 4.34, 1.72, 0.175, mats.butcherBlockMat);
  colliders.push({ minX: 3.52, maxX: 4.55, minZ: -1.8, maxZ: 2.15 });

  // 9. Central Butcher-Block Island Workbench (X[-1.42, 1.42], Z[-0.68, 0.68], top y = 0.92)
  const island = new THREE.Group();
  addBox(island, 2.66, 0.08, 1.18, 0, 0.04, 0, mats.cabinetDarkMat); // toe-kick
  addBox(island, 2.7, 0.78, 1.22, 0, 0.47, 0, mats.cabinetMat); // base body
  // Shaker door panels front & back
  for (let i = 0; i < 3; i++) {
    const ix = -0.84 + i * 0.84;
    addBox(island, 0.74, 0.64, 0.025, ix, 0.48, 0.615, mats.cabinetDarkMat, false, true);
    addBox(island, 0.74, 0.64, 0.025, ix, 0.48, -0.615, mats.cabinetDarkMat, false, true);
    addBox(island, 0.14, 0.018, 0.025, ix, 0.72, 0.635, mats.chromeMat, false, false);
    addBox(island, 0.14, 0.018, 0.025, ix, 0.72, -0.635, mats.chromeMat, false, false);
  }
  // Overhanging Butcher-Block Slab (y = 0.86 to 0.92)
  addBox(island, 2.84, 0.06, 1.36, 0, 0.89, 0, mats.butcherBlockMat, true, true);
  // Dark non-slip assembly mat flush on top (top at y = 0.928)
  addBox(island, 1.92, 0.008, 0.76, 0, 0.924, 0, mats.matPadMat, false, true);

  tagTargetZone(island, 'workbench');
  interactableObjects.push(island);
  group.add(island);
  colliders.push({ minX: -1.45, maxX: 1.45, minZ: -0.72, maxZ: 0.72 });

  // 10. Two Hanging Pendant Lights over Central Island
  [-0.68, 0.68].forEach((px) => {
    const pendant = new THREE.Group();
    pendant.position.set(px, 0, 0);
    // Suspension rod from ceiling y=3.35 down to 2.24
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.11, 8), mats.darkMetalMat);
    rod.position.y = 2.795;
    pendant.add(rod);
    // Canopy at ceiling
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.025, 14), mats.darkMetalMat);
    canopy.position.y = 3.338;
    pendant.add(canopy);
    // Brass socket collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.055, 12), mats.brassMat);
    collar.position.y = 2.24;
    pendant.add(collar);
    // Matte dome shade
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.21, 0.17, 20, 1, true),
      mats.darkMetalMat
    );
    shade.position.y = 2.15;
    shade.castShadow = true;
    pendant.add(shade);
    // Warm bulb inside
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), mats.pendantGlowMat);
    bulb.position.y = 2.11;
    pendant.add(bulb);
    group.add(pendant);
  });

  // 11. Interactive Tool & Supply Stations on Perimeter Counters
  const sawProp = createHacksawProp(mats);
  sawProp.position.set(-3.92, 0.905, -1.15);
  sawProp.rotation.y = Math.PI * 0.5;
  tagTargetZone(sawProp, 'saw_station');
  interactableObjects.push(sawProp);
  group.add(sawProp);

  const drillProp = createDrillProp(mats);
  drillProp.position.set(1.2, 0.905, -3.86);
  tagTargetZone(drillProp, 'drill_station');
  interactableObjects.push(drillProp);
  group.add(drillProp);

  const wicksProp = createWicksAndCaddyProp(mats);
  wicksProp.position.set(3.92, 0.905, 0.15);
  wicksProp.rotation.y = -Math.PI * 0.5;
  tagTargetZone(wicksProp, 'wick_station');
  interactableObjects.push(wicksProp);
  group.add(wicksProp);

  const { group: pitcherProp, waterFill: pitcherWaterFill } = createPitcherProp(mats);
  pitcherProp.position.set(-1.14, 0.905, -3.82);
  tagTargetZone(pitcherProp, 'sink');
  interactableObjects.push(pitcherProp);
  group.add(pitcherProp);

  // 12. Target Zone Beacons & Anchor Positions
  const sawBeacon = createBeacon(-3.92, 0.905, -1.15);
  const benchBeacon = createBeacon(0, 0.928, 0.52);
  const drillBeacon = createBeacon(1.2, 0.905, -3.86);
  const wickBeacon = createBeacon(3.92, 0.905, 0.15);
  const sinkBeacon = createBeacon(-1.9, 0.905, -3.65);

  [sawBeacon, benchBeacon, drillBeacon, wickBeacon, sinkBeacon].forEach((b) => {
    group.add(b.group);
    disposableExtras.push(b.ring.geometry, b.ring.material as THREE.Material, b.arrow.geometry, b.arrow.material as THREE.Material);
  });

  const targetZones: Record<TargetZoneId, ZoneAnchor> = {
    saw_station: {
      id: 'saw_station',
      label: 'Hacksaw (West Counter)',
      position: new THREE.Vector3(-3.92, 0.91, -1.15),
      interactRadius: 2.25,
      beaconGroup: sawBeacon.group,
      beaconRing: sawBeacon.ring,
      beaconArrow: sawBeacon.arrow,
    },
    workbench: {
      id: 'workbench',
      label: 'Island Workbench',
      position: new THREE.Vector3(0, 0.93, 0),
      interactRadius: 2.35,
      beaconGroup: benchBeacon.group,
      beaconRing: benchBeacon.ring,
      beaconArrow: benchBeacon.arrow,
    },
    drill_station: {
      id: 'drill_station',
      label: 'Hole-Saw Drill (North-East Counter)',
      position: new THREE.Vector3(1.2, 0.91, -3.86),
      interactRadius: 2.25,
      beaconGroup: drillBeacon.group,
      beaconRing: drillBeacon.ring,
      beaconArrow: drillBeacon.arrow,
    },
    wick_station: {
      id: 'wick_station',
      label: 'Wicks & Seed Caddy (East Counter)',
      position: new THREE.Vector3(3.92, 0.91, 0.15),
      interactRadius: 2.25,
      beaconGroup: wickBeacon.group,
      beaconRing: wickBeacon.ring,
      beaconArrow: wickBeacon.arrow,
    },
    sink: {
      id: 'sink',
      label: 'Kitchen Sink & Pitcher',
      position: new THREE.Vector3(-1.82, 0.91, -3.85),
      interactRadius: 2.35,
      beaconGroup: sinkBeacon.group,
      beaconRing: sinkBeacon.ring,
      beaconArrow: sinkBeacon.arrow,
    },
  };

  let currentActiveZone: TargetZoneId | null = 'saw_station';

  const setActiveStepVisuals = (step: BuildStepId, isFillingSink: boolean) => {
    // Show/hide perimeter tool props once picked up
    sawProp.visible = step === 'GET_SAW';
    drillProp.visible =
      step === 'GET_SAW' || step === 'CUT_AND_ASSEMBLE_PVC' || step === 'GET_DRILL';
    wicksProp.visible =
      step !== 'THREAD_WICKS_AND_PLANT' &&
      step !== 'FILL_AT_SINK' &&
      step !== 'POUR_AND_GROW' &&
      step !== 'COMPLETE';

    // Pitcher sits beside sink until poured, and moves under the faucet while filling!
    const pitcherAtSink = step !== 'POUR_AND_GROW' && step !== 'COMPLETE';
    pitcherProp.visible = pitcherAtSink;
    if (isFillingSink) {
      pitcherProp.position.set(-1.9, 0.742, -3.96);
      pitcherWaterFill.visible = true;
    } else {
      pitcherProp.position.set(-1.14, 0.905, -3.82);
      pitcherWaterFill.visible = false;
    }
    sinkWaterStream.visible = isFillingSink;

    const zoneMap: Record<BuildStepId, TargetZoneId | null> = {
      GET_SAW: 'saw_station',
      CUT_AND_ASSEMBLE_PVC: 'workbench',
      GET_DRILL: 'drill_station',
      DRILL_PORTS: 'workbench',
      GET_WICKS: 'wick_station',
      THREAD_WICKS_AND_PLANT: 'workbench',
      FILL_AT_SINK: 'sink',
      POUR_AND_GROW: 'workbench',
      COMPLETE: null,
    };

    currentActiveZone = zoneMap[step];
    (Object.keys(targetZones) as TargetZoneId[]).forEach((z) => {
      targetZones[z].beaconGroup.visible = z === currentActiveZone;
    });
  };

  const update = (time: number, isFillingSink: boolean) => {
    if (currentActiveZone) {
      const anchor = targetZones[currentActiveZone];
      const pulse = 1 + Math.sin(time * 4.2) * 0.1;
      anchor.beaconRing.scale.set(pulse, pulse, 1);
      anchor.beaconArrow.position.y = 0.34 + Math.sin(time * 3.5) * 0.045;
      anchor.beaconArrow.rotation.y = time * 1.8;
    }
    if (isFillingSink) {
      const shimmer = 0.85 + Math.sin(time * 28) * 0.12;
      sinkWaterStream.scale.set(shimmer, 1, shimmer);
    }
  };

  const dispose = () => {
    disposableExtras.forEach((d) => d.dispose());
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
  };

  setActiveStepVisuals('GET_SAW', false);

  return {
    group,
    colliders,
    targetZones,
    interactableObjects,
    sinkWaterStream,
    setActiveStepVisuals,
    update,
    dispose,
  };
}
