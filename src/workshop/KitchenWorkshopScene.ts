import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ActiveZone } from '../firebase/firebaseClient';
import { workshopAudio } from './audio';
import {
  buildCompostStation,
  type CompostAnchorTarget,
  type CompostStationHandle,
  type CompostTimedAnimKind,
} from './compostStationBuilder';
import {
  DEFAULT_DOOR3_PROGRESS,
  type CompostContainerType,
  type Door3ProgressState,
  type DripBottleType,
  type MulchMaterialType,
} from './compostData';
import type { TierSaveState } from './crops';
import {
  buildGardenYard,
  type GardenResilienceState,
  type GardenYardHandle,
} from './gardenYardBuilder';
import { buildHydroponicRig, type HydroponicRigHandle } from './hydroponicRigBuilder';
import { buildKitchenWorkshopRoom, type AABB, type KitchenRoomHandle } from './kitchenRoomBuilder';
import { createWorkshopMaterials, type WorkshopMaterials } from './materials';
import { BUILD_STEPS, type BuildStepId, type GradeTier, type ToolId } from './steps';
import { workshopVoiceover } from './voiceover';

export type GardenTargetKind = 'rack' | 'jojo' | 'weather' | 'kitchen_door' | 'compost_door' | null;
export type CompostTargetKind = CompostAnchorTarget | null;

export interface WorkshopHudState {
  activeZone: ActiveZone;
  stepId: BuildStepId;
  toolId: ToolId;
  inRange: boolean;
  isBusy: boolean;
  cutawayMode: boolean;
  cutawayAvailable: boolean;
  targetLabel: string;
  manualAimMode: boolean;
  reticleAligned: boolean;
  subProgress: number;
  completedSubSteps: number;
  totalSubSteps: number;
  gardenTarget: GardenTargetKind;
  compostTarget: CompostTargetKind;
}

const ROOM_BOUNDS = {
  minX: -4.2,
  maxX: 4.2,
  minZ: -4.05,
  maxZ: 3.9,
};

const GARDEN_BOUNDS = {
  minX: -4.45,
  maxX: 4.45,
  minZ: -3.95,
  maxZ: 4.05,
};

const PLAYER_EYE_Y = 1.62;
const PLAYER_RADIUS = 0.34;
const WALK_SPEED = 3.05;

export interface SceneCallbacks {
  onHudChange: (state: WorkshopHudState) => void;
  onKitchenStepPersisted: (step: BuildStepId) => void;
  onZoneChanged: (zone: ActiveZone) => void;
  onOpenRackManager: () => void;
  onOpenCompostStation: (workstation?: 1 | 2 | 3) => void;
  onDoor3Update: (
    updater: (prev: Door3ProgressState) => Door3ProgressState,
    bonusLitres?: number,
    narration?: string
  ) => void;
}

export class KitchenWorkshopScene {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private pmremGenerator!: THREE.PMREMGenerator;
  private envRenderTarget!: THREE.WebGLRenderTarget;
  private mats!: WorkshopMaterials;
  private room!: KitchenRoomHandle;
  private rig!: HydroponicRigHandle;
  private garden!: GardenYardHandle;
  private compost!: CompostStationHandle;

  private isSoftwareGl = false;
  private disposed = false;
  private rafId: number | null = null;
  private timerId: number | null = null;
  private lastTimeMs = 0;
  private worldTime = 0;

  // Player & Input state
  private yaw = 0;
  private pitch = -0.15;
  private keys = new Set<string>();
  private stickX = 0;
  private stickY = 0;
  private actionHeld = false;

  // Workflow state
  private activeZone: ActiveZone = 'kitchen';
  private stepId: BuildStepId = 'GET_SAW';
  private toolId: ToolId = 'none';
  private isBusy = false;
  private isFillingSink = false;
  private cutawayMode = false;
  private busyTimeoutId: number | null = null;
  private gardenTarget: GardenTargetKind = null;
  private compostTarget: CompostTargetKind = null;
  private door3Progress: Door3ProgressState = { ...DEFAULT_DOOR3_PROGRESS };
  private resilience: GardenResilienceState = {
    jojoInstalled: false,
    jojoLitres: 18,
    jojoCapacity: 60,
    shadeClothInstalled: false,
    weatherMode: 'normal',
  };

  // Manual reticle aiming state
  private alignedTargetIndex: number | null = null;
  private subProgress = 0;
  private completedSubSteps = 0;
  private totalSubSteps = 0;

  // Throttled HUD diff trackers
  private lastInRange = false;
  private lastAligned = false;
  private lastCompletedSub = -1;
  private lastEmittedProgress = -1;
  private lastGardenTarget: GardenTargetKind = null;
  private lastCompostTarget: CompostTargetKind = null;

  // Pre-allocated math helpers
  private readonly forwardVec = new THREE.Vector3();
  private readonly rightVec = new THREE.Vector3();
  private readonly moveVec = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly centerNdc = new THREE.Vector2(0, 0);
  private readonly ndcPointer = new THREE.Vector2();

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.initRenderer();
    this.initScene();
    this.bindEvents();
    this.emitState(true);
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl2 = probe.getContext('webgl2');
      if (gl2) {
        const dbg = gl2.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          const rendererStr = String(gl2.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
          return /SwiftShader|llvmpipe|Software|Mesa/i.test(rendererStr);
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  private initRenderer(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight
    );

    if (!this.isSoftwareGl) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } else {
      this.renderer.shadowMap.enabled = false;
    }

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x212830);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(62, w / Math.max(1, h), 0.08, 45);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, PLAYER_EYE_Y, 2.35);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = this.pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();

    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6f5a46, 0.78);
    this.scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfff5e4, 1.35);
    sunLight.position.set(-1.9, 4.2, -5.2);
    sunLight.target.position.set(0, 0.9, 0);
    this.scene.add(sunLight.target);
    if (!this.isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 16;
      sunLight.shadow.camera.left = -5;
      sunLight.shadow.camera.right = 5;
      sunLight.shadow.camera.top = 5;
      sunLight.shadow.camera.bottom = -5;
      sunLight.shadow.bias = -0.0005;
    }
    this.scene.add(sunLight);

    [-0.68, 0.68].forEach((px) => {
      const pLight = new THREE.PointLight(0xffdfb0, 2.2, 7.5, 1.5);
      pLight.position.set(px, 2.04, 0);
      this.scene.add(pLight);
    });

    const fillLight = new THREE.DirectionalLight(0xd9e8f5, 0.5);
    fillLight.position.set(2.5, 2.8, 3.6);
    this.scene.add(fillLight);

    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy() || 1);
    this.mats = createWorkshopMaterials(this.renderer);
    this.room = buildKitchenWorkshopRoom(this.mats, maxAniso);
    this.scene.add(this.room.group);

    this.rig = buildHydroponicRig(this.mats);
    this.scene.add(this.rig.group);

    this.garden = buildGardenYard(this.mats, maxAniso);
    this.garden.group.visible = false;
    this.scene.add(this.garden.group);

    this.compost = buildCompostStation(this.mats, maxAniso);
    this.compost.group.visible = false;
    this.scene.add(this.compost.group);
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleWindowBlur = (): void => {
    this.keys.clear();
    this.actionHeld = false;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Do not intercept keys while typing inside farmer login inputs
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    workshopAudio.unlock();
    workshopVoiceover.unlockAndSpeakPending();
    const code = e.code;
    this.keys.add(code);

    if (code === 'KeyE' || code === 'Space') {
      e.preventDefault();
      if (this.isManualAimStep()) {
        this.actionHeld = true;
      } else if (!e.repeat) {
        this.triggerCurrentAction();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const code = e.code;
    this.keys.delete(code);
    if (code === 'KeyE' || code === 'Space') {
      this.actionHeld = false;
    }
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.stopLoop();
  };

  private handleContextRestored = (): void => {
    this.startLoop();
  };

  // Hydration from Firestore Farmer Profile
  public applySavedProfile(
    zone: ActiveZone,
    kitchenStep: BuildStepId,
    rackSize: number,
    tiers: TierSaveState[],
    announce: boolean,
    resilience?: GardenResilienceState,
    door3Progress?: Door3ProgressState
  ): void {
    this.stepId = kitchenStep;
    if (resilience) {
      this.resilience = resilience;
    }
    if (door3Progress) {
      this.door3Progress = door3Progress;
    }
    this.toolId =
      kitchenStep === 'CUT_AND_ASSEMBLE_PVC'
        ? 'hacksaw'
        : kitchenStep === 'DRILL_PORTS'
          ? 'drill'
          : kitchenStep === 'THREAD_WICKS_AND_PLANT'
            ? 'wicks'
            : kitchenStep === 'FILL_AT_SINK'
              ? 'pitcher_empty'
              : kitchenStep === 'POUR_AND_GROW'
                ? 'pitcher_full'
                : 'none';

    this.room.setActiveStepVisuals(this.stepId, false);
    this.rig.setStepState(this.stepId, this.cutawayMode);
    this.garden.setGardenState(rackSize, tiers, this.cutawayMode, this.resilience);
    this.compost.setProgress(this.door3Progress);
    this.switchZone(zone, false);
    this.emitState(true);

    if (announce) {
      if (zone === 'kitchen') {
        workshopVoiceover.speakStep(this.stepId, true);
      } else if (zone === 'garden') {
        workshopVoiceover.speakCustom(
          'Welcome back to your Outdoor Garden Yard! Inspect your vertical rack, JoJo rainwater tank, and El Niño forecast station.'
        );
      } else {
        workshopVoiceover.speakCustom(
          'Welcome to Door 3: Recycling & Composting Station! Prevention is better than cure—build a 2L drip bottle, compost pile, and mulch shield.'
        );
      }
    }
  }

  public syncGardenTiers(
    rackSize: number,
    tiers: TierSaveState[],
    resilience?: GardenResilienceState
  ): void {
    if (resilience) {
      this.resilience = resilience;
      if (this.activeZone === 'garden' || this.activeZone === 'compost') {
        this.applyGardenAtmosphere();
      }
    }
    this.garden.setGardenState(rackSize, tiers, this.cutawayMode, this.resilience);
  }

  public syncCompostProgress(progress: Door3ProgressState): void {
    this.door3Progress = progress;
    this.compost.setProgress(progress);
    this.emitState(true);
  }

  public selectDoor3Bottle(bottleId: DripBottleType): void {
    if (this.isBusy) return;
    workshopAudio.playPickup();
    this.compost.startActionAnim('ws1_bottle_select');
    this.callbacks.onDoor3Update((prev) => ({
      ...prev,
      dripBottleType: bottleId,
      dripStep: Math.max(prev.dripStep, 1),
    }));
  }

  public selectDoor3Container(containerId: CompostContainerType): void {
    if (this.isBusy) return;
    workshopAudio.playSnapComplete();
    this.compost.startActionAnim('ws2_container');
    this.callbacks.onDoor3Update((prev) => ({
      ...prev,
      compostContainer: containerId,
      compostStep: Math.max(prev.compostStep, 1),
    }));
  }

  public selectDoor3Mulch(mulchId: MulchMaterialType): void {
    if (this.isBusy) return;
    workshopAudio.playPickup();
    this.callbacks.onDoor3Update((prev) => ({
      ...prev,
      mulchMaterial: mulchId,
      mulchStep: Math.max(prev.mulchStep, 1),
    }));
  }

  private playDoor3TimedStep(
    animKind: CompostTimedAnimKind,
    durationMs: number,
    updater: (prev: Door3ProgressState) => Door3ProgressState,
    bonusLitres = 0,
    narration?: string
  ): void {
    this.isBusy = true;
    this.emitState(true);
    this.compost.startActionAnim(animKind);
    this.scheduleStepCompletion(durationMs, () => {
      this.callbacks.onDoor3Update(updater, bonusLitres, narration);
      this.emitState(true);
    });
  }

  private applyGardenAtmosphere(): void {
    const skyHex =
      this.resilience.weatherMode === 'heatwave'
        ? 0xd69f6e
        : this.resilience.weatherMode === 'elnino_watch'
          ? 0xb6c5c2
          : 0x87c3e8;
    this.scene.background = new THREE.Color(skyHex);
    this.scene.fog = new THREE.FogExp2(skyHex, this.resilience.weatherMode === 'heatwave' ? 0.032 : 0.024);
  }

  public switchZone(zone: ActiveZone, persist = true): void {
    this.activeZone = zone;
    const isKitchen = zone === 'kitchen';
    const isGarden = zone === 'garden';
    const isCompost = zone === 'compost';

    this.room.group.visible = isKitchen;
    this.rig.group.visible = isKitchen;
    this.garden.group.visible = isGarden;
    this.compost.group.visible = isCompost;

    if (isKitchen) {
      this.scene.background = new THREE.Color(0x212830);
      this.scene.fog = null;
      this.camera.position.set(0, PLAYER_EYE_Y, 2.35);
      this.yaw = 0;
      this.pitch = -0.15;
    } else {
      this.applyGardenAtmosphere();
      this.camera.position.set(0, PLAYER_EYE_Y, 2.3);
      this.yaw = 0;
      this.pitch = -0.12;
    }

    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.actionHeld = false;
    this.emitState(true);

    if (persist) {
      this.callbacks.onZoneChanged(zone);
    }
  }

  public startNewPipeInKitchen(): void {
    this.stepId = 'GET_SAW';
    this.toolId = 'none';
    this.isBusy = false;
    this.isFillingSink = false;
    this.room.setActiveStepVisuals('GET_SAW', false);
    this.rig.setStepState('GET_SAW', this.cutawayMode);
    this.switchZone('kitchen', true);
    this.callbacks.onKitchenStepPersisted('GET_SAW');
    workshopVoiceover.speakStep('GET_SAW', false);
  }

  public clearCompletedPipeSilently(): void {
    this.stepId = 'GET_SAW';
    this.toolId = 'none';
    this.isBusy = false;
    this.isFillingSink = false;
    this.room.setActiveStepVisuals('GET_SAW', false);
    this.rig.setStepState('GET_SAW', this.cutawayMode);
    this.emitState(true);
  }

  public setThumbstickInput(x: number, y: number): void {
    workshopVoiceover.unlockAndSpeakPending();
    this.stickX = x;
    this.stickY = y;
  }

  public applyLookDelta(dx: number, dy: number): void {
    workshopVoiceover.unlockAndSpeakPending();
    const sens = 0.0042;
    this.yaw -= dx * sens;
    this.pitch = Math.max(-1.12, Math.min(1.02, this.pitch - dy * sens));
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  public setActionHeld(held: boolean): void {
    if (held) {
      workshopAudio.unlock();
      workshopVoiceover.unlockAndSpeakPending();
    }
    this.actionHeld = held;
    if (held && !this.isManualAimStep()) {
      this.triggerCurrentAction();
    }
  }

  public tryInteractAtScreenPoint(clientX: number, clientY: number): void {
    workshopAudio.unlock();
    workshopVoiceover.unlockAndSpeakPending();

    if (this.activeZone === 'garden') {
      if (this.gardenTarget === 'kitchen_door') {
        this.switchZone('kitchen', true);
      } else if (this.gardenTarget === 'compost_door') {
        this.switchZone('compost', true);
      } else if (this.gardenTarget !== null) {
        this.callbacks.onOpenRackManager();
      }
      return;
    }

    if (this.activeZone === 'compost') {
      if (this.isBusy) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.ndcPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.ndcPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.ndcPointer, this.camera);
        const hits = this.raycaster.intersectObjects(this.compost.interactableObjects, true);
        if (hits.length > 0) {
          const ud = hits[0].object.userData;
          if (ud.compostAction === 'garden_door' && this.compostTarget === 'garden_door') {
            this.switchZone('garden', true);
            return;
          }
          if (ud.compostAction === 'select_bottle' && this.compostTarget === 'drip_bench') {
            this.selectDoor3Bottle(ud.bottleId as DripBottleType);
            return;
          }
          if (ud.compostAction === 'select_container' && this.compostTarget === 'compost_bay') {
            this.selectDoor3Container(ud.containerId as CompostContainerType);
            return;
          }
          if (ud.compostAction === 'select_mulch' && this.compostTarget === 'mulch_bench') {
            this.selectDoor3Mulch(ud.mulchId as MulchMaterialType);
            return;
          }
          if (
            (ud.compostAction === 'ws1_bed' && this.compostTarget === 'drip_bench') ||
            (ud.compostAction === 'ws2_bay' && this.compostTarget === 'compost_bay') ||
            (ud.compostAction === 'ws3_bed' && this.compostTarget === 'mulch_bench')
          ) {
            if (!this.isManualAimStep()) {
              this.triggerCurrentAction();
            }
            return;
          }
        }
      }
      if (this.compostTarget === 'garden_door') {
        this.switchZone('garden', true);
      } else if (this.compostTarget !== null && !this.isManualAimStep()) {
        this.triggerCurrentAction();
      }
      return;
    }

    if (this.isManualAimStep()) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.ndcPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndcPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndcPointer, this.camera);

    const hits = this.raycaster.intersectObjects(this.room.interactableObjects, true);
    if (hits.length === 0) return;

    const hitZone = hits[0].object.userData.targetZone as string | undefined;
    if (hitZone === 'garden_exit') {
      const exitAnchor = this.room.targetZones.garden_exit;
      if (
        Math.hypot(
          this.camera.position.x - exitAnchor.position.x,
          this.camera.position.z - exitAnchor.position.z
        ) <= exitAnchor.interactRadius
      ) {
        this.switchZone('garden', true);
        return;
      }
    }

    const activeZone = BUILD_STEPS[this.stepId].targetZone;
    if (hitZone === activeZone && this.checkInRange()) {
      this.triggerCurrentAction();
    }
  }

  public setGradeTier(tier: GradeTier): void {
    workshopVoiceover.setGradeTier(tier);
    this.emitState(true);
  }

  public replayVoiceover(): void {
    workshopAudio.unlock();
    workshopVoiceover.unlockAndSpeakPending();
    if (this.activeZone === 'garden') {
      workshopVoiceover.speakCustom(
        'Here in the Garden Yard, choose a 2 to 6 tier stand, deploy each PVC pipe you fabricate, plant from 10 El Niño-resilient seeds, or head through Door 3 to build drip bottles, compost, and mulch!'
      );
      return;
    }
    if (this.activeZone === 'compost') {
      workshopVoiceover.speakCustom(
        'Prevention is better than cure! Complete all 3 Door 3 workstations: punch & bury a 2L drip-feeder, layer a 2:1 Brown-to-Green composter, and lock in moisture with cardboard & leaf mulch.'
      );
      return;
    }
    workshopVoiceover.speakStep(this.stepId, false);
  }

  public setCutawayMode(enabled: boolean): void {
    this.cutawayMode = enabled;
    this.rig.setStepState(this.stepId, this.cutawayMode);
    if (enabled && (this.stepId === 'COMPLETE' || this.stepId === 'POUR_AND_GROW')) {
      workshopVoiceover.speakCutawayInsight();
    }
    this.emitState(true);
  }

  public toggleCutawayMode(): void {
    this.setCutawayMode(!this.cutawayMode);
  }

  public resetWorkshop(): void {
    if (this.busyTimeoutId !== null) {
      window.clearTimeout(this.busyTimeoutId);
      this.busyTimeoutId = null;
    }
    this.startNewPipeInKitchen();
  }

  public triggerCurrentAction(): void {
    if (this.isBusy) return;
    workshopAudio.unlock();
    workshopVoiceover.unlockAndSpeakPending();

    if (this.activeZone === 'garden') {
      if (this.gardenTarget === 'kitchen_door') {
        this.switchZone('kitchen', true);
      } else if (this.gardenTarget === 'compost_door') {
        this.switchZone('compost', true);
      } else {
        this.callbacks.onOpenRackManager();
      }
      return;
    }

    if (this.activeZone === 'compost') {
      if (this.compostTarget === 'garden_door') {
        this.switchZone('garden', true);
        return;
      }
      if (this.compostTarget === 'drip_bench') {
        const s = this.door3Progress.dripStep;
        if (s === 0) {
          this.selectDoor3Bottle('clear_soda');
        } else if (s === 2) {
          workshopAudio.playPlanting();
          this.playDoor3TimedStep(
            'ws1_bury',
            1150,
            (prev) => ({ ...prev, dripStep: Math.max(prev.dripStep, 3) }),
            0,
            'Half the bottle is now buried beside the roots! Next, fill it with water and screw the pinhole cap.'
          );
        } else if (s === 3) {
          workshopAudio.playPourAndBloom();
          this.playDoor3TimedStep(
            'ws1_pour_cap',
            1350,
            (prev) => ({ ...prev, dripStep: 4 }),
            12,
            'Workstation 1 complete! Underground root dripping cuts El Niño surface evaporation by up to 70%.'
          );
        } else if (s >= 4) {
          this.callbacks.onOpenCompostStation(1);
        }
        return;
      }
      if (this.compostTarget === 'compost_bay') {
        const s = this.door3Progress.compostStep;
        if (s === 0) {
          this.selectDoor3Container('crate');
        } else if (s === 1) {
          workshopAudio.playPlanting();
          this.playDoor3TimedStep(
            'ws2_gather',
            850,
            (prev) => ({ ...prev, compostStep: Math.max(prev.compostStep, 2) }),
            0,
            'Greens from Door 1 Kitchen and Browns from Door 2 Yard are staged! Now layer twigs at the base.'
          );
        } else if (s === 2) {
          workshopAudio.playPickup();
          this.playDoor3TimedStep('ws2_twigs', 850, (prev) => ({
            ...prev,
            compostStep: Math.max(prev.compostStep, 3),
          }));
        } else if (s === 3) {
          workshopAudio.playPlanting();
          this.playDoor3TimedStep('ws2_greens', 850, (prev) => ({
            ...prev,
            compostStep: Math.max(prev.compostStep, 4),
          }));
        } else if (s === 4) {
          workshopAudio.playPlanting();
          this.playDoor3TimedStep('ws2_browns', 850, (prev) => ({
            ...prev,
            compostStep: Math.max(prev.compostStep, 5),
          }));
        } else if (s === 5) {
          workshopAudio.playMistSpray();
          this.playDoor3TimedStep(
            'ws2_mist',
            1150,
            (prev) => ({ ...prev, compostStep: 6 }),
            10,
            'Workstation 2 complete! Your 2:1 Browns-to-Greens pile stays aerobic, damp, and sweet-smelling.'
          );
        } else {
          this.callbacks.onOpenCompostStation(2);
        }
        return;
      }
      if (this.compostTarget === 'mulch_bench') {
        const s = this.door3Progress.mulchStep;
        if (s === 0) {
          this.selectDoor3Mulch('cardboard');
        } else if (s === 2) {
          workshopAudio.playSnapComplete();
          this.playDoor3TimedStep(
            'ws3_place_collar',
            900,
            (prev) => ({ ...prev, mulchStep: Math.max(prev.mulchStep, 3) }),
            0,
            'Collar wrapped neatly around the plant stem beside the drip bottle! Cover it with dry leaves to anchor it.'
          );
        } else if (s === 3) {
          workshopAudio.playPourAndBloom();
          this.playDoor3TimedStep(
            'ws3_scatter_leaves',
            1150,
            (prev) => ({ ...prev, mulchStep: 4 }),
            18,
            'All 3 Door 3 workstations complete! Prevention is better than cure—roots stay fed, dripped, and sun-shielded.'
          );
        } else if (s >= 4) {
          this.callbacks.onOpenCompostStation(3);
        }
        return;
      }
      this.callbacks.onOpenCompostStation();
      return;
    }

    if (this.isManualAimStep()) return;

    if (this.stepId === 'COMPLETE') {
      if (this.checkInRange()) {
        this.switchZone('garden', true);
      } else {
        this.toggleCutawayMode();
      }
      return;
    }

    if (!this.checkInRange()) return;

    switch (this.stepId) {
      case 'GET_SAW': {
        workshopAudio.playPickup();
        this.toolId = 'hacksaw';
        this.advanceTo('CUT_AND_ASSEMBLE_PVC');
        break;
      }
      case 'GET_DRILL': {
        workshopAudio.playPickup();
        this.toolId = 'drill';
        this.advanceTo('DRILL_PORTS');
        break;
      }
      case 'GET_WICKS': {
        workshopAudio.playPickup();
        this.toolId = 'wicks';
        this.advanceTo('THREAD_WICKS_AND_PLANT');
        break;
      }
      case 'THREAD_WICKS_AND_PLANT': {
        this.isBusy = true;
        this.emitState(true);
        workshopAudio.playPlanting();
        this.rig.startActionAnim('wicking');
        this.scheduleStepCompletion(680, () => {
          this.toolId = 'pitcher_empty';
          this.advanceTo('FILL_AT_SINK');
        });
        break;
      }
      case 'FILL_AT_SINK': {
        this.isBusy = true;
        this.isFillingSink = true;
        this.room.setActiveStepVisuals(this.stepId, true);
        this.emitState(true);
        workshopAudio.playSinkFill();
        this.scheduleStepCompletion(1350, () => {
          this.isFillingSink = false;
          this.toolId = 'pitcher_full';
          this.advanceTo('POUR_AND_GROW');
        });
        break;
      }
      case 'POUR_AND_GROW': {
        this.isBusy = true;
        this.emitState(true);
        workshopAudio.playPourAndBloom();
        this.rig.startActionAnim('pouring');
        this.scheduleStepCompletion(1250, () => {
          this.toolId = 'none';
          this.advanceTo('COMPLETE');
        });
        break;
      }
    }
  }

  private isManualAimStep(): boolean {
    if (this.activeZone === 'kitchen') {
      return this.stepId === 'CUT_AND_ASSEMBLE_PVC' || this.stepId === 'DRILL_PORTS';
    }
    if (this.activeZone === 'compost') {
      return (
        (this.compostTarget === 'drip_bench' && this.door3Progress.dripStep === 1) ||
        (this.compostTarget === 'mulch_bench' && this.door3Progress.mulchStep === 1)
      );
    }
    return false;
  }

  private scheduleStepCompletion(delayMs: number, fn: () => void): void {
    if (this.busyTimeoutId !== null) {
      window.clearTimeout(this.busyTimeoutId);
    }
    this.busyTimeoutId = window.setTimeout(() => {
      this.busyTimeoutId = null;
      if (this.disposed) return;
      this.isBusy = false;
      fn();
    }, delayMs);
  }

  private advanceTo(next: BuildStepId): void {
    this.stepId = next;
    this.actionHeld = false;
    this.alignedTargetIndex = null;
    this.subProgress = 0;
    this.completedSubSteps = 0;
    this.totalSubSteps = next === 'CUT_AND_ASSEMBLE_PVC' ? 2 : next === 'DRILL_PORTS' ? 4 : 0;

    this.room.setActiveStepVisuals(this.stepId, this.isFillingSink);
    this.rig.setStepState(this.stepId, this.cutawayMode);
    this.emitState(true);
    this.callbacks.onKitchenStepPersisted(next);
    workshopVoiceover.speakStep(next, false);
  }

  private checkInRange(): boolean {
    if (this.activeZone === 'garden') {
      return this.gardenTarget !== null;
    }
    if (this.activeZone === 'compost') {
      return this.compostTarget !== null;
    }
    const zoneId = BUILD_STEPS[this.stepId].targetZone;
    const anchor = this.room.targetZones[zoneId];
    const dx = this.camera.position.x - anchor.position.x;
    const dz = this.camera.position.z - anchor.position.z;
    return Math.hypot(dx, dz) <= anchor.interactRadius;
  }

  private updateGardenProximity(): void {
    if (this.activeZone !== 'garden') {
      this.gardenTarget = null;
      return;
    }
    const distRack = Math.hypot(
      this.camera.position.x - this.garden.rackAnchor.x,
      this.camera.position.z - this.garden.rackAnchor.z
    );
    const distJojo = Math.hypot(
      this.camera.position.x - this.garden.jojoAnchor.x,
      this.camera.position.z - this.garden.jojoAnchor.z
    );
    const distWeather = Math.hypot(
      this.camera.position.x - this.garden.weatherAnchor.x,
      this.camera.position.z - this.garden.weatherAnchor.z
    );
    const distDoor = Math.hypot(
      this.camera.position.x - this.garden.kitchenDoorAnchor.x,
      this.camera.position.z - this.garden.kitchenDoorAnchor.z
    );
    const distCompostDoor = Math.hypot(
      this.camera.position.x - this.garden.compostDoorAnchor.x,
      this.camera.position.z - this.garden.compostDoorAnchor.z
    );
    if (distCompostDoor <= 2.1) {
      this.gardenTarget = 'compost_door';
    } else if (distDoor <= 2.1) {
      this.gardenTarget = 'kitchen_door';
    } else if (distJojo <= 2.35) {
      this.gardenTarget = 'jojo';
    } else if (distWeather <= 2.35) {
      this.gardenTarget = 'weather';
    } else if (distRack <= 3.1) {
      this.gardenTarget = 'rack';
    } else {
      this.gardenTarget = null;
    }
  }

  private updateCompostProximity(): void {
    if (this.activeZone !== 'compost') {
      this.compostTarget = null;
      return;
    }
    const distDrip = Math.hypot(
      this.camera.position.x - this.compost.anchors.drip_bench.x,
      this.camera.position.z - this.compost.anchors.drip_bench.z
    );
    const distCompost = Math.hypot(
      this.camera.position.x - this.compost.anchors.compost_bay.x,
      this.camera.position.z - this.compost.anchors.compost_bay.z
    );
    const distMulch = Math.hypot(
      this.camera.position.x - this.compost.anchors.mulch_bench.x,
      this.camera.position.z - this.compost.anchors.mulch_bench.z
    );
    const distGardenDoor = Math.hypot(
      this.camera.position.x - this.compost.anchors.garden_door.x,
      this.camera.position.z - this.compost.anchors.garden_door.z
    );

    if (distGardenDoor <= 2.1) {
      this.compostTarget = 'garden_door';
    } else if (distDrip <= 2.35) {
      this.compostTarget = 'drip_bench';
    } else if (distCompost <= 2.45) {
      this.compostTarget = 'compost_bay';
    } else if (distMulch <= 2.35) {
      this.compostTarget = 'mulch_bench';
    } else {
      this.compostTarget = null;
    }
  }

  private updateManualAimAndTool(dt: number): void {
    if (!this.isManualAimStep()) {
      this.alignedTargetIndex = null;
      this.subProgress = 0;
      this.completedSubSteps = 0;
      this.totalSubSteps = 0;
      return;
    }

    const inRange = this.checkInRange();
    if (this.activeZone === 'compost') {
      if (inRange) {
        const targets = this.compost.getRaycastTargets(this.door3Progress);
        this.raycaster.setFromCamera(this.centerNdc, this.camera);
        this.raycaster.far = 4.2;
        const hits = this.raycaster.intersectObjects(targets, false);
        this.alignedTargetIndex =
          hits.length > 0 ? (hits[0].object.userData.targetIndex as number) : null;
        this.raycaster.far = Infinity;
      } else {
        this.alignedTargetIndex = null;
      }

      const res = this.compost.stepManualTool(
        this.door3Progress,
        dt,
        this.worldTime,
        this.alignedTargetIndex,
        inRange && this.actionHeld
      );
      this.subProgress = res.subProgress;
      this.completedSubSteps = res.completedCount;
      this.totalSubSteps = res.totalCount;

      if (res.stepDone) {
        this.actionHeld = false;
        if (this.compostTarget === 'drip_bench' && this.door3Progress.dripStep === 1) {
          this.callbacks.onDoor3Update(
            (prev) => ({ ...prev, dripStep: Math.max(prev.dripStep, 2) }),
            0,
            '3 pinholes pierced! Next, bury the bottom half of the bottle right next to the plant roots.'
          );
        } else if (this.compostTarget === 'mulch_bench' && this.door3Progress.mulchStep === 1) {
          this.callbacks.onDoor3Update(
            (prev) => ({ ...prev, mulchStep: Math.max(prev.mulchStep, 2) }),
            0,
            'Plant collar and center slit cut! Wrap it flat around the stem next to your drip bottle.'
          );
        }
      }
      return;
    }

    if (inRange) {
      const targets = this.rig.getRaycastTargets();
      this.raycaster.setFromCamera(this.centerNdc, this.camera);
      this.raycaster.far = 3.2;
      const hits = this.raycaster.intersectObjects(targets, false);
      this.alignedTargetIndex =
        hits.length > 0 ? (hits[0].object.userData.targetIndex as number) : null;
      this.raycaster.far = Infinity;
    } else {
      this.alignedTargetIndex = null;
    }

    const res = this.rig.stepManualTool(
      dt,
      this.worldTime,
      this.alignedTargetIndex,
      inRange && this.actionHeld
    );
    this.subProgress = res.subProgress;
    this.completedSubSteps = res.completedCount;
    this.totalSubSteps = res.totalCount;

    if (res.stepDone) {
      this.toolId = 'none';
      if (this.stepId === 'CUT_AND_ASSEMBLE_PVC') {
        this.advanceTo('GET_DRILL');
      } else if (this.stepId === 'DRILL_PORTS') {
        this.advanceTo('GET_WICKS');
      }
    }
  }

  private getCompostActionLabel(): string {
    if (this.compostTarget === 'garden_door') return 'Back to Door 2 Garden';
    if (this.compostTarget === 'drip_bench') {
      const s = this.door3Progress.dripStep;
      if (s === 0) return 'Pick 2L Bottle';
      if (s === 1) return 'Hold: Poke Pinhole';
      if (s === 2) return 'Bury Next to Roots';
      if (s === 3) return 'Pour Water & Cap';
      return 'View 2L Drip Guide';
    }
    if (this.compostTarget === 'compost_bay') {
      const s = this.door3Progress.compostStep;
      if (s === 0) return 'Place Composter';
      if (s === 1) return 'Gather Greens & Browns';
      if (s === 2) return 'Add Twigs Base';
      if (s === 3) return 'Add 1 Part Greens';
      if (s === 4) return 'Add 2 Parts Browns';
      if (s === 5) return 'Mist Compost Pile';
      return 'Check Avoid Traps';
    }
    if (this.compostTarget === 'mulch_bench') {
      const s = this.door3Progress.mulchStep;
      if (s === 0) return 'Pick Cardboard / Paper';
      if (s === 1) return 'Hold: Cut Slit Collar';
      if (s === 2) return 'Place Around Stem';
      if (s === 3) return 'Cover with Dry Leaves';
      return 'View Mulch Shield';
    }
    return 'Walk to a Workstation';
  }

  private emitState(force = false): void {
    const inRange = this.checkInRange();
    const reticleAligned = this.alignedTargetIndex !== null && inRange;
    const progressChanged = Math.abs(this.subProgress - this.lastEmittedProgress) >= 0.04;

    if (
      !force &&
      inRange === this.lastInRange &&
      reticleAligned === this.lastAligned &&
      this.completedSubSteps === this.lastCompletedSub &&
      this.gardenTarget === this.lastGardenTarget &&
      this.compostTarget === this.lastCompostTarget &&
      !progressChanged
    ) {
      return;
    }

    this.lastInRange = inRange;
    this.lastAligned = reticleAligned;
    this.lastCompletedSub = this.completedSubSteps;
    this.lastEmittedProgress = this.subProgress;
    this.lastGardenTarget = this.gardenTarget;
    this.lastCompostTarget = this.compostTarget;

    const stepDef = BUILD_STEPS[this.stepId];
    const cutawayAvailable =
      this.activeZone === 'garden' ||
      (this.activeZone === 'kitchen' && this.stepId !== 'GET_SAW' && this.stepId !== 'CUT_AND_ASSEMBLE_PVC');

    const targetLabel =
      this.activeZone === 'garden'
        ? this.gardenTarget === 'compost_door'
          ? 'Enter Door 3: Compost'
          : this.gardenTarget === 'kitchen_door'
            ? 'Enter Kitchen Lab'
            : this.gardenTarget === 'jojo'
              ? 'JoJo Rain Tank'
              : this.gardenTarget === 'weather'
                ? 'El Niño Forecast'
                : 'Manage Rack & Crops'
        : this.activeZone === 'compost'
          ? this.getCompostActionLabel()
          : this.room.targetZones[stepDef.targetZone].label;

    this.callbacks.onHudChange({
      activeZone: this.activeZone,
      stepId: this.stepId,
      toolId: this.toolId,
      inRange,
      isBusy: this.isBusy,
      cutawayMode: this.cutawayMode,
      cutawayAvailable,
      targetLabel,
      manualAimMode: this.isManualAimStep(),
      reticleAligned,
      subProgress: this.subProgress,
      completedSubSteps: this.completedSubSteps,
      totalSubSteps: this.totalSubSteps,
      gardenTarget: this.gardenTarget,
      compostTarget: this.compostTarget,
    });
  }

  private updateMovement(dt: number): void {
    let kbX = 0;
    let kbY = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kbY += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kbY -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kbX += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kbX -= 1;

    let ix = kbX + this.stickX;
    let iy = kbY + this.stickY;
    const mag = Math.hypot(ix, iy);
    if (mag > 1) {
      ix /= mag;
      iy /= mag;
    }

    if (mag < 0.01) return;

    const bounds = this.activeZone === 'kitchen' ? ROOM_BOUNDS : GARDEN_BOUNDS;
    const colliders =
      this.activeZone === 'kitchen'
        ? this.room.colliders
        : this.activeZone === 'garden'
          ? this.garden.colliders
          : this.compost.colliders;

    this.forwardVec.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.rightVec.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.moveVec
      .set(0, 0, 0)
      .addScaledVector(this.forwardVec, iy * WALK_SPEED * dt)
      .addScaledVector(this.rightVec, ix * WALK_SPEED * dt);

    const nextX = THREE.MathUtils.clamp(
      this.camera.position.x + this.moveVec.x,
      bounds.minX,
      bounds.maxX
    );
    if (!this.collidesAny(nextX, this.camera.position.z, colliders)) {
      this.camera.position.x = nextX;
    }

    const nextZ = THREE.MathUtils.clamp(
      this.camera.position.z + this.moveVec.z,
      bounds.minZ,
      bounds.maxZ
    );
    if (!this.collidesAny(this.camera.position.x, nextZ, colliders)) {
      this.camera.position.z = nextZ;
    }
  }

  private collidesAny(x: number, z: number, colliders: AABB[]): boolean {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (
        x > c.minX - PLAYER_RADIUS &&
        x < c.maxX + PLAYER_RADIUS &&
        z > c.minZ - PLAYER_RADIUS &&
        z < c.maxZ + PLAYER_RADIUS
      ) {
        return true;
      }
    }
    return false;
  }

  private startLoop(): void {
    this.lastTimeMs = performance.now();
    this.scheduleNextTick();
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(fn: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (sync) {
        gl.flush();
        const poll = () => {
          if (this.disposed) {
            gl.deleteSync(sync);
            return;
          }
          const status = gl.clientWaitSync(sync, 0, 0);
          if (status === gl.WAIT_FAILED || status === gl.TIMEOUT_EXPIRED) {
            this.timerId = window.setTimeout(poll, 4);
            return;
          }
          gl.deleteSync(sync);
          this.timerId = window.setTimeout(fn, 80);
        };
        this.timerId = window.setTimeout(poll, 4);
        return;
      }
    }
    this.timerId = window.setTimeout(fn, 80);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.08, Math.max(0.001, (now - this.lastTimeMs) / 1000));
    this.lastTimeMs = now;
    this.worldTime += dt;

    this.updateMovement(dt);
    if (this.activeZone === 'kitchen') {
      this.updateManualAimAndTool(dt);
      this.room.update(this.worldTime, this.isFillingSink);
      this.rig.update(dt, this.worldTime);
    } else if (this.activeZone === 'garden') {
      this.updateGardenProximity();
      this.garden.update(this.worldTime, Date.now());
    } else {
      this.updateCompostProximity();
      this.updateManualAimAndTool(dt);
      this.compost.update(dt, this.worldTime);
    }
    this.emitState(false);

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  };

  public dispose(): void {
    this.disposed = true;
    this.stopLoop();
    if (this.busyTimeoutId !== null) {
      window.clearTimeout(this.busyTimeoutId);
      this.busyTimeoutId = null;
    }
    workshopVoiceover.stop();

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.room.dispose();
    this.rig.dispose();
    this.garden.dispose();
    this.compost.dispose();
    this.mats.dispose();
    this.envRenderTarget.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
