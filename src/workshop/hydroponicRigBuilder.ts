import * as THREE from 'three';
import { workshopAudio } from './audio';
import type { WorkshopMaterials } from './materials';
import type { BuildStepId } from './steps';

export type RigActionAnim = 'none' | 'wicking' | 'pouring';

export interface ManualToolStepResult {
  stepDone: boolean;
  subProgress: number;
  completedCount: number;
  totalCount: number;
}

export interface HydroponicRigHandle {
  group: THREE.Group;
  setStepState: (step: BuildStepId, cutawayMode: boolean) => void;
  startActionAnim: (anim: RigActionAnim) => void;
  getRaycastTargets: () => THREE.Object3D[];
  stepManualTool: (
    dt: number,
    time: number,
    alignedIndex: number | null,
    isHolding: boolean
  ) => ManualToolStepResult;
  update: (dt: number, time: number) => void;
  dispose: () => void;
}

const BENCH_TOP_Y = 0.928;
const PIPE_CENTER_Y = BENCH_TOP_Y + 0.092; // 1.02m, resting cleanly on saddle cradles
const PIPE_RADIUS = 0.068;
const CUT_X_POSITIONS = [-0.56, 0.58];
const PORT_X_POSITIONS = [-0.42, -0.14, 0.14, 0.42];

export function buildHydroponicRig(mats: WorkshopMaterials): HydroponicRigHandle {
  const group = new THREE.Group();
  const portSubstrateMats: THREE.MeshStandardMaterial[] = [];
  const portWickMats: THREE.MeshStandardMaterial[] = [];
  const disposableGeoms: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  // --------------------------------------------------------------------------
  // 1. Raw Stock Layout + Manual Cut Targets (Step 2)
  // --------------------------------------------------------------------------
  const rawStockGroup = new THREE.Group();
  group.add(rawStockGroup);

  const rawPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, 1.44, 24),
    mats.pvcMat
  );
  rawPipe.rotation.z = Math.PI * 0.5;
  rawPipe.position.set(0.06, BENCH_TOP_Y + PIPE_RADIUS + 0.008, -0.04);
  rawPipe.castShadow = true;
  rawStockGroup.add(rawPipe);

  const looseElbow = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, PIPE_RADIUS * 0.96, 14, 18, Math.PI * 0.5),
    mats.pvcMat
  );
  looseElbow.position.set(-0.62, BENCH_TOP_Y + 0.072, 0.19);
  looseElbow.rotation.x = Math.PI * 0.5;
  looseElbow.castShadow = true;
  rawStockGroup.add(looseElbow);

  const looseCap = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS * 1.07, PIPE_RADIUS * 1.07, 0.06, 20),
    mats.pvcMat
  );
  looseCap.rotation.z = Math.PI * 0.5;
  looseCap.position.set(0.68, BENCH_TOP_Y + PIPE_RADIUS * 1.07, 0.18);
  looseCap.castShadow = true;
  rawStockGroup.add(looseCap);

  const looseFunnel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.044, 0.09, 20, 1, true),
    mats.pvcMat
  );
  looseFunnel.position.set(-0.42, BENCH_TOP_Y + 0.045, 0.21);
  looseFunnel.castShadow = true;
  rawStockGroup.add(looseFunnel);

  const guideMat = new THREE.LineBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.55 });
  disposableMats.push(guideMat);
  const guidePts = [
    new THREE.Vector3(-0.75, BENCH_TOP_Y + 0.003, -0.13),
    new THREE.Vector3(0.72, BENCH_TOP_Y + 0.003, -0.13),
    new THREE.Vector3(0.72, BENCH_TOP_Y + 0.003, 0.13),
    new THREE.Vector3(-0.75, BENCH_TOP_Y + 0.003, 0.13),
    new THREE.Vector3(-0.75, BENCH_TOP_Y + 0.003, -0.13),
  ];
  const guideGeom = new THREE.BufferGeometry().setFromPoints(guidePts);
  disposableGeoms.push(guideGeom);
  rawStockGroup.add(new THREE.Line(guideGeom, guideMat));

  // Cut target rings + invisible generous raycast hitboxes
  const cutTargetGroups: THREE.Group[] = [];
  const cutHitMeshes: THREE.Mesh[] = [];
  const cutRingMats: THREE.MeshBasicMaterial[] = [];
  const cutKerfMeshes: THREE.Mesh[] = [];

  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  disposableMats.push(hitboxMat);

  CUT_X_POSITIONS.forEach((cx, idx) => {
    const cg = new THREE.Group();
    cg.position.set(cx, BENCH_TOP_Y + PIPE_RADIUS + 0.008, -0.04);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    disposableMats.push(ringMat);
    cutRingMats.push(ringMat);

    const cutBand = new THREE.Mesh(
      new THREE.TorusGeometry(PIPE_RADIUS + 0.006, 0.0055, 8, 28),
      ringMat
    );
    cutBand.rotation.y = Math.PI * 0.5;
    cg.add(cutBand);

    // Subtle dark saw kerf line revealed once cut completes
    const kerf = new THREE.Mesh(
      new THREE.TorusGeometry(PIPE_RADIUS + 0.001, 0.0035, 6, 24),
      mats.darkMetalMat
    );
    kerf.rotation.y = Math.PI * 0.5;
    kerf.visible = false;
    cg.add(kerf);
    cutKerfMeshes.push(kerf);

    const hitSphere = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), hitboxMat);
    hitSphere.userData.targetKind = 'cut';
    hitSphere.userData.targetIndex = idx;
    cg.add(hitSphere);
    cutHitMeshes.push(hitSphere);

    rawStockGroup.add(cg);
    cutTargetGroups.push(cg);
  });

  // --------------------------------------------------------------------------
  // 2. Assembled PVC Manifold Group (horizontal reservoir + inspection window)
  // --------------------------------------------------------------------------
  const manifoldGroup = new THREE.Group();
  manifoldGroup.visible = false;
  group.add(manifoldGroup);

  [-0.3, 0.3].forEach((cx) => {
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.036, 0.21), mats.butcherBlockMat);
    cradle.position.set(cx, BENCH_TOP_Y + 0.018, 0);
    cradle.castShadow = true;
    cradle.receiveShadow = true;
    manifoldGroup.add(cradle);
  });

  const pvcOpaqueShellParts: THREE.Mesh[] = [];

  const pipeBackShell = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, 1.24, 28, 1, true, 0.62, Math.PI * 2 - 1.24),
    mats.pvcMat
  );
  pipeBackShell.rotation.z = -Math.PI * 0.5;
  pipeBackShell.position.set(0, PIPE_CENTER_Y, 0);
  pipeBackShell.castShadow = true;
  pipeBackShell.receiveShadow = true;
  manifoldGroup.add(pipeBackShell);
  pvcOpaqueShellParts.push(pipeBackShell);

  const innerChannelMat = new THREE.MeshStandardMaterial({
    color: 0xcad5df,
    roughness: 0.6,
    side: THREE.BackSide,
  });
  disposableMats.push(innerChannelMat);
  const pipeInterior = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS - 0.004, PIPE_RADIUS - 0.004, 1.235, 24, 1, true, 0.62, Math.PI * 2 - 1.24),
    innerChannelMat
  );
  pipeInterior.rotation.z = -Math.PI * 0.5;
  pipeInterior.position.set(0, PIPE_CENTER_Y, 0);
  manifoldGroup.add(pipeInterior);

  const inspectionWindow = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS + 0.001, PIPE_RADIUS + 0.001, 1.14, 16, 1, true, -0.62, 1.24),
    mats.pvcAcrylicWindowMat
  );
  inspectionWindow.rotation.z = -Math.PI * 0.5;
  inspectionWindow.position.set(0, PIPE_CENTER_Y, 0);
  manifoldGroup.add(inspectionWindow);

  const leftElbow = new THREE.Mesh(
    new THREE.TorusGeometry(0.072, PIPE_RADIUS * 1.04, 14, 20, Math.PI * 0.5),
    mats.pvcMat
  );
  leftElbow.position.set(-0.62, PIPE_CENTER_Y + 0.072, 0);
  leftElbow.rotation.z = Math.PI;
  leftElbow.castShadow = true;
  manifoldGroup.add(leftElbow);
  pvcOpaqueShellParts.push(leftElbow);

  const riserPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS * 0.74, PIPE_RADIUS * 0.74, 0.14, 20),
    mats.pvcMat
  );
  riserPipe.position.set(-0.692, PIPE_CENTER_Y + 0.14, 0);
  riserPipe.castShadow = true;
  manifoldGroup.add(riserPipe);
  pvcOpaqueShellParts.push(riserPipe);

  const fillFunnel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, PIPE_RADIUS * 0.76, 0.095, 22, 1, true),
    mats.pvcMat
  );
  fillFunnel.position.set(-0.692, PIPE_CENTER_Y + 0.255, 0);
  fillFunnel.castShadow = true;
  manifoldGroup.add(fillFunnel);

  const funnelCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.044, 0.02, 16),
    mats.darkMetalMat
  );
  funnelCore.position.set(-0.692, PIPE_CENTER_Y + 0.21, 0);
  manifoldGroup.add(funnelCore);

  const rightCap = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS * 1.08, PIPE_RADIUS * 1.08, 0.065, 22),
    mats.pvcMat
  );
  rightCap.rotation.z = Math.PI * 0.5;
  rightCap.position.set(0.635, PIPE_CENTER_Y, 0);
  rightCap.castShadow = true;
  manifoldGroup.add(rightCap);
  pvcOpaqueShellParts.push(rightCap);

  // Reservoir Water Volume + Left Hydrostatic Riser Column (for water stabilization visual)
  const waterChannelGroup = new THREE.Group();
  waterChannelGroup.position.set(0, PIPE_CENTER_Y - 0.056, 0);
  waterChannelGroup.scale.set(1, 0.001, 1);
  waterChannelGroup.visible = false;
  manifoldGroup.add(waterChannelGroup);

  const waterBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, 0.058, PIPE_RADIUS * 1.56),
    mats.waterMat
  );
  waterBar.position.y = 0.029;
  waterChannelGroup.add(waterBar);

  // Riser water column visible in cutaway view showing hydrostatic head settling to equilibrium
  const riserWaterGroup = new THREE.Group();
  riserWaterGroup.position.set(-0.692, PIPE_CENTER_Y - 0.03, 0);
  riserWaterGroup.visible = false;
  manifoldGroup.add(riserWaterGroup);

  const riserWaterMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS * 0.62, PIPE_RADIUS * 0.62, 0.14, 16),
    mats.waterMat
  );
  riserWaterMesh.position.y = 0.07;
  riserWaterGroup.add(riserWaterMesh);

  // --------------------------------------------------------------------------
  // 3. Drilled Planting Ports + Manual Drilling Bullseyes (Step 4)
  // --------------------------------------------------------------------------
  const portsGroup = new THREE.Group();
  manifoldGroup.add(portsGroup);

  const individualPortMeshes: THREE.Group[] = [];
  const drillTargetGroups: THREE.Group[] = [];
  const drillHitMeshes: THREE.Mesh[] = [];
  const drillBullseyeMats: THREE.MeshBasicMaterial[] = [];

  PORT_X_POSITIONS.forEach((px, idx) => {
    // Drilled hole collar & bore (starts hidden until drilled!)
    const portPair = new THREE.Group();
    portPair.visible = false;

    const portCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.043, 0.006, 10, 22),
      mats.pvcCutEdgeMat
    );
    portCollar.rotation.x = Math.PI * 0.5;
    portCollar.position.set(px, PIPE_CENTER_Y + PIPE_RADIUS - 0.002, 0);
    portPair.add(portCollar);

    const holeShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.039, 20),
      mats.darkMetalMat
    );
    holeShadow.rotation.x = -Math.PI * 0.5;
    holeShadow.position.set(px, PIPE_CENTER_Y + PIPE_RADIUS - 0.001, 0);
    portPair.add(holeShadow);

    portsGroup.add(portPair);
    individualPortMeshes.push(portPair);

    // Manual drilling target bullseye + invisible raycast hitbox
    const dg = new THREE.Group();
    dg.position.set(px, PIPE_CENTER_Y + PIPE_RADIUS + 0.004, 0);

    const bMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    disposableMats.push(bMat);
    drillBullseyeMats.push(bMat);

    const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.032, 0.044, 24), bMat);
    outerRing.rotation.x = -Math.PI * 0.5;
    dg.add(outerRing);

    const centerDot = new THREE.Mesh(new THREE.CircleGeometry(0.011, 14), bMat);
    centerDot.rotation.x = -Math.PI * 0.5;
    centerDot.position.y = 0.001;
    dg.add(centerDot);

    const hitSphere = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), hitboxMat);
    hitSphere.userData.targetKind = 'drill';
    hitSphere.userData.targetIndex = idx;
    dg.add(hitSphere);
    drillHitMeshes.push(hitSphere);

    portsGroup.add(dg);
    drillTargetGroups.push(dg);
  });

  // --------------------------------------------------------------------------
  // 4. Net-Cups, Capillary Wicks, LECA/Soil Substrate, Seeds & Growing Greens
  // --------------------------------------------------------------------------
  const plantingGroup = new THREE.Group();
  plantingGroup.visible = false;
  manifoldGroup.add(plantingGroup);

  const plantSprouts: THREE.Group[] = [];
  const moisturePulses: THREE.Mesh[] = [];

  PORT_X_POSITIONS.forEach((px, idx) => {
    const pod = new THREE.Group();
    pod.position.set(px, PIPE_CENTER_Y + PIPE_RADIUS, 0);

    const cupRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.0055, 8, 20),
      mats.netCupMat
    );
    cupRim.rotation.x = Math.PI * 0.5;
    cupRim.position.y = 0.004;
    pod.add(cupRim);

    const cupBasket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.041, 0.031, 0.056, 16, 1, true),
      mats.netCupMat
    );
    cupBasket.position.y = -0.024;
    pod.add(cupBasket);

    const wickMat = mats.wickDryMat.clone();
    disposableMats.push(wickMat);
    portWickMats.push(wickMat);

    const wickCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.015, 0),
      new THREE.Vector3(0.005, -0.055, 0.004),
      new THREE.Vector3(-0.004, -0.095, -0.003),
      new THREE.Vector3(0.012, -0.125, 0.006),
    ]);
    const wickMesh = new THREE.Mesh(new THREE.TubeGeometry(wickCurve, 14, 0.0065, 8, false), wickMat);
    pod.add(wickMesh);

    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.78,
    });
    disposableMats.push(pulseMat);
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), pulseMat);
    pulse.position.set(0, -0.11, 0);
    pulse.visible = false;
    pod.add(pulse);
    moisturePulses.push(pulse);

    const subMat = mats.substrateDryMat.clone();
    disposableMats.push(subMat);
    portSubstrateMats.push(subMat);

    const substrateMound = new THREE.Mesh(
      new THREE.CylinderGeometry(0.039, 0.032, 0.044, 16),
      subMat
    );
    substrateMound.position.y = -0.016;
    pod.add(substrateMound);

    for (let p = 0; p < 5; p++) {
      const ang = (p / 5) * Math.PI * 2 + idx * 0.8;
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.0085, 0), mats.lecaMat);
      pebble.position.set(Math.cos(ang) * 0.021, 0.008, Math.sin(ang) * 0.021);
      pod.add(pebble);
    }

    const seedA = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), mats.seedMat);
    seedA.position.set(-0.007, 0.01, 0.005);
    pod.add(seedA);
    const seedB = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), mats.seedMat);
    seedB.position.set(0.007, 0.01, -0.004);
    pod.add(seedB);

    const sprout = new THREE.Group();
    sprout.position.y = 0.008;
    sprout.scale.set(0.001, 0.001, 0.001);
    sprout.visible = false;

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.14, 8), mats.stemMat);
    stem.position.y = 0.07;
    stem.castShadow = true;
    sprout.add(stem);

    const leafGeom = new THREE.SphereGeometry(0.036, 10, 8);
    leafGeom.scale(1.15, 0.24, 1.55);
    disposableGeoms.push(leafGeom);

    for (let l = 0; l < 7; l++) {
      const leafPivot = new THREE.Group();
      const tier = Math.floor(l / 2);
      leafPivot.position.y = 0.038 + tier * 0.032;
      leafPivot.rotation.y = l * 1.85 + idx * 0.7;

      const leafMesh = new THREE.Mesh(leafGeom, l % 2 === 0 ? mats.leafMat : mats.leafLightMat);
      leafMesh.position.set(0, 0.008, 0.044);
      leafMesh.rotation.x = 0.38 - tier * 0.08;
      leafMesh.castShadow = true;
      leafPivot.add(leafMesh);
      sprout.add(leafPivot);
    }

    pod.add(sprout);
    plantSprouts.push(sprout);
    plantingGroup.add(pod);
  });

  // --------------------------------------------------------------------------
  // 5. Interactive Tools & PVC Shavings Particles
  // --------------------------------------------------------------------------
  const animSaw = new THREE.Group();
  animSaw.visible = false;
  const sawFrame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.018, 0.016), mats.sawFrameMat);
  sawFrame.position.y = 0.09;
  animSaw.add(sawFrame);
  const sawBlade = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.014, 0.004), mats.chromeMat);
  animSaw.add(sawBlade);
  const sawGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.1, 10), mats.sawGripMat);
  sawGrip.rotation.z = -0.3;
  sawGrip.position.set(0.23, 0.04, 0);
  animSaw.add(sawGrip);
  animSaw.rotation.y = Math.PI * 0.5;
  group.add(animSaw);

  const animDrill = new THREE.Group();
  animDrill.visible = false;
  const dBody = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12), mats.drillBodyMat);
  dBody.position.y = 0.16;
  animDrill.add(dBody);
  const dGrip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.12, 0.048), mats.drillBodyMat);
  dGrip.position.set(-0.07, 0.15, 0);
  dGrip.rotation.z = 0.35;
  animDrill.add(dGrip);
  const dBit = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 14, 1, true), mats.brassMat);
  dBit.position.y = 0.045;
  animDrill.add(dBit);
  group.add(animDrill);

  const animPitcher = new THREE.Group();
  animPitcher.visible = false;
  const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.18, 16), mats.pvcAcrylicWindowMat);
  animPitcher.add(pBody);
  const pWater = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 14), mats.waterMat);
  pWater.position.y = -0.02;
  animPitcher.add(pWater);
  const pourStream = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.016, 0.24, 10), mats.waterStreamMat);
  pourStream.position.set(-0.692, PIPE_CENTER_Y + 0.33, 0);
  pourStream.visible = false;
  group.add(pourStream);
  group.add(animPitcher);

  const shavingsGroup = new THREE.Group();
  shavingsGroup.visible = false;
  group.add(shavingsGroup);
  const shavingParticles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number }> = [];
  for (let i = 0; i < 16; i++) {
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.008), mats.pvcMat);
    shavingsGroup.add(chip);
    shavingParticles.push({
      mesh: chip,
      vx: ((i % 5) - 2) * 0.18,
      vy: 0.35 + (i % 3) * 0.16,
      vz: (((i * 3) % 5) - 2) * 0.16,
    });
  }

  // --------------------------------------------------------------------------
  // State & Manual Fabrication Drivers
  // --------------------------------------------------------------------------
  let currentStep: BuildStepId = 'GET_SAW';
  let activeAnim: RigActionAnim = 'none';
  let animElapsed = 0;
  let waterProgress = 0;
  let targetWaterProgress = 0;
  let stabilizationElapsed = 0;
  let wickHydration = 0;
  let growthProgress = 0;
  let cutawayEnabled = false;

  // Manual cut & drill progress arrays
  const cutProgress = [0, 0];
  const cutDone = [false, false];
  const drillProgress = [0, 0, 0, 0];
  const portDone = [false, false, false, false];

  const drySubColor = mats.substrateDryMat.color;
  const wetSubColor = mats.substrateWetMat.color;
  const dryWickColor = mats.wickDryMat.color;
  const wetWickColor = mats.wickWetMat.color;

  const applyCutaway = (enabled: boolean) => {
    cutawayEnabled = enabled;
    const mat = enabled ? mats.pvcXrayMat : mats.pvcMat;
    pvcOpaqueShellParts.forEach((m) => {
      m.material = mat;
    });
  };

  const setStepState = (step: BuildStepId, cutawayMode: boolean) => {
    currentStep = step;
    applyCutaway(cutawayMode);

    const isSawStep = step === 'CUT_AND_ASSEMBLE_PVC';
    const isDrillStep = step === 'DRILL_PORTS';
    const hasManifold = step !== 'GET_SAW' && step !== 'CUT_AND_ASSEMBLE_PVC';
    const allPortsDone = hasManifold && step !== 'GET_DRILL' && step !== 'DRILL_PORTS';
    const hasWicks = step === 'FILL_AT_SINK' || step === 'POUR_AND_GROW' || step === 'COMPLETE';
    const hasWaterAndPlants = step === 'COMPLETE';

    // Reset manual progress cleanly when returning to Step 1
    if (step === 'GET_SAW') {
      cutProgress[0] = 0;
      cutProgress[1] = 0;
      cutDone[0] = false;
      cutDone[1] = false;
      for (let i = 0; i < 4; i++) {
        drillProgress[i] = 0;
        portDone[i] = false;
      }
      cutKerfMeshes.forEach((k) => (k.visible = false));
    }

    rawStockGroup.visible = !hasManifold;
    cutTargetGroups.forEach((cg, i) => {
      cg.visible = isSawStep;
      cutKerfMeshes[i].visible = cutDone[i];
    });

    manifoldGroup.visible = hasManifold;
    portsGroup.visible = hasManifold && step !== 'GET_DRILL';
    individualPortMeshes.forEach((pm, i) => {
      pm.visible = allPortsDone || (isDrillStep && portDone[i]);
    });
    drillTargetGroups.forEach((dg, i) => {
      dg.visible = isDrillStep && !portDone[i];
    });

    plantingGroup.visible = hasWicks;

    animSaw.visible = false;
    animDrill.visible = false;
    shavingsGroup.visible = false;

    if (!hasWaterAndPlants) {
      targetWaterProgress = 0;
      waterProgress = 0;
      stabilizationElapsed = 0;
      wickHydration = 0;
      growthProgress = 0;
      waterChannelGroup.visible = false;
      waterChannelGroup.scale.y = 0.001;
      riserWaterGroup.visible = false;
      plantSprouts.forEach((s) => {
        s.visible = false;
        s.scale.set(0.001, 0.001, 0.001);
      });
      moisturePulses.forEach((p) => {
        p.visible = false;
      });
      portSubstrateMats.forEach((m) => m.color.copy(drySubColor));
      portWickMats.forEach((m) => {
        m.color.copy(dryWickColor);
        m.emissiveIntensity = 0;
      });
    } else {
      targetWaterProgress = 1;
      waterChannelGroup.visible = true;
      riserWaterGroup.visible = true;
    }
  };

  const getRaycastTargets = (): THREE.Object3D[] => {
    if (currentStep === 'CUT_AND_ASSEMBLE_PVC') {
      return cutHitMeshes.filter((_, i) => !cutDone[i]);
    }
    if (currentStep === 'DRILL_PORTS') {
      return drillHitMeshes.filter((_, i) => !portDone[i]);
    }
    return [];
  };

  const stepManualTool = (
    dt: number,
    time: number,
    alignedIndex: number | null,
    isHolding: boolean
  ): ManualToolStepResult => {
    if (currentStep === 'CUT_AND_ASSEMBLE_PVC') {
      cutRingMats.forEach((mat, i) => {
        if (cutDone[i]) {
          mat.color.setHex(0x10b981);
          mat.opacity = 0.35;
        } else if (alignedIndex === i) {
          mat.color.setHex(0x34d399);
          mat.opacity = 1.0;
        } else {
          mat.color.setHex(0xfbbf24);
          mat.opacity = 0.72 + Math.sin(time * 4 + i) * 0.2;
        }
      });

      const activeIdx = alignedIndex !== null && !cutDone[alignedIndex] ? alignedIndex : null;
      if (activeIdx !== null && isHolding) {
        const cx = CUT_X_POSITIONS[activeIdx];
        animSaw.visible = true;
        animSaw.position.set(cx, BENCH_TOP_Y + PIPE_RADIUS + 0.075, -0.04 + Math.sin(time * 26) * 0.085);
        shavingsGroup.visible = true;
        shavingsGroup.position.set(cx, BENCH_TOP_Y + PIPE_RADIUS + 0.04, -0.04);
        shavingParticles.forEach((p, idx) => {
          const lt = (time * 1.9 + idx * 0.04) % 0.45;
          p.mesh.position.set(p.vx * lt, p.vy * lt - 1.3 * lt * lt, p.vz * lt);
        });
        workshopAudio.playSawStroke();

        cutProgress[activeIdx] = Math.min(1, cutProgress[activeIdx] + dt / 0.85);
        if (cutProgress[activeIdx] >= 1) {
          cutDone[activeIdx] = true;
          cutKerfMeshes[activeIdx].visible = true;
          workshopAudio.playSnapComplete();
        }
      } else {
        animSaw.visible = false;
        shavingsGroup.visible = false;
      }

      const completedCount = cutDone.filter(Boolean).length;
      return {
        stepDone: completedCount === cutDone.length,
        subProgress: activeIdx !== null ? cutProgress[activeIdx] : 0,
        completedCount,
        totalCount: cutDone.length,
      };
    }

    if (currentStep === 'DRILL_PORTS') {
      drillBullseyeMats.forEach((mat, i) => {
        if (alignedIndex === i && !portDone[i]) {
          mat.color.setHex(0x34d399);
          mat.opacity = 1.0;
        } else {
          mat.color.setHex(0xfbbf24);
          mat.opacity = 0.75 + Math.sin(time * 4.5 + i) * 0.2;
        }
      });

      const activeIdx = alignedIndex !== null && !portDone[alignedIndex] ? alignedIndex : null;
      if (activeIdx !== null) {
        const px = PORT_X_POSITIONS[activeIdx];
        animDrill.visible = true;
        const plunge = isHolding ? 0.02 + drillProgress[activeIdx] * 0.04 : 0;
        animDrill.position.set(px, PIPE_CENTER_Y + PIPE_RADIUS + 0.07 - plunge, 0);

        if (isHolding) {
          dBit.rotation.y += dt * 32;
          shavingsGroup.visible = true;
          shavingsGroup.position.set(px, PIPE_CENTER_Y + PIPE_RADIUS + 0.01, 0);
          shavingParticles.forEach((p, idx) => {
            const lt = (time * 2.1 + idx * 0.05) % 0.45;
            p.mesh.position.set(p.vx * lt, p.vy * lt * 0.7 - 1.2 * lt * lt, p.vz * lt);
          });
          workshopAudio.playDrillPulse();

          drillProgress[activeIdx] = Math.min(1, drillProgress[activeIdx] + dt / 0.78);
          if (drillProgress[activeIdx] >= 1) {
            portDone[activeIdx] = true;
            individualPortMeshes[activeIdx].visible = true;
            drillTargetGroups[activeIdx].visible = false;
            workshopAudio.playSnapComplete();
          }
        } else {
          shavingsGroup.visible = false;
        }
      } else {
        animDrill.visible = false;
        shavingsGroup.visible = false;
      }

      const completedCount = portDone.filter(Boolean).length;
      return {
        stepDone: completedCount === portDone.length,
        subProgress: activeIdx !== null ? drillProgress[activeIdx] : 0,
        completedCount,
        totalCount: portDone.length,
      };
    }

    animSaw.visible = false;
    animDrill.visible = false;
    return { stepDone: false, subProgress: 0, completedCount: 0, totalCount: 0 };
  };

  const startActionAnim = (anim: RigActionAnim) => {
    activeAnim = anim;
    animElapsed = 0;

    if (anim === 'pouring') {
      animPitcher.visible = true;
      pourStream.visible = true;
    }
  };

  const update = (dt: number, time: number) => {
    if (activeAnim !== 'none') {
      animElapsed += dt;

      if (activeAnim === 'pouring') {
        const t = animElapsed;
        animPitcher.position.set(-0.56, PIPE_CENTER_Y + 0.44, 0);
        animPitcher.rotation.z = Math.min(0.95, t * 1.8);
        pourStream.visible = t > 0.15 && t < 1.15;
        const pulse = 0.85 + Math.sin(time * 26) * 0.14;
        pourStream.scale.set(pulse, 1, pulse);
        if (t > 1.25) {
          animPitcher.visible = false;
          pourStream.visible = false;
          activeAnim = 'none';
        }
      } else if (animElapsed > 0.7) {
        activeAnim = 'none';
      }
    }

    // Passive Water Level Stabilization -> Capillary Wicking -> Plant Growth
    if (currentStep === 'COMPLETE') {
      stabilizationElapsed += dt;

      if (waterProgress < targetWaterProgress) {
        waterProgress = Math.min(1, waterProgress + dt * 0.72);
        waterChannelGroup.visible = true;
      }

      // Hydrostatic damped stabilization wave settles to steady equilibrium waterline
      const settleAmp = Math.exp(-stabilizationElapsed * 1.4) * 0.08 * Math.cos(stabilizationElapsed * 6.5);
      waterChannelGroup.scale.y = Math.max(0.01, waterProgress * (1 + settleAmp));

      // Riser column drops smoothly from fill surge down to equalized channel waterline
      riserWaterGroup.visible = true;
      const headSurge = Math.exp(-stabilizationElapsed * 1.35) * 0.85;
      riserWaterGroup.scale.y = Math.max(0.28, 0.34 + headSurge);

      if (waterProgress > 0.35 && wickHydration < 1) {
        wickHydration = Math.min(1, wickHydration + dt * 0.52);
        portWickMats.forEach((m) => {
          m.color.copy(dryWickColor).lerp(wetWickColor, wickHydration);
        });
        portSubstrateMats.forEach((m) => {
          m.color.copy(drySubColor).lerp(wetSubColor, wickHydration);
        });
      }

      if (waterProgress > 0.45) {
        moisturePulses.forEach((p, idx) => {
          p.visible = true;
          const phase = (time * 0.55 + idx * 0.25) % 1;
          p.position.y = -0.125 + phase * 0.115;
          const s = 0.7 + Math.sin(phase * Math.PI) * 0.5;
          p.scale.set(s, s, s);
        });
      }

      if (wickHydration > 0.5 && growthProgress < 1) {
        growthProgress = Math.min(1, growthProgress + dt * 0.34);
      }

      if (growthProgress > 0.01) {
        plantSprouts.forEach((sprout, idx) => {
          sprout.visible = true;
          const eased = 1 - Math.pow(1 - growthProgress, 2.2);
          const s = 0.1 + eased * 0.95;
          sprout.scale.set(s, s, s);
          sprout.rotation.z = Math.sin(time * 1.4 + idx * 1.3) * 0.035 * eased;
          sprout.rotation.x = Math.cos(time * 1.1 + idx * 0.9) * 0.025 * eased;
        });
      }
    }

    if (cutawayEnabled && waterChannelGroup.visible) {
      waterBar.position.y = 0.029 + Math.sin(time * 2.2) * 0.0012;
    }
  };

  const dispose = () => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    disposableGeoms.forEach((g) => g.dispose());
    disposableMats.forEach((m) => m.dispose());
  };

  setStepState('GET_SAW', false);

  return {
    group,
    setStepState,
    startActionAnim,
    getRaycastTargets,
    stepManualTool,
    update,
    dispose,
  };
}
