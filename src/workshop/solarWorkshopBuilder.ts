import * as THREE from 'three';
import { type WeatherMode } from './crops';
import { createHorizonBackdrop } from './horizonBackdrop';
import type { AABB } from './kitchenRoomBuilder';
import type { WorkshopMaterials } from './materials';
import {
  DEFAULT_SOLAR_PROGRESS,
  computeSolarTelemetry,
  getSunTargetAngles,
  type SolarProgressState,
} from './solarData';
import { createWeatherFxSystem } from './weatherFx';

export type SolarTargetKind =
  | 'workbench'
  | 'wiring_wall'
  | 'mount_zone'
  | 'wash_tool'
  | 'telemetry'
  | 'kitchen_door'
  | 'garden_door'
  | null;

export type SolarAnchorKey = Exclude<SolarTargetKind, null>;

export interface SolarWorkshopHandle {
  group: THREE.Group;
  colliders: AABB[];
  anchors: Record<SolarAnchorKey, THREE.Vector3>;
  interactableObjects: THREE.Object3D[];
  setDoorOpenFactors: (kitchenOpen: number, gardenOpen: number) => void;
  setSolarState: (solar: SolarProgressState, weatherMode: WeatherMode) => void;
  startSprayWashAnim: () => void;
  update: (dt: number, time: number) => void;
  dispose: () => void;
}

function createSolarSignTexture(
  title: string,
  subtitle: string,
  accentHex = '#facc15'
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
  ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(title, 256, 112);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSolarPanelCellsTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0c1f44';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 6;
  const rows = 8;
  const cw = 512 / cols;
  const ch = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 3;
      const y = r * ch + 3;
      const w = cw - 6;
      const h = ch - 6;
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#102a5c');
      grad.addColorStop(0.5, '#173d7a');
      grad.addColorStop(1, '#0d234a');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      // Fine silver horizontal collector fingers
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.36)';
      ctx.lineWidth = 1;
      for (let f = 1; f < 5; f++) {
        const fy = y + (h * f) / 5;
        ctx.beginPath();
        ctx.moveTo(x, fy);
        ctx.lineTo(x + w, fy);
        ctx.stroke();
      }

      // Dual vertical silver busbars per cell
      ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
      ctx.fillRect(x + w * 0.3, y, 2, h);
      ctx.fillRect(x + w * 0.68, y, 2, h);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDustOverlayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  ctx.fillStyle = 'rgba(194, 149, 86, 0.62)';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 420; i++) {
    const x = (((Math.sin(i * 19.3) * 43758.5) % 1) + 1) % 1 * 512;
    const y = (((Math.sin(i * 71.7) * 19341.2) % 1) + 1) % 1 * 512;
    const r = 4 + (i % 18);
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(161, 110, 54, 0.45)' : 'rgba(232, 198, 138, 0.38)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSolarWorkshop(
  mats: WorkshopMaterials,
  maxAniso: number
): SolarWorkshopHandle {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const interactableObjects: THREE.Object3D[] = [];

  // Shared Horizon Backdrop + Live Weather FX
  const horizon = createHorizonBackdrop();
  group.add(horizon.group);
  const weatherFx = createWeatherFxSystem();
  weatherFx.group.position.set(0, 0, 0);
  group.add(weatherFx.group);

  // Materials
  const sandstoneMat = new THREE.MeshStandardMaterial({
    color: 0xd6c3a5,
    roughness: 0.88,
    metalness: 0.02,
  });
  const grassBorderMat = new THREE.MeshStandardMaterial({
    color: 0x4b7a47,
    roughness: 0.92,
  });
  const pergolaWoodMat = new THREE.MeshStandardMaterial({
    color: 0x7c5334,
    roughness: 0.82,
    metalness: 0.03,
  });
  const workbenchWoodMat = new THREE.MeshStandardMaterial({
    color: 0xa67343,
    roughness: 0.72,
    metalness: 0.04,
  });
  const panelCellTex = createSolarPanelCellsTexture();
  panelCellTex.anisotropy = maxAniso;
  const panelCellMat = new THREE.MeshStandardMaterial({
    map: panelCellTex,
    roughness: 0.2,
    metalness: 0.32,
  });
  const glassShieldMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const dustTex = createDustOverlayTexture();
  dustTex.anisotropy = maxAniso;
  const dustMat = new THREE.MeshStandardMaterial({
    map: dustTex,
    transparent: true,
    opacity: 0,
    roughness: 0.96,
    depthWrite: false,
  });
  const optimalRimMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 0,
    roughness: 0.25,
    transparent: true,
    opacity: 0.85,
  });
  const rayIndicatorMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  const airflowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
  });
  const sunOrbMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
  });
  const sunRayMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  disposables.push(
    sandstoneMat,
    grassBorderMat,
    pergolaWoodMat,
    workbenchWoodMat,
    panelCellTex,
    panelCellMat,
    glassShieldMat,
    dustTex,
    dustMat,
    optimalRimMat,
    rayIndicatorMat,
    airflowMat,
    sunOrbMat,
    sunRayMat
  );

  // 1. Open-Air Sandstone Patio & Grass Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), grassBorderMat);
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  group.add(ground);

  const patio = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.05, 9.5), sandstoneMat);
  patio.position.set(0, 0.015, -0.15);
  patio.receiveShadow = true;
  group.add(patio);

  // Low Timber Perimeter Railings (West & East open views to mountains/trees)
  const addRailBar = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pergolaWoodMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  // West & East waist-height rails
  addRailBar(0.12, 0.1, 9.2, -4.75, 0.95, -0.15);
  addRailBar(0.12, 0.1, 9.2, 4.75, 0.95, -0.15);
  [-4.75, 4.75].forEach((rx) => {
    [-4.3, -1.6, 1.1, 3.8].forEach((rz) => {
      addRailBar(0.14, 1.05, 0.14, rx, 0.525, rz);
    });
  });

  // North Electrical Hub Backing Wall (low sleek wall so sky & mountains tower cleanly above)
  addRailBar(8.9, 2.35, 0.16, 0, 1.175, -4.42);
  addRailBar(9.1, 0.12, 0.24, 0, 2.38, -4.42);

  // Open-air Wooden Pergola Posts & Overhead Sunlit Rafters (cast real shadows!)
  [
    [-4.35, -4.1],
    [4.35, -4.1],
    [-4.35, 4.05],
    [4.35, 4.05],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.25, 0.18), pergolaWoodMat);
    post.position.set(px, 1.625, pz);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  });
  addRailBar(9.2, 0.16, 0.16, 0, 3.25, -4.1);
  addRailBar(9.2, 0.16, 0.16, 0, 3.25, 4.05);
  // Pergola rafters mainly over West Workbench side so East Solar Mount Zone gets full unblocked sunlight
  for (let i = 0; i < 6; i++) {
    const rx = -4.2 + i * 0.78;
    const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 8.3), pergolaWoodMat);
    rafter.position.set(rx, 3.36, -0.02);
    rafter.castShadow = true;
    group.add(rafter);
  }

  // Overhead Banner Sign above North Electrical Wall
  const labBannerTex = createSolarSignTexture(
    'DOOR 4 · SOLAR & PVC LAB',
    'OFF-GRID SCHOOL POWER HUB',
    '#facc15'
  );
  disposables.push(labBannerTex);
  const labBannerMat = new THREE.MeshBasicMaterial({ map: labBannerTex });
  disposables.push(labBannerMat);
  const labBanner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.68), labBannerMat);
  labBanner.position.set(0, 2.86, -4.32);
  group.add(labBanner);

  // 2. Visible 3D Sun Orb & Sun-Ray Beams + Photon Pulses (reposition dynamically by WeatherMode)
  const sunRig = new THREE.Group();
  const sunOrb = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 16), sunOrbMat);
  sunRig.add(sunOrb);
  const sunBeam = new THREE.Mesh(new THREE.ConeGeometry(1.75, 11.5, 20, 1, true), sunRayMat);
  sunBeam.position.set(0, -5.75, 0);
  sunBeam.rotation.x = Math.PI;
  sunRig.add(sunBeam);
  const sunPhotonMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.72,
  });
  disposables.push(sunPhotonMat);
  const sunPhotons: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const ph = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), sunPhotonMat);
    sunRig.add(ph);
    sunPhotons.push(ph);
  }
  sunRig.position.set(2.2, 8.6, -4.8);
  group.add(sunRig);

  // 3. South Fence & Walk-Through Return Doors: Door 1 Kitchen (-1.45) & Door 2 Garden (+1.45)
  addRailBar(9.8, 2.95, 0.2, 0, 1.475, 4.45);

  const buildSolarSouthDoor = (
    xPos: number,
    title: string,
    sub: string,
    accentHex: string,
    portalHex: number
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

    const doorGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 1.15, 0.09),
      mats.pvcAcrylicWindowMat
    );
    doorGlass.position.set(0.56, 1.48, 0);
    leafPivot.add(doorGlass);

    const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.08), mats.brassMat);
    doorHandle.position.set(0.98, 1.05, -0.06);
    leafPivot.add(doorHandle);
    dGroup.add(leafPivot);

    const signTex = createSolarSignTexture(title, sub, accentHex);
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

  const kitchenDoorPivot = buildSolarSouthDoor(
    -1.45,
    'DOOR 1 · KITCHEN',
    'WALK THROUGH →',
    '#38bdf8',
    0x38bdf8
  );
  const gardenDoorPivot = buildSolarSouthDoor(
    1.45,
    'DOOR 2 · GARDEN',
    'WALK THROUGH →',
    '#34d399',
    0x34d399
  );

  // 4. West 3D Assembly Workbench (-1.85, 0, -0.85)
  const benchGroup = new THREE.Group();
  benchGroup.position.set(-1.85, 0, -0.85);
  group.add(benchGroup);

  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.08, 1.15), workbenchWoodMat);
  benchTop.position.y = 0.88;
  benchTop.castShadow = true;
  benchTop.receiveShadow = true;
  benchGroup.add(benchTop);

  [
    [-0.96, -0.46],
    [0.96, -0.46],
    [-0.96, 0.46],
    [0.96, 0.46],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.86, 0.1), pergolaWoodMat);
    leg.position.set(lx, 0.43, lz);
    leg.castShadow = true;
    benchGroup.add(leg);
  });

  const benchShelf = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 0.9), pergolaWoodMat);
  benchShelf.position.y = 0.25;
  benchGroup.add(benchShelf);

  const benchSignTex = createSolarSignTexture(
    'ASSEMBLY BENCH',
    'STEP 1 PVC FRAME · STEP 2 PANEL',
    '#38bdf8'
  );
  disposables.push(benchSignTex);
  const benchSignMat = new THREE.MeshBasicMaterial({ map: benchSignTex });
  disposables.push(benchSignMat);
  const benchSign = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.34), benchSignMat);
  benchSign.position.set(0, 0.56, 0.56);
  benchGroup.add(benchSign);

  // Bench Assembly Mini-Build (Steps 1 & 2 visible parts on bench)
  const benchBuildGroup = new THREE.Group();
  benchBuildGroup.position.set(0, 0.93, 0);
  benchGroup.add(benchBuildGroup);

  const framePart1 = new THREE.Group(); // Base skids
  [-0.55, 0.55].forEach((sx) => {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 12), mats.pvcMat);
    skid.rotation.x = Math.PI * 0.5;
    skid.position.set(sx, 0.03, 0);
    skid.castShadow = true;
    framePart1.add(skid);
  });
  benchBuildGroup.add(framePart1);

  const framePart2 = new THREE.Group(); // Front short + Rear tall uprights
  [
    [-0.55, -0.28, 0.44],
    [0.55, -0.28, 0.44],
    [-0.55, 0.28, 0.22],
    [0.55, 0.28, 0.22],
  ].forEach(([ux, uz, uh]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, uh, 12), mats.pvcMat);
    leg.position.set(ux, 0.03 + uh * 0.5, uz);
    leg.castShadow = true;
    framePart2.add(leg);
  });
  benchBuildGroup.add(framePart2);

  const framePart3 = new THREE.Group(); // Angled tilt rails
  [-0.55, 0.55].forEach((rx) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.68, 12), mats.pvcMat);
    rail.rotation.x = Math.PI * 0.5 + 0.36;
    rail.position.set(rx, 0.35, 0);
    rail.castShadow = true;
    framePart3.add(rail);
  });
  benchBuildGroup.add(framePart3);

  const framePart4 = new THREE.Group(); // Cross-brace strut + convective airflow arrows
  const crossBrace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 1.14, 12),
    mats.pvcMat
  );
  crossBrace.rotation.z = Math.PI * 0.5;
  crossBrace.position.set(0, 0.26, -0.28);
  framePart4.add(crossBrace);
  const frontBrace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 1.14, 12),
    mats.pvcMat
  );
  frontBrace.rotation.z = Math.PI * 0.5;
  frontBrace.position.set(0, 0.16, 0.28);
  framePart4.add(frontBrace);
  benchBuildGroup.add(framePart4);

  const benchAirflowArrows: THREE.Mesh[] = [];
  [-0.25, 0, 0.25].forEach((ax) => {
    const arr = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 8), airflowMat);
    arr.position.set(ax, 0.12, 0.04);
    benchBuildGroup.add(arr);
    benchAirflowArrows.push(arr);
  });

  // Step 2 Bench Panel Stack (Tilted atop frame)
  const benchPanelPivot = new THREE.Group();
  benchPanelPivot.position.set(0, 0.37, 0);
  benchPanelPivot.rotation.x = 0.36;
  benchBuildGroup.add(benchPanelPivot);

  const benchAlumFrame = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.032, 0.72), mats.chromeMat);
  benchPanelPivot.add(benchAlumFrame);

  const benchPvCells = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.036, 0.64), panelCellMat);
  benchPvCells.position.y = 0.006;
  benchPanelPivot.add(benchPvCells);

  const benchGlassShield = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.012, 0.66),
    glassShieldMat
  );
  benchGlassShield.position.y = 0.028;
  benchPanelPivot.add(benchGlassShield);

  const benchHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.6, 1.3),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  benchHitbox.position.set(0, 0.9, 0);
  benchHitbox.userData.solarTarget = 'workbench';
  benchGroup.add(benchHitbox);
  interactableObjects.push(benchHitbox);

  // 5. North Electrical Hub Wall (z = -4.22): Digital Multimeter + 3 Equipment Boxes + Bus + Telemetry
  interface WallBoxHandle {
    group: THREE.Group;
    ledMat: THREE.MeshBasicMaterial;
    barMesh: THREE.Mesh;
    stageRequired: number;
  }
  const wallBoxes: WallBoxHandle[] = [];

  const buildWallBox = (
    x: number,
    w: number,
    h: number,
    d: number,
    bodyColor: number,
    title: string,
    sub: string,
    accentHex: string,
    ledHex: number,
    stageRequired: number
  ): THREE.Group => {
    const boxGrp = new THREE.Group();
    boxGrp.position.set(x, 1.35, -4.24);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.42,
      metalness: 0.35,
    });
    disposables.push(bodyMat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    body.castShadow = true;
    boxGrp.add(body);

    const tex = createSolarSignTexture(title, sub, accentHex);
    disposables.push(tex);
    const labelMat = new THREE.MeshBasicMaterial({ map: tex });
    disposables.push(labelMat);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, h * 0.44), labelMat);
    label.position.set(0, h * 0.16, d * 0.5 + 0.004);
    boxGrp.add(label);

    // Animated Status LED & Charge Meter Bar on lower front bezel
    const ledMat = new THREE.MeshBasicMaterial({ color: ledHex, transparent: true, opacity: 0.9 });
    disposables.push(ledMat);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), ledMat);
    led.position.set(-w * 0.32, -h * 0.24, d * 0.5 + 0.014);
    boxGrp.add(led);

    const barMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.48, 0.045, 0.016), ledMat);
    barMesh.position.set(w * 0.08, -h * 0.24, d * 0.5 + 0.01);
    boxGrp.add(barMesh);

    wallBoxes.push({ group: boxGrp, ledMat, barMesh, stageRequired });
    group.add(boxGrp);
    return boxGrp;
  };

  // Charge Controller (x = -1.45), Battery Bank (x = 0), Inverter (x = 1.45), Bus Box (x = 2.7)
  const controllerBox = buildWallBox(
    -1.45,
    0.72,
    0.76,
    0.2,
    0x1e3a8a,
    'MPPT CONTROLLER',
    'REGULATES SOLAR DC',
    '#facc15',
    0xfacc15,
    1
  );
  const batteryBox = buildWallBox(
    0,
    0.84,
    0.82,
    0.26,
    0x0f172a,
    'BATTERY BANK',
    'STORES CLEAN ENERGY',
    '#38bdf8',
    0x38bdf8,
    2
  );
  const inverterBox = buildWallBox(
    1.45,
    0.76,
    0.76,
    0.22,
    0x14532d,
    'DC→AC INVERTER',
    '230V AC POWER CONVERTER',
    '#34d399',
    0x34d399,
    3
  );
  const busBox = buildWallBox(
    2.68,
    0.76,
    0.7,
    0.18,
    0x1f2937,
    'FACILITY BUS',
    'KITCHEN · GARDEN · COMPOST',
    '#4ade80',
    0x4ade80,
    4
  );

  // Interactive Digital Multimeter Canvas Board (x = -2.85)
  const meterCanvas = document.createElement('canvas');
  meterCanvas.width = 512;
  meterCanvas.height = 384;
  const meterCtx = meterCanvas.getContext('2d')!;
  const meterTex = new THREE.CanvasTexture(meterCanvas);
  meterTex.colorSpace = THREE.SRGBColorSpace;
  meterTex.anisotropy = maxAniso;
  disposables.push(meterTex);

  const meterPanelGroup = new THREE.Group();
  meterPanelGroup.position.set(-2.85, 1.38, -4.22);
  const meterBacking = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.82, 0.16), mats.sawGripMat);
  meterPanelGroup.add(meterBacking);
  const meterScreenMat = new THREE.MeshBasicMaterial({ map: meterTex });
  disposables.push(meterScreenMat);
  const meterScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.7), meterScreenMat);
  meterScreen.position.z = 0.085;
  meterPanelGroup.add(meterScreen);
  meterPanelGroup.userData.solarTarget = 'wiring_wall';
  group.add(meterPanelGroup);
  interactableObjects.push(meterPanelGroup);

  const wiringHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 1.6, 0.7),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  wiringHitbox.position.set(-0.1, 1.35, -4.1);
  wiringHitbox.userData.solarTarget = 'wiring_wall';
  group.add(wiringHitbox);
  interactableObjects.push(wiringHitbox);

  // Live Telemetry Screen (angled toward courtyard at x = 3.55, z = -3.45)
  const telCanvas = document.createElement('canvas');
  telCanvas.width = 512;
  telCanvas.height = 384;
  const telCtx = telCanvas.getContext('2d')!;
  const telTex = new THREE.CanvasTexture(telCanvas);
  telTex.colorSpace = THREE.SRGBColorSpace;
  telTex.anisotropy = maxAniso;
  disposables.push(telTex);

  const telStand = new THREE.Group();
  telStand.position.set(3.55, 0, -3.35);
  telStand.rotation.y = -0.45;
  const telPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.35, 12), mats.darkMetalMat);
  telPost.position.y = 0.675;
  telStand.add(telPost);
  const telBezel = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.92, 0.1), mats.darkMetalMat);
  telBezel.position.y = 1.52;
  telStand.add(telBezel);
  const telFaceMat = new THREE.MeshBasicMaterial({ map: telTex });
  disposables.push(telFaceMat);
  const telFace = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.82), telFaceMat);
  telFace.position.set(0, 1.52, 0.055);
  telFace.userData.solarTarget = 'telemetry';
  telStand.add(telFace);
  group.add(telStand);
  interactableObjects.push(telFace);

  // 6. Animated Color-Coded Energy Cables & Glowing Pulses
  interface EnergyCable {
    stageRequired: number;
    curve: THREE.CatmullRomCurve3;
    tube: THREE.Mesh;
    pulses: THREE.Mesh[];
    mat: THREE.MeshStandardMaterial;
  }
  const cables: EnergyCable[] = [];

  const createEnergyCable = (
    stageRequired: number,
    points: THREE.Vector3[],
    colorHex: number,
    emissiveHex: number
  ) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, 28, 0.024, 8, false);
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: emissiveHex,
      emissiveIntensity: 0.45,
      roughness: 0.35,
    });
    const pulseMat = new THREE.MeshBasicMaterial({ color: emissiveHex });
    disposables.push(mat, pulseMat);

    const tube = new THREE.Mesh(tubeGeo, mat);
    group.add(tube);

    const pulses: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), pulseMat);
      group.add(p);
      pulses.push(p);
    }
    cables.push({ stageRequired, curve, tube, pulses, mat });
  };

  // Stage 1: Yellow raw solar DC from Mount Zone (1.85, 0.8, -0.75) -> Charge Controller (-1.45, 1.05, -4.18)
  createEnergyCable(
    1,
    [
      new THREE.Vector3(1.55, 0.65, -0.95),
      new THREE.Vector3(0.45, 0.12, -2.55),
      new THREE.Vector3(-1.45, 0.68, -4.16),
      new THREE.Vector3(-1.45, 1.04, -4.16),
    ],
    0xeab308,
    0xfacc15
  );
  // Stage 2: Blue stored power Charge Controller -> Battery Bank
  createEnergyCable(
    2,
    [
      new THREE.Vector3(-1.12, 1.35, -4.15),
      new THREE.Vector3(-0.78, 1.48, -4.14),
      new THREE.Vector3(-0.38, 1.35, -4.14),
    ],
    0x2563eb,
    0x38bdf8
  );
  // Stage 3: Blue DC Bus Battery Bank -> Inverter
  createEnergyCable(
    3,
    [
      new THREE.Vector3(0.38, 1.35, -4.14),
      new THREE.Vector3(0.75, 1.48, -4.14),
      new THREE.Vector3(1.1, 1.35, -4.15),
    ],
    0x0284c7,
    0x60a5fa
  );
  // Stage 4: Green usable AC power Inverter -> Facility Bus -> Room Outputs
  createEnergyCable(
    4,
    [
      new THREE.Vector3(1.82, 1.35, -4.15),
      new THREE.Vector3(2.35, 1.35, -4.15),
      new THREE.Vector3(2.68, 0.95, -4.18),
      new THREE.Vector3(2.68, 0.14, 2.2),
    ],
    0x16a34a,
    0x4ade80
  );

  // Keep references to controller/battery/inverter status LEDs
  void controllerBox;
  void batteryBox;
  void inverterBox;
  void busBox;

  // 7. East Sunlit Mounting & Calibration Zone (1.85, 0, -0.75)
  const mountGroup = new THREE.Group();
  mountGroup.position.set(1.85, 0, -0.75);
  group.add(mountGroup);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.65), mats.stainlessMat);
  plinth.position.y = 0.04;
  plinth.receiveShadow = true;
  mountGroup.add(plinth);

  // Ghost outline before Step 3 so player sees where finished rig gets mounted
  const mountGhost = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.95, 1.05),
    mats.rackUnbuiltGhostMat
  );
  mountGhost.position.y = 0.56;
  mountGroup.add(mountGhost);

  // Completed Mounted Elevated PVC Gimbal + Dual Solar Panel Rig
  const mountedRigGroup = new THREE.Group();
  mountedRigGroup.position.y = 0.08;
  mountGroup.add(mountedRigGroup);

  // Elevated PVC Base Skids & Legs
  [-0.68, 0.68].forEach((sx) => {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 1.08, 12), mats.pvcMat);
    skid.rotation.x = Math.PI * 0.5;
    skid.position.set(sx, 0.04, 0);
    skid.castShadow = true;
    mountedRigGroup.add(skid);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.86, 12), mats.pvcMat);
    post.position.set(sx, 0.46, 0);
    post.castShadow = true;
    mountedRigGroup.add(post);
  });
  const mainPivotAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 1.54, 12),
    mats.chromeMat
  );
  mainPivotAxle.rotation.z = Math.PI * 0.5;
  mainPivotAxle.position.y = 0.88;
  mountedRigGroup.add(mainPivotAxle);

  // Rising airflow arrows beneath mounted solar rig
  const mountAirflowArrows: THREE.Mesh[] = [];
  [-0.45, 0, 0.45].forEach((ax) => {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), airflowMat);
    arrow.position.set(ax, 0.34, 0.12);
    mountedRigGroup.add(arrow);
    mountAirflowArrows.push(arrow);
  });

  // Azimuth (Yaw) + Tilt (Pitch) Solar Array Gimbal
  const azimuthPivot = new THREE.Group();
  azimuthPivot.position.y = 0.92;
  mountedRigGroup.add(azimuthPivot);

  const tiltPivot = new THREE.Group();
  azimuthPivot.add(tiltPivot);

  const alumBorder = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.05, 1.06), mats.chromeMat);
  alumBorder.castShadow = true;
  tiltPivot.add(alumBorder);

  const optimalRim = new THREE.Mesh(new THREE.BoxGeometry(1.79, 0.03, 1.11), optimalRimMat);
  optimalRim.position.y = -0.004;
  tiltPivot.add(optimalRim);

  const solarCells = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.054, 0.96), panelCellMat);
  solarCells.position.y = 0.008;
  solarCells.castShadow = true;
  tiltPivot.add(solarCells);

  const temperedGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.66, 0.014, 0.98),
    glassShieldMat
  );
  temperedGlass.position.y = 0.038;
  tiltPivot.add(temperedGlass);

  // 3D Dust Overlay Mesh
  const dustOverlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 0.96), dustMat);
  dustOverlayMesh.rotation.x = -Math.PI * 0.5;
  dustOverlayMesh.position.y = 0.047;
  tiltPivot.add(dustOverlayMesh);

  // Sun-Ray Angle Indicator Normal Stick & Cone
  const rayStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.58, 10), rayIndicatorMat);
  rayStem.position.set(0, 0.34, 0);
  tiltPivot.add(rayStem);
  const rayHead = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 12), rayIndicatorMat);
  rayHead.position.set(0, 0.67, 0);
  tiltPivot.add(rayHead);

  const mountHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.65, 1.55),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  mountHitbox.position.set(0, 0.85, 0);
  mountHitbox.userData.solarTarget = 'mount_zone';
  mountGroup.add(mountHitbox);
  interactableObjects.push(mountHitbox);

  // 8. 3D Water Sprayer & Squeegee Wiper Tool Station (x = 3.45, z = -0.35)
  const washGroup = new THREE.Group();
  washGroup.position.set(3.45, 0, -0.35);
  group.add(washGroup);

  const washPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.72, 16), mats.cabinetDarkMat);
  washPedestal.position.y = 0.36;
  washPedestal.castShadow = true;
  washGroup.add(washPedestal);

  // Water Sprayer Tank + Nozzle Wand
  const sprayerTank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 14), mats.waterStreamMat);
  sprayerTank.position.set(-0.08, 0.9, 0);
  washGroup.add(sprayerTank);
  const sprayerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.08, 10), mats.sawGripMat);
  sprayerCap.position.set(-0.08, 1.1, 0);
  washGroup.add(sprayerCap);

  // Squeegee Wiper resting upright
  const squeegeeStick = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.58, 10), mats.chromeMat);
  squeegeeStick.position.set(0.1, 1.0, 0);
  squeegeeStick.rotation.z = -0.14;
  washGroup.add(squeegeeStick);
  const squeegeeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.04), mats.drillBodyMat);
  squeegeeBlade.position.set(0.14, 1.28, 0);
  squeegeeBlade.rotation.z = -0.14;
  washGroup.add(squeegeeBlade);

  const washHitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1.45, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  washHitbox.position.y = 0.75;
  washHitbox.userData.solarTarget = 'wash_tool';
  washGroup.add(washHitbox);
  interactableObjects.push(washHitbox);

  // Animated Spray & Wiper Sweep Overlay attached to tiltPivot during wash animation
  const activeWiperGroup = new THREE.Group();
  activeWiperGroup.visible = false;
  activeWiperGroup.position.set(0, 0.09, 0);
  const animBlade = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.045, 0.055), mats.drillBodyMat);
  animBlade.rotation.y = Math.PI * 0.5;
  activeWiperGroup.add(animBlade);
  const animHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8), mats.chromeMat);
  animHandle.rotation.z = -0.45;
  animHandle.position.set(0.18, 0.22, 0);
  activeWiperGroup.add(animHandle);
  const sprayDroplets: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), mats.waterStreamMat);
    activeWiperGroup.add(drop);
    sprayDroplets.push(drop);
  }
  tiltPivot.add(activeWiperGroup);

  // Colliders
  const colliders: AABB[] = [
    { minX: -2.98, maxX: -0.72, minZ: -1.48, maxZ: -0.22 }, // Workbench
    { minX: 0.72, maxX: 2.98, minZ: -1.62, maxZ: 0.12 }, // Solar Mounting Zone
    { minX: 3.12, maxX: 3.78, minZ: -0.68, maxZ: -0.02 }, // Wash Station
    { minX: -3.55, maxX: 3.95, minZ: -4.55, maxZ: -3.72 }, // North Electrical Wall & Telemetry
  ];

  // State + Canvas Draw Helpers
  let currentSolar: SolarProgressState = { ...DEFAULT_SOLAR_PROGRESS };
  let currentWeather: WeatherMode = 'normal';
  let sprayAnimRemaining = 0;
  let targetAzimuthRad = THREE.MathUtils.degToRad(currentSolar.azimuthDeg);
  let targetTiltRad = THREE.MathUtils.degToRad(currentSolar.tiltDeg);
  let benchSnapBounce = 0;
  let lastPartsTotal = 0;

  const drawMultimeter = () => {
    const tel = computeSolarTelemetry(currentSolar, currentWeather);
    const w = meterCanvas.width;
    const h = meterCanvas.height;
    meterCtx.fillStyle = '#0f172a';
    meterCtx.fillRect(0, 0, w, h);
    meterCtx.strokeStyle = '#f59e0b';
    meterCtx.lineWidth = 8;
    meterCtx.strokeRect(8, 8, w - 16, h - 16);

    meterCtx.fillStyle = '#fbbf24';
    meterCtx.font = 'bold 24px ui-monospace, monospace';
    meterCtx.fillText('DIGITAL MULTIMETER · STEP 3', 28, 48);

    meterCtx.fillStyle = '#1e293b';
    meterCtx.fillRect(28, 72, w - 56, 175);

    meterCtx.fillStyle = currentSolar.wiringMode === 'series' ? '#38bdf8' : '#34d399';
    meterCtx.font = 'bold 30px ui-monospace, monospace';
    meterCtx.fillText(
      `MODE: ${currentSolar.wiringMode.toUpperCase()}`,
      46,
      118
    );

    meterCtx.fillStyle = '#f8fafc';
    meterCtx.font = 'bold 46px ui-monospace, monospace';
    meterCtx.fillText(`${tel.voltageV}V   ${tel.currentA}A`, 46, 182);

    meterCtx.fillStyle = '#fde047';
    meterCtx.font = 'bold 24px ui-monospace, monospace';
    meterCtx.fillText(
      currentSolar.wiringMode === 'series'
        ? 'Series = High Voltage (Water Pumps)'
        : 'Parallel = High Amps (Fast Charge)',
      46,
      224
    );

    meterCtx.fillStyle = '#cbd5e1';
    meterCtx.font = 'bold 22px system-ui, sans-serif';
    meterCtx.fillText(`Cables Wired: ${currentSolar.wiredStage}/4`, 28, 300);

    meterCtx.fillStyle = currentSolar.wiredStage >= 4 ? '#4ade80' : '#facc15';
    meterCtx.fillText(
      currentSolar.wiredStage >= 4 ? 'SYSTEM CIRCUIT COMPLETE' : 'Connect Red(+) & Black(-) in order',
      28,
      340
    );
    meterTex.needsUpdate = true;
  };

  const drawTelemetry = () => {
    const tel = computeSolarTelemetry(currentSolar, currentWeather);
    const w = telCanvas.width;
    const h = telCanvas.height;
    telCtx.fillStyle = '#090f1d';
    telCtx.fillRect(0, 0, w, h);
    telCtx.strokeStyle = tel.needsDustMaintenance
      ? '#f59e0b'
      : tel.isOptimalCapture
        ? '#34d399'
        : '#38bdf8';
    telCtx.lineWidth = 8;
    telCtx.strokeRect(8, 8, w - 16, h - 16);

    telCtx.fillStyle = tel.needsDustMaintenance ? '#fbbf24' : '#34d399';
    telCtx.font = 'bold 23px ui-monospace, monospace';
    telCtx.fillText(
      tel.needsDustMaintenance
        ? '⚠ EL NIÑO DUST ALERT!'
        : 'LIVE SOLAR TELEMETRY',
      26,
      46
    );

    telCtx.fillStyle = '#ffffff';
    telCtx.font = 'bold 44px ui-monospace, monospace';
    telCtx.fillText(`${tel.watts} W`, 26, 110);
    telCtx.fillStyle = '#94a3b8';
    telCtx.font = 'bold 22px ui-monospace, monospace';
    telCtx.fillText(`/ ${tel.maxPotentialWatts}W PEAK`, 175, 108);

    const rows: Array<[string, string, string]> = [
      ['Sun Alignment', `${tel.sunAlignmentPct}%`, tel.sunAlignmentPct >= 90 ? '#4ade80' : '#facc15'],
      ['Battery Health', `${tel.batteryHealthPct}%`, tel.batteryHealthPct >= 75 ? '#38bdf8' : '#fbbf24'],
      ['Panel Temp', `${tel.panelTempC}°C`, tel.panelTempC > 46 ? '#f87171' : '#e2e8f0'],
      ['Dust Output Drop', `${tel.dustPenaltyPct}%`, tel.dustPenaltyPct > 0 ? '#f87171' : '#4ade80'],
      ['Garden Pump Power', `${tel.gardenPumpEfficiencyPct}%`, tel.gardenPumpEfficiencyPct >= 85 ? '#4ade80' : '#fbbf24'],
    ];
    rows.forEach(([k, v, col], idx) => {
      const y = 160 + idx * 42;
      telCtx.fillStyle = '#cbd5e1';
      telCtx.font = '600 22px system-ui, sans-serif';
      telCtx.fillText(k, 26, y);
      telCtx.fillStyle = col;
      telCtx.font = 'bold 24px ui-monospace, monospace';
      telCtx.fillText(v, 360, y);
    });

    telTex.needsUpdate = true;
  };

  const applyVisualState = () => {
    const s = currentSolar;
    const tel = computeSolarTelemetry(s, currentWeather);

    const nextTotal = s.framePartsDone + s.panelPartsDone;
    if (nextTotal > lastPartsTotal) {
      benchSnapBounce = 1;
    }
    lastPartsTotal = nextTotal;

    // Step 1 & 2 Bench build visibility
    const showBenchRig = s.step <= 2;
    benchBuildGroup.visible = showBenchRig;
    framePart1.visible = s.framePartsDone >= 1;
    framePart2.visible = s.framePartsDone >= 2;
    framePart3.visible = s.framePartsDone >= 3;
    framePart4.visible = s.framePartsDone >= 4;
    benchAirflowArrows.forEach((a) => {
      a.visible = s.framePartsDone >= 4;
    });

    benchPanelPivot.visible = s.step === 2 && s.panelPartsDone >= 1;
    benchAlumFrame.visible = s.panelPartsDone >= 1;
    benchPvCells.visible = s.panelPartsDone >= 2;
    benchGlassShield.visible = s.panelPartsDone >= 3;

    // Step 3+ Mounted Rig visibility
    const mountedReady = s.step >= 3;
    mountGhost.visible = !mountedReady;
    mountedRigGroup.visible = mountedReady;

    // Smooth target Tilt (0..75 deg) & Azimuth (-90..90 deg)
    targetAzimuthRad = THREE.MathUtils.degToRad(s.azimuthDeg);
    targetTiltRad = THREE.MathUtils.degToRad(s.tiltDeg);

    // Sun-Ray Indicator Color + Optimal Glow
    if (tel.sunAlignmentPct >= 90) {
      rayIndicatorMat.color.setHex(0x34d399);
    } else if (tel.sunAlignmentPct >= 65) {
      rayIndicatorMat.color.setHex(0xfacc15);
    } else {
      rayIndicatorMat.color.setHex(0xef4444);
    }
    optimalRimMat.emissiveIntensity = tel.isOptimalCapture && s.step >= 4 ? 1.45 : 0;

    // Dust Overlay
    dustMat.opacity = THREE.MathUtils.clamp((s.dustLevel / 100) * 0.78, 0, 0.78);
    dustOverlayMesh.visible = s.dustLevel > 0;

    // Sun Orb Position matches weather sun angle
    const targetSun = getSunTargetAngles(currentWeather);
    const azRad = THREE.MathUtils.degToRad(targetSun.azimuthDeg);
    const tiltRad = THREE.MathUtils.degToRad(targetSun.tiltDeg);
    sunRig.position.set(
      1.85 + Math.sin(azRad) * 4.5,
      8.2 - tiltRad * 2.1,
      -0.75 - Math.cos(azRad) * 4.8
    );
    sunRig.lookAt(1.85, 0.9, -0.75);
    sunOrbMat.color.setHex(currentWeather === 'rain_storm' ? 0xcbd5e1 : 0xfde047);
    sunRayMat.opacity = currentWeather === 'rain_storm' ? 0.04 : 0.16;

    // Cables visibility
    cables.forEach((c) => {
      const wired = s.step >= 4 || (s.step === 3 && s.wiredStage >= c.stageRequired);
      c.tube.visible = wired;
      c.pulses.forEach((p) => {
        p.visible = wired;
      });
    });

    drawMultimeter();
    drawTelemetry();
  };

  applyVisualState();

  const update = (dt: number, time: number) => {
    horizon.update(time);
    weatherFx.update(dt, time, currentWeather, false, false);

    const tel = computeSolarTelemetry(currentSolar, currentWeather);

    // Smoothly damp 3D gimbal pitch & azimuth toward slider targets
    azimuthPivot.rotation.y = THREE.MathUtils.damp(
      azimuthPivot.rotation.y,
      targetAzimuthRad,
      9,
      dt
    );
    tiltPivot.rotation.x = THREE.MathUtils.damp(
      tiltPivot.rotation.x,
      targetTiltRad,
      9,
      dt
    );

    // Workbench part snap-in spring bounce
    if (benchSnapBounce > 0) {
      benchSnapBounce = Math.max(0, benchSnapBounce - dt * 2.8);
      const lift = Math.sin(benchSnapBounce * Math.PI) * 0.08;
      benchBuildGroup.position.y = 0.93 + lift;
      benchBuildGroup.scale.setScalar(1 + Math.sin(benchSnapBounce * Math.PI) * 0.04);
    } else {
      benchBuildGroup.position.y = 0.93;
      benchBuildGroup.scale.setScalar(1);
    }

    // Animated Sun Orb corona & streaming photon pulses
    const sunPulse = 1 + Math.sin(time * 2.4) * 0.06;
    sunOrb.scale.setScalar(sunPulse);
    sunBeam.rotation.y = time * 0.35;
    sunPhotons.forEach((ph, idx) => {
      const u = (time * 0.55 + idx / sunPhotons.length) % 1;
      const spread = 0.25 + u * 0.9;
      const ang = idx * 1.05 + time * 0.8;
      ph.position.set(Math.cos(ang) * spread, -0.8 - u * 8.4, Math.sin(ang) * spread);
      ph.visible = currentWeather !== 'rain_storm';
    });

    // Subtle shimmer on Optimal Solar Capture rim & Sun-Ray normal arrow
    if (tel.isOptimalCapture && currentSolar.step >= 4) {
      optimalRimMat.emissiveIntensity = 1.2 + Math.sin(time * 5.2) * 0.45;
    }
    rayHead.position.y = 0.67 + Math.sin(time * 3.4) * 0.035;

    // Wash station ready attention bob when panels have dust
    if (currentSolar.dustLevel > 0) {
      sprayerTank.position.y = 0.9 + Math.abs(Math.sin(time * 3.6)) * 0.06;
      squeegeeStick.position.y = 1.0 + Math.abs(Math.sin(time * 3.6 + 0.5)) * 0.05;
      squeegeeBlade.position.y = 1.28 + Math.abs(Math.sin(time * 3.6 + 0.5)) * 0.05;
    } else {
      sprayerTank.position.y = 0.9;
      squeegeeStick.position.y = 1.0;
      squeegeeBlade.position.y = 1.28;
    }

    // Wall electrical box status LEDs & charge bar meters
    wallBoxes.forEach((wb, idx) => {
      const wired =
        currentSolar.step >= 4 ||
        (currentSolar.step === 3 && currentSolar.wiredStage >= wb.stageRequired);
      wb.barMesh.visible = wired;
      if (wired) {
        const blink = 0.72 + Math.sin(time * 4.5 + idx * 1.1) * 0.28;
        wb.barMesh.scale.x = Math.max(0.25, Math.min(1, (tel.watts / Math.max(1, tel.maxPotentialWatts)) * blink));
        wb.ledMat.opacity = 1;
      } else {
        wb.ledMat.opacity = 0.25 + Math.sin(time * 2.0 + idx) * 0.15;
      }
    });

    // Rising convective airflow animation under PVC frames
    const flowPhase = (time * 0.85) % 1;
    benchAirflowArrows.forEach((a, idx) => {
      if (a.visible) {
        a.position.y = 0.08 + ((flowPhase + idx * 0.25) % 1) * 0.22;
      }
    });
    mountAirflowArrows.forEach((a, idx) => {
      a.position.y = 0.22 + ((flowPhase + idx * 0.25) % 1) * 0.42;
    });

    // Cable energy pulses proportional to output watts
    const pulseSpeed = Math.max(0.18, Math.min(1.15, tel.watts / 170));
    cables.forEach((c) => {
      if (!c.tube.visible) return;
      c.pulses.forEach((p, idx) => {
        const u = (time * pulseSpeed + idx / c.pulses.length) % 1;
        c.curve.getPointAt(u, p.position);
      });
    });

    // Wash Spray & Wiper Sweep Animation
    if (sprayAnimRemaining > 0) {
      sprayAnimRemaining = Math.max(0, sprayAnimRemaining - dt);
      activeWiperGroup.visible = true;
      const progress = 1 - sprayAnimRemaining / 1.45;
      activeWiperGroup.position.x = Math.sin(progress * Math.PI * 3) * 0.65;
      sprayDroplets.forEach((d, idx) => {
        const dp = (progress * 2.5 + idx * 0.13) % 1;
        d.position.set(
          Math.cos(idx * 1.9) * 0.42,
          0.35 - dp * 0.34,
          Math.sin(idx * 2.3) * 0.36
        );
      });
      if (sprayAnimRemaining === 0) {
        activeWiperGroup.visible = false;
      }
    }
  };

  const dispose = () => {
    horizon.dispose();
    weatherFx.dispose();
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
    anchors: {
      workbench: new THREE.Vector3(-1.85, 0, -0.85),
      wiring_wall: new THREE.Vector3(-0.1, 0, -3.45),
      mount_zone: new THREE.Vector3(1.85, 0, -0.75),
      wash_tool: new THREE.Vector3(3.45, 0, -0.35),
      telemetry: new THREE.Vector3(3.15, 0, -2.75),
      kitchen_door: new THREE.Vector3(-1.45, 0, 4.18),
      garden_door: new THREE.Vector3(1.45, 0, 4.18),
    },
    interactableObjects,
    setDoorOpenFactors: (kitchenOpen: number, gardenOpen: number) => {
      kitchenDoorPivot.rotation.y = -THREE.MathUtils.clamp(kitchenOpen, 0, 1) * 1.25;
      gardenDoorPivot.rotation.y = -THREE.MathUtils.clamp(gardenOpen, 0, 1) * 1.25;
    },
    setSolarState: (solar: SolarProgressState, weatherMode: WeatherMode) => {
      currentSolar = { ...solar };
      currentWeather = weatherMode;
      applyVisualState();
    },
    startSprayWashAnim: () => {
      sprayAnimRemaining = 1.45;
    },
    update,
    dispose,
  };
}
