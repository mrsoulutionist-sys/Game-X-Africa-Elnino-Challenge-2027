import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { workshopAudio } from './audio';
import { buildHydroponicRig, type HydroponicRigHandle } from './hydroponicRigBuilder';
import { buildKitchenWorkshopRoom, type AABB, type KitchenRoomHandle } from './kitchenRoomBuilder';
import { createWorkshopMaterials, type WorkshopMaterials } from './materials';
import { BUILD_STEPS, type BuildStepId, type GradeTier, type ToolId } from './steps';
import { workshopVoiceover } from './voiceover';

export interface WorkshopHudState {
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
}

const ROOM_BOUNDS = {
  minX: -4.2,
  maxX: 4.2,
  minZ: -4.05,
  maxZ: 3.9,
};
const PLAYER_EYE_Y = 1.62;
const PLAYER_RADIUS = 0.34;
const WALK_SPEED = 3.05;

export class KitchenWorkshopScene {
  private container: HTMLElement;
  private onStateChange: (state: WorkshopHudState) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private pmremGenerator!: THREE.PMREMGenerator;
  private envRenderTarget!: THREE.WebGLRenderTarget;
  private mats!: WorkshopMaterials;
  private room!: KitchenRoomHandle;
  private rig!: HydroponicRigHandle;

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
  private stepId: BuildStepId = 'GET_SAW';
  private toolId: ToolId = 'none';
  private isBusy = false;
  private isFillingSink = false;
  private cutawayMode = false;
  private busyTimeoutId: number | null = null;

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

  // Pre-allocated math helpers (zero per-frame allocations)
  private readonly forwardVec = new THREE.Vector3();
  private readonly rightVec = new THREE.Vector3();
  private readonly moveVec = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly centerNdc = new THREE.Vector2(0, 0);
  private readonly ndcPointer = new THREE.Vector2();

  constructor(container: HTMLElement, onStateChange: (state: WorkshopHudState) => void) {
    this.container = container;
    this.onStateChange = onStateChange;

    this.initRenderer();
    this.initScene();
    this.bindEvents();
    this.emitState(true);
    workshopVoiceover.speakStep('GET_SAW', true);
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
    this.camera = new THREE.PerspectiveCamera(62, w / Math.max(1, h), 0.08, 40);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, PLAYER_EYE_Y, 2.35);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = this.pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();

    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x6f5a46, 0.72);
    this.scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfff5e4, 1.35);
    sunLight.position.set(-1.9, 3.8, -5.2);
    sunLight.target.position.set(0, 0.9, 0);
    this.scene.add(sunLight.target);
    if (!this.isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 14;
      sunLight.shadow.camera.left = -4.5;
      sunLight.shadow.camera.right = 4.5;
      sunLight.shadow.camera.top = 4.5;
      sunLight.shadow.camera.bottom = -4.5;
      sunLight.shadow.bias = -0.0005;
    }
    this.scene.add(sunLight);

    [-0.68, 0.68].forEach((px) => {
      const pLight = new THREE.PointLight(0xffdfb0, 2.2, 7.5, 1.5);
      pLight.position.set(px, 2.04, 0);
      this.scene.add(pLight);
    });

    const fillLight = new THREE.DirectionalLight(0xd9e8f5, 0.45);
    fillLight.position.set(2.5, 2.8, 3.6);
    this.scene.add(fillLight);

    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy() || 1);
    this.mats = createWorkshopMaterials(this.renderer);
    this.room = buildKitchenWorkshopRoom(this.mats, maxAniso);
    this.scene.add(this.room.group);

    this.rig = buildHydroponicRig(this.mats);
    this.scene.add(this.rig.group);
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
    workshopAudio.unlock();
    workshopVoiceover.unlockAndSpeakPending();
    const code = e.code;
    this.keys.add(code);

    if (code === 'KeyE' || code === 'Space') {
      e.preventDefault();
      if (this.isManualAimStep()) {
        this.actionHeld = true;
      } else if (!e.repeat && (this.checkInRange() || this.stepId === 'COMPLETE')) {
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
    if (this.isManualAimStep()) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.ndcPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndcPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndcPointer, this.camera);

    const hits = this.raycaster.intersectObjects(this.room.interactableObjects, true);
    if (hits.length === 0) return;

    const hitZone = hits[0].object.userData.targetZone as string | undefined;
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
    workshopVoiceover.speakStep(this.stepId, false);
  }

  public setCutawayMode(enabled: boolean): void {
    this.cutawayMode = enabled;
    this.rig.setStepState(this.stepId, this.cutawayMode);
    if (enabled && this.stepId === 'COMPLETE') {
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
    this.stepId = 'GET_SAW';
    this.toolId = 'none';
    this.isBusy = false;
    this.isFillingSink = false;
    this.cutawayMode = false;
    this.actionHeld = false;
    this.alignedTargetIndex = null;
    this.subProgress = 0;
    this.completedSubSteps = 0;
    this.totalSubSteps = 0;

    this.camera.position.set(0, PLAYER_EYE_Y, 2.35);
    this.yaw = 0;
    this.pitch = -0.15;
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.room.setActiveStepVisuals(this.stepId, false);
    this.rig.setStepState(this.stepId, false);
    this.emitState(true);
    workshopVoiceover.speakStep('GET_SAW', false);
  }

  public triggerCurrentAction(): void {
    if (this.isBusy || this.isManualAimStep()) return;
    workshopAudio.unlock();
    workshopVoiceover.unlockAndSpeakPending();

    if (this.stepId === 'COMPLETE') {
      this.toggleCutawayMode();
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
    return this.stepId === 'CUT_AND_ASSEMBLE_PVC' || this.stepId === 'DRILL_PORTS';
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
    workshopVoiceover.speakStep(next, false);
  }

  private checkInRange(): boolean {
    if (this.stepId === 'COMPLETE') return true;
    const zoneId = BUILD_STEPS[this.stepId].targetZone;
    const anchor = this.room.targetZones[zoneId];
    const dx = this.camera.position.x - anchor.position.x;
    const dz = this.camera.position.z - anchor.position.z;
    return Math.hypot(dx, dz) <= anchor.interactRadius;
  }

  private updateManualAimAndTool(dt: number): void {
    if (!this.isManualAimStep()) {
      this.alignedTargetIndex = null;
      this.subProgress = 0;
      return;
    }

    const inRange = this.checkInRange();
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

  private emitState(force = false): void {
    const inRange = this.checkInRange();
    const reticleAligned = this.alignedTargetIndex !== null && inRange;
    const progressChanged = Math.abs(this.subProgress - this.lastEmittedProgress) >= 0.04;

    if (
      !force &&
      inRange === this.lastInRange &&
      reticleAligned === this.lastAligned &&
      this.completedSubSteps === this.lastCompletedSub &&
      !progressChanged
    ) {
      return;
    }

    this.lastInRange = inRange;
    this.lastAligned = reticleAligned;
    this.lastCompletedSub = this.completedSubSteps;
    this.lastEmittedProgress = this.subProgress;

    const stepDef = BUILD_STEPS[this.stepId];
    const cutawayAvailable =
      this.stepId !== 'GET_SAW' && this.stepId !== 'CUT_AND_ASSEMBLE_PVC';

    this.onStateChange({
      stepId: this.stepId,
      toolId: this.toolId,
      inRange,
      isBusy: this.isBusy,
      cutawayMode: this.cutawayMode,
      cutawayAvailable,
      targetLabel: this.room.targetZones[stepDef.targetZone].label,
      manualAimMode: this.isManualAimStep(),
      reticleAligned,
      subProgress: this.subProgress,
      completedSubSteps: this.completedSubSteps,
      totalSubSteps: this.totalSubSteps,
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

    this.forwardVec.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.rightVec.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.moveVec
      .set(0, 0, 0)
      .addScaledVector(this.forwardVec, iy * WALK_SPEED * dt)
      .addScaledVector(this.rightVec, ix * WALK_SPEED * dt);

    const nextX = THREE.MathUtils.clamp(
      this.camera.position.x + this.moveVec.x,
      ROOM_BOUNDS.minX,
      ROOM_BOUNDS.maxX
    );
    if (!this.collidesAny(nextX, this.camera.position.z, this.room.colliders)) {
      this.camera.position.x = nextX;
    }

    const nextZ = THREE.MathUtils.clamp(
      this.camera.position.z + this.moveVec.z,
      ROOM_BOUNDS.minZ,
      ROOM_BOUNDS.maxZ
    );
    if (!this.collidesAny(this.camera.position.x, nextZ, this.room.colliders)) {
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
    this.updateManualAimAndTool(dt);
    this.room.update(this.worldTime, this.isFillingSink);
    this.rig.update(dt, this.worldTime);
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
    this.mats.dispose();
    this.envRenderTarget.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
