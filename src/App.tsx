import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DualTouchControls } from './components/DualTouchControls';
import { EinsteinNarrator } from './components/EinsteinNarrator';
import { WorkshopHud } from './components/WorkshopHud';
import { workshopAudio } from './workshop/audio';
import {
  KitchenWorkshopScene,
  type WorkshopHudState,
} from './workshop/KitchenWorkshopScene';
import { BUILD_STEPS, type GradeTier } from './workshop/steps';
import { workshopVoiceover, type VoiceoverState } from './workshop/voiceover';

const INITIAL_HUD_STATE: WorkshopHudState = {
  stepId: 'GET_SAW',
  toolId: 'none',
  inRange: false,
  isBusy: false,
  cutawayMode: false,
  cutawayAvailable: false,
  targetLabel: 'Hacksaw (West Counter)',
  manualAimMode: false,
  reticleAligned: false,
  subProgress: 0,
  completedSubSteps: 0,
  totalSubSteps: 0,
};

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<KitchenWorkshopScene | null>(null);

  const [hudState, setHudState] = useState<WorkshopHudState>(INITIAL_HUD_STATE);
  const [gradeTier, setGradeTier] = useState<GradeTier>('7-9');
  const [voiceover, setVoiceover] = useState<VoiceoverState>({
    active: false,
    speaking: false,
    text: '',
  });
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const unsubVoiceover = workshopVoiceover.subscribe((next) => {
      setVoiceover(next);
    });

    const scene = new KitchenWorkshopScene(el, (nextState) => {
      setHudState(nextState);
    });
    sceneRef.current = scene;

    return () => {
      unsubVoiceover();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const handleMoveInput = useCallback((x: number, y: number) => {
    sceneRef.current?.setThumbstickInput(x, y);
  }, []);

  const handleLookDelta = useCallback((dx: number, dy: number) => {
    sceneRef.current?.applyLookDelta(dx, dy);
  }, []);

  const handleTapViewport = useCallback((clientX: number, clientY: number) => {
    sceneRef.current?.tryInteractAtScreenPoint(clientX, clientY);
  }, []);

  const handleActionStart = useCallback(() => {
    sceneRef.current?.setActionHeld(true);
  }, []);

  const handleActionEnd = useCallback(() => {
    sceneRef.current?.setActionHeld(false);
  }, []);

  const handleSelectGrade = useCallback((tier: GradeTier) => {
    setGradeTier(tier);
    sceneRef.current?.setGradeTier(tier);
  }, []);

  const handleReplayVoiceover = useCallback(() => {
    sceneRef.current?.replayVoiceover();
  }, []);

  const handleDismissNarrator = useCallback(() => {
    workshopVoiceover.dismiss();
  }, []);

  const handleToggleCutaway = useCallback(() => {
    sceneRef.current?.toggleCutawayMode();
  }, []);

  const handleReset = useCallback(() => {
    sceneRef.current?.resetWorkshop();
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextAudioMuted = workshopAudio.toggleMute();
    if (nextAudioMuted !== workshopVoiceover.isMuted()) {
      workshopVoiceover.toggleMute();
    }
    setMuted(nextAudioMuted);
  }, []);

  const currentStep = BUILD_STEPS[hudState.stepId];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#181c20]">
      {/* 3D WebGL Kitchen Fabrication Workshop */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Dual-Touch Virtual Thumbstick + Independent Touch-Drag Camera Look */}
      <DualTouchControls
        onMoveInput={handleMoveInput}
        onLookDelta={handleLookDelta}
        onTapViewport={handleTapViewport}
        onActionStart={handleActionStart}
        onActionEnd={handleActionEnd}
        actionLabel={currentStep.actionLabel}
        targetLabel={hudState.targetLabel}
        inRange={hudState.inRange}
        isBusy={hudState.isBusy}
        isComplete={hudState.stepId === 'COMPLETE'}
        manualAimMode={hudState.manualAimMode}
        reticleAligned={hudState.reticleAligned}
        subProgress={hudState.subProgress}
        completedSubSteps={hudState.completedSubSteps}
        totalSubSteps={hudState.totalSubSteps}
      />

      {/* Minimal Unobtrusive HUD */}
      <WorkshopHud
        hudState={hudState}
        gradeTier={gradeTier}
        muted={muted}
        onSelectGrade={handleSelectGrade}
        onReplayVoiceover={handleReplayVoiceover}
        onToggleMute={handleToggleMute}
        onToggleCutaway={handleToggleCutaway}
        onReset={handleReset}
      />

      {/* Pop-Up Animated Einstein Mentor (Appears Only During Narration) */}
      <EinsteinNarrator
        voiceover={voiceover}
        onDismiss={handleDismissNarrator}
      />
    </div>
  );
}

export default App;
