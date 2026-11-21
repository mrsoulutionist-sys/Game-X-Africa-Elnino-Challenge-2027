import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CompostStationModal,
  type WorkstationTab,
} from './components/CompostStationModal';
import { DualTouchControls } from './components/DualTouchControls';
import { EinsteinNarrator } from './components/EinsteinNarrator';
import { FarmerLoginOverlay } from './components/FarmerLoginOverlay';
import { GardenRackPanel } from './components/GardenRackPanel';
import { WickExplainerModal } from './components/WickExplainerModal';
import { WorkshopHud } from './components/WorkshopHud';
import {
  loginOrCreateFarmer,
  resizeTierArray,
  saveFarmerProgress,
  testFirestoreConnection,
  type ActiveZone,
  type FarmerProfile,
} from './firebase/firebaseClient';
import { workshopAudio } from './workshop/audio';
import {
  COMPOST_CONTAINER_OPTIONS,
  DRIP_BOTTLE_OPTIONS,
  MULCH_OPTIONS,
  type Door3ProgressState,
} from './workshop/compostData';
import {
  getCropById,
  type CropId,
  type TierSaveState,
  type WeatherMode,
} from './workshop/crops';
import type { GardenResilienceState } from './workshop/gardenYardBuilder';
import {
  KitchenWorkshopScene,
  type WorkshopHudState,
} from './workshop/KitchenWorkshopScene';
import { BUILD_STEPS, type BuildStepId, type GradeTier } from './workshop/steps';
import { workshopVoiceover, type VoiceoverState } from './workshop/voiceover';

const INITIAL_HUD_STATE: WorkshopHudState = {
  activeZone: 'kitchen',
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
  gardenTarget: null,
  compostTarget: null,
};

function toResilienceState(profile: FarmerProfile): GardenResilienceState {
  return {
    jojoInstalled: profile.jojoInstalled,
    jojoLitres: profile.jojoLitres,
    jojoCapacity: profile.jojoCapacity,
    shadeClothInstalled: profile.shadeClothInstalled,
    weatherMode: profile.weatherMode,
  };
}

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<KitchenWorkshopScene | null>(null);
  const profileRef = useRef<FarmerProfile | null>(null);

  const [hudState, setHudState] = useState<WorkshopHudState>(INITIAL_HUD_STATE);
  const [gradeTier, setGradeTier] = useState<GradeTier>('7-9');
  const [voiceover, setVoiceover] = useState<VoiceoverState>({
    active: false,
    speaking: false,
    text: '',
  });
  const [muted, setMuted] = useState(false);

  const [farmerProfile, setFarmerProfile] = useState<FarmerProfile | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [wickModalOpen, setWickModalOpen] = useState(false);
  const [rackPanelOpen, setRackPanelOpen] = useState(false);
  const [rackDropdownOpen, setRackDropdownOpen] = useState(false);
  const [compostModalOpen, setCompostModalOpen] = useState(false);
  const [compostModalTab, setCompostModalTab] = useState<WorkstationTab | undefined>(undefined);
  const [compostDropdownOpen, setCompostDropdownOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    profileRef.current = farmerProfile;
  }, [farmerProfile]);

  const persistProfileUpdate = useCallback((updater: (prev: FarmerProfile) => FarmerProfile) => {
    setFarmerProfile((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      profileRef.current = next;
      void saveFarmerProgress(next);
      return next;
    });
  }, []);

  useEffect(() => {
    void testFirestoreConnection();
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const unsubVoiceover = workshopVoiceover.subscribe((next) => {
      setVoiceover(next);
    });

    const scene = new KitchenWorkshopScene(el, {
      onHudChange: (nextState) => {
        setHudState(nextState);
      },
      onKitchenStepPersisted: (step: BuildStepId) => {
        persistProfileUpdate((prev) => ({
          ...prev,
          kitchenStep: step,
        }));
      },
      onZoneChanged: (zone: ActiveZone) => {
        persistProfileUpdate((prev) => ({
          ...prev,
          activeZone: zone,
        }));
      },
      onOpenRackManager: () => {
        setNowMs(Date.now());
        setRackPanelOpen(true);
      },
      onOpenCompostStation: (workstation?: 1 | 2 | 3) => {
        setCompostModalTab(workstation);
        setCompostModalOpen(true);
      },
      onDoor3Update: (updater, bonusLitres = 0, narration?: string) => {
        persistProfileUpdate((prev) => {
          const nextDoor3 = updater(prev.door3);
          sceneRef.current?.syncCompostProgress(nextDoor3);
          return {
            ...prev,
            door3: nextDoor3,
            litresSaved: prev.litresSaved + bonusLitres,
          };
        });
        if (narration) {
          workshopVoiceover.speakCustom(narration);
        }
      },
    });
    sceneRef.current = scene;

    return () => {
      unsubVoiceover();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [persistProfileUpdate]);

  useEffect(() => {
    if (!rackPanelOpen && !rackDropdownOpen && hudState.activeZone !== 'garden') return;
    const intervalMs = rackPanelOpen || rackDropdownOpen ? 1000 : 5000;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [rackPanelOpen, rackDropdownOpen, hudState.activeZone]);

  const handleLogin = useCallback(async (farmerName: string, passcode: string) => {
    setLoginLoading(true);
    setLoginError(null);
    workshopAudio.unlock();
    workshopVoiceover.unlockAndSpeakPending();
    try {
      const { profile, isReturning } = await loginOrCreateFarmer(farmerName, passcode);
      profileRef.current = profile;
      setFarmerProfile(profile);
      setNowMs(Date.now());
      const announceStep = !isReturning || profile.activeZone !== 'kitchen';
      sceneRef.current?.applySavedProfile(
        profile.activeZone,
        profile.kitchenStep,
        profile.rackSize,
        profile.tiers,
        announceStep,
        toResilienceState(profile),
        profile.door3
      );
      if (isReturning && profile.activeZone === 'kitchen') {
        workshopVoiceover.speakCustom(
          `Welcome back, ${profile.farmerName}! Your farm workshop progress is restored.`
        );
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unable to load farm profile.');
    } finally {
      setLoginLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    workshopVoiceover.stop();
    setRackPanelOpen(false);
    setCompostModalOpen(false);
    setWickModalOpen(false);
    setFarmerProfile(null);
    profileRef.current = null;
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

  const handleSwitchZone = useCallback((zone: ActiveZone) => {
    setRackPanelOpen(false);
    setCompostModalOpen(false);
    sceneRef.current?.switchZone(zone, true);
    if (zone === 'compost') {
      workshopVoiceover.speakCustom(
        'Welcome to Door 3: Recycling & Composting Station! Walk up to each 3D bench and aim or tap to poke & bury your 2L drip bottle, layer compost, and scissor-cut cardboard mulch.'
      );
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextAudioMuted = workshopAudio.toggleMute();
    if (nextAudioMuted !== workshopVoiceover.isMuted()) {
      workshopVoiceover.toggleMute();
    }
    setMuted(nextAudioMuted);
  }, []);

  const handleChangeRackSize = useCallback(
    (nextSize: number) => {
      persistProfileUpdate((prev) => {
        const nextTiers = resizeTierArray(prev.tiers, nextSize);
        sceneRef.current?.syncGardenTiers(nextSize, nextTiers, toResilienceState(prev));
        return {
          ...prev,
          rackSize: nextSize,
          tiers: nextTiers,
        };
      });
    },
    [persistProfileUpdate]
  );

  const handleDeployPipe = useCallback(
    (tierIndex: number) => {
      if (!profileRef.current || profileRef.current.kitchenStep !== 'COMPLETE') return;
      workshopAudio.playPickup();
      persistProfileUpdate((prev) => {
        const nextTiers: TierSaveState[] = prev.tiers.map((t, idx) =>
          idx === tierIndex
            ? {
                ...t,
                pipeInstalled: true,
                wateredAtMs: t.wateredAtMs ?? Date.now(),
              }
            : t
        );
        const nextProfile: FarmerProfile = {
          ...prev,
          kitchenStep: 'GET_SAW',
          tiers: nextTiers,
          litresSaved: prev.litresSaved + 9,
        };
        sceneRef.current?.syncGardenTiers(prev.rackSize, nextTiers, toResilienceState(nextProfile));
        return nextProfile;
      });
      sceneRef.current?.clearCompletedPipeSilently();
      workshopVoiceover.speakCustom(
        `Tier ${tierIndex + 1} PVC manifold mounted! Pick an El Niño-resilient seed, install your JoJo tank, or add shade cloth before a heatwave hits.`
      );
    },
    [persistProfileUpdate]
  );

  const handlePlantSeed = useCallback(
    (tierIndex: number, cropId: CropId) => {
      const now = Date.now();
      workshopAudio.playPlanting();
      persistProfileUpdate((prev) => {
        const nextTiers = prev.tiers.map((t, idx) =>
          idx === tierIndex
            ? {
                ...t,
                cropId,
                plantedAtMs: now,
                wateredAtMs: now,
              }
            : t
        );
        sceneRef.current?.syncGardenTiers(prev.rackSize, nextTiers, toResilienceState(prev));
        return { ...prev, tiers: nextTiers };
      });
      setNowMs(now);
    },
    [persistProfileUpdate]
  );

  const handleWaterTier = useCallback(
    (tierIndex: number) => {
      const now = Date.now();
      workshopAudio.playPourAndBloom();
      persistProfileUpdate((prev) => {
        if (prev.jojoLitres < 3) return prev;
        const nextTiers = prev.tiers.map((t, idx) =>
          idx === tierIndex ? { ...t, wateredAtMs: now } : t
        );
        const nextProfile: FarmerProfile = {
          ...prev,
          jojoLitres: Math.max(0, prev.jojoLitres - 3),
          litresSaved: prev.litresSaved + 9,
          tiers: nextTiers,
        };
        sceneRef.current?.syncGardenTiers(prev.rackSize, nextTiers, toResilienceState(nextProfile));
        return nextProfile;
      });
      setNowMs(now);
    },
    [persistProfileUpdate]
  );

  const handleHarvestTier = useCallback(
    (tierIndex: number) => {
      const now = Date.now();
      workshopAudio.playPourAndBloom();
      persistProfileUpdate((prev) => {
        const tierCrop = getCropById(prev.tiers[tierIndex]?.cropId ?? null);
        const servingsGain = tierCrop?.servingsPerHarvest ?? 4;
        const nextTiers = prev.tiers.map((t, idx) =>
          idx === tierIndex
            ? {
                ...t,
                cropId: null,
                plantedAtMs: null,
                wateredAtMs: now,
              }
            : t
        );
        sceneRef.current?.syncGardenTiers(prev.rackSize, nextTiers, toResilienceState(prev));
        return {
          ...prev,
          totalHarvestedCount: prev.totalHarvestedCount + 1,
          foodServings: prev.foodServings + servingsGain,
          tiers: nextTiers,
        };
      });
      workshopVoiceover.speakCustom(
        'Great harvest! Your shaded wicking pipe saved water through the dry spell. Pick a fresh seed to replant this tier.'
      );
    },
    [persistProfileUpdate]
  );

  const handleInstallJojo = useCallback(() => {
    workshopAudio.playPourAndBloom();
    persistProfileUpdate((prev) => {
      const nextProfile: FarmerProfile = {
        ...prev,
        jojoInstalled: true,
        jojoCapacity: 60,
        jojoLitres: 60,
      };
      sceneRef.current?.syncGardenTiers(prev.rackSize, prev.tiers, toResilienceState(nextProfile));
      return nextProfile;
    });
    workshopVoiceover.speakCustom(
      'JoJo rainwater tank built and filled to 60 litres! Storing rainwater ahead of El Niño drought keeps your garden alive during water restrictions.'
    );
  }, [persistProfileUpdate]);

  const handleRefillJojo = useCallback(() => {
    workshopAudio.playSinkFill();
    persistProfileUpdate((prev) => {
      const gain = prev.weatherMode === 'heatwave' ? 6 : 20;
      const nextProfile: FarmerProfile = {
        ...prev,
        jojoLitres: Math.min(prev.jojoCapacity, prev.jojoLitres + gain),
      };
      sceneRef.current?.syncGardenTiers(prev.rackSize, prev.tiers, toResilienceState(nextProfile));
      return nextProfile;
    });
  }, [persistProfileUpdate]);

  const handleToggleShadeCloth = useCallback(() => {
    workshopAudio.playPickup();
    persistProfileUpdate((prev) => {
      const nextInstalled = !prev.shadeClothInstalled;
      const nextProfile: FarmerProfile = {
        ...prev,
        shadeClothInstalled: nextInstalled,
      };
      sceneRef.current?.syncGardenTiers(prev.rackSize, prev.tiers, toResilienceState(nextProfile));
      if (nextInstalled) {
        workshopVoiceover.speakCustom(
          '40% agricultural shade cloth installed! It cuts El Niño evaporation by 35% and shields leafy greens from midday scorch.'
        );
      }
      return nextProfile;
    });
  }, [persistProfileUpdate]);

  const handleAdvanceWeather = useCallback(() => {
    const order: WeatherMode[] = ['normal', 'elnino_watch', 'heatwave'];
    persistProfileUpdate((prev) => {
      const idx = order.indexOf(prev.weatherMode);
      const nextMode = order[(idx + 1) % order.length];
      const nextProfile: FarmerProfile = {
        ...prev,
        weatherMode: nextMode,
      };
      sceneRef.current?.syncGardenTiers(prev.rackSize, prev.tiers, toResilienceState(nextProfile));

      if (nextMode === 'elnino_watch') {
        workshopVoiceover.speakCustom(
          'El Niño Watch issued! Temperatures are rising to 32 degrees. Preempt the drought by building your JoJo tank and installing shade cloth now.'
        );
      } else if (nextMode === 'heatwave') {
        const prepared = prev.jojoInstalled && prev.shadeClothInstalled && prev.jojoLitres >= 12;
        workshopVoiceover.speakCustom(
          prepared
            ? '38°C Heatwave and Level 4 water caps just hit—but you prepared early! Your JoJo reserve, shade cloth, and wicks keep crops thriving.'
            : '38°C Heatwave and Level 4 water caps! Notice evaporation doubled without full JoJo storage and shade cloth—preemptive engineering is key.'
        );
      } else {
        workshopVoiceover.speakCustom(
          'Seasonal rains have returned! Catch rainwater into your JoJo tank before the next El Niño dry cycle.'
        );
      }
      return nextProfile;
    });
  }, [persistProfileUpdate]);

  const handleUpdateDoor3 = useCallback(
    (
      updater: (prev: Door3ProgressState) => Door3ProgressState,
      bonusLitres = 0,
      narration?: string
    ) => {
      workshopAudio.playPickup();
      persistProfileUpdate((prev) => {
        const nextDoor3 = updater(prev.door3);
        sceneRef.current?.syncCompostProgress(nextDoor3);
        return {
          ...prev,
          door3: nextDoor3,
          litresSaved: prev.litresSaved + bonusLitres,
        };
      });
      if (narration) {
        workshopAudio.playPourAndBloom();
        workshopVoiceover.speakCustom(narration);
      }
    },
    [persistProfileUpdate]
  );

  const handleBuildAnotherPipe = useCallback(() => {
    setRackPanelOpen(false);
    sceneRef.current?.startNewPipeInKitchen();
  }, []);

  const currentStep = BUILD_STEPS[hudState.stepId];
  const isKitchenComplete = hudState.activeZone === 'kitchen' && hudState.stepId === 'COMPLETE';
  const hasReadyPipe = farmerProfile?.kitchenStep === 'COMPLETE' || hudState.stepId === 'COMPLETE';

  const dualActionLabel =
    hudState.activeZone === 'garden'
      ? hudState.gardenTarget === 'compost_door'
        ? 'Enter Door 3: Compost'
        : hudState.gardenTarget === 'kitchen_door'
          ? 'Enter Kitchen Lab'
          : hudState.gardenTarget === 'jojo'
            ? 'JoJo Rain Tank'
            : hudState.gardenTarget === 'weather'
              ? 'El Niño Forecast'
              : 'Manage Rack & Crops'
      : hudState.activeZone === 'compost'
        ? hudState.targetLabel
        : currentStep.actionLabel;

  const dualTargetLabel =
    hudState.activeZone === 'garden'
      ? 'Walk to Rack, JoJo or Doors'
      : hudState.activeZone === 'compost'
        ? hudState.targetLabel
        : hudState.targetLabel;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#181c20]">
      {/* 3D WebGL Kitchen Fabrication Workshop & Outdoor Garden Yard */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Dual-Touch Virtual Thumbstick + Independent Touch-Drag Camera Look */}
      {farmerProfile && (
        <>
          <DualTouchControls
            onMoveInput={handleMoveInput}
            onLookDelta={handleLookDelta}
            onTapViewport={handleTapViewport}
            onActionStart={handleActionStart}
            onActionEnd={handleActionEnd}
            actionLabel={dualActionLabel}
            targetLabel={dualTargetLabel}
            inRange={hudState.inRange}
            isBusy={hudState.isBusy}
            isComplete={isKitchenComplete}
            manualAimMode={hudState.manualAimMode}
            reticleAligned={hudState.reticleAligned}
            subProgress={hudState.subProgress}
            completedSubSteps={hudState.completedSubSteps}
            totalSubSteps={hudState.totalSubSteps}
          />

          <WorkshopHud
            hudState={hudState}
            gradeTier={gradeTier}
            muted={muted}
            farmerName={farmerProfile.farmerName}
            readyPipeCount={hasReadyPipe ? 1 : 0}
            jojoLitres={farmerProfile.jojoLitres}
            weatherMode={farmerProfile.weatherMode}
            shadeClothInstalled={farmerProfile.shadeClothInstalled}
            tiers={farmerProfile.tiers}
            door3={farmerProfile.door3}
            nowMs={nowMs}
            rackDropdownOpen={rackDropdownOpen}
            compostDropdownOpen={compostDropdownOpen}
            onToggleRackDropdown={() => {
              setNowMs(Date.now());
              setRackDropdownOpen((v) => !v);
            }}
            onToggleCompostDropdown={() => setCompostDropdownOpen((v) => !v)}
            onSelectGrade={handleSelectGrade}
            onReplayVoiceover={handleReplayVoiceover}
            onToggleMute={handleToggleMute}
            onToggleCutaway={handleToggleCutaway}
            onReset={handleReset}
            onOpenWickExplainer={() => setWickModalOpen(true)}
            onOpenRackManager={() => {
              setNowMs(Date.now());
              setRackPanelOpen(true);
            }}
            onOpenCompostStation={(workstation?: 1 | 2 | 3) => {
              setCompostModalTab(workstation);
              setCompostModalOpen(true);
            }}
            onSwitchZone={handleSwitchZone}
            onLogout={handleLogout}
          />

          {/* Compact Non-Blocking Quick-Pick Bar for Door 3 3D Selection Steps */}
          {hudState.activeZone === 'compost' && !hudState.isBusy && (
            <>
              {hudState.compostTarget === 'drip_bench' && farmerProfile.door3.dripStep === 0 && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-slate-950/90 border border-sky-500/45 px-2.5 py-1.5 shadow-lg">
                  <span className="text-[11px] font-mono text-sky-300 px-1">Pick 2L Bottle:</span>
                  {DRIP_BOTTLE_OPTIONS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => sceneRef.current?.selectDoor3Bottle(b.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-sky-700 text-white border border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {b.badgeText}
                    </button>
                  ))}
                </div>
              )}

              {hudState.compostTarget === 'compost_bay' && farmerProfile.door3.compostStep === 0 && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-slate-950/90 border border-emerald-500/45 px-2.5 py-1.5 shadow-lg">
                  <span className="text-[11px] font-mono text-emerald-300 px-1">Pick Container:</span>
                  {COMPOST_CONTAINER_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => sceneRef.current?.selectDoor3Container(c.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white border border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              {hudState.compostTarget === 'mulch_bench' && farmerProfile.door3.mulchStep === 0 && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-slate-950/90 border border-amber-500/45 px-2.5 py-1.5 shadow-lg">
                  <span className="text-[11px] font-mono text-amber-300 px-1">Pick Shield:</span>
                  {MULCH_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => sceneRef.current?.selectDoor3Mulch(m.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-amber-700 text-white border border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {m.id === 'cardboard' ? 'Cardboard' : 'Newspaper'}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Lightweight Farmer Name + Passcode Login Overlay */}
      {!farmerProfile && (
        <FarmerLoginOverlay
          onLogin={handleLogin}
          loading={loginLoading}
          errorMsg={loginError}
        />
      )}

      {/* Interactive Capillary Wick & Air-Gap Cross-Section Modal */}
      <WickExplainerModal
        open={wickModalOpen}
        onClose={() => setWickModalOpen(false)}
      />

      {/* Vertical Rack Stand (2..6 Tiers) & El Nino Defense Manager */}
      {farmerProfile && (
        <GardenRackPanel
          open={rackPanelOpen}
          rackSize={farmerProfile.rackSize}
          tiers={farmerProfile.tiers}
          hasReadyPipe={hasReadyPipe}
          totalHarvestedCount={farmerProfile.totalHarvestedCount}
          jojoInstalled={farmerProfile.jojoInstalled}
          jojoLitres={farmerProfile.jojoLitres}
          jojoCapacity={farmerProfile.jojoCapacity}
          shadeClothInstalled={farmerProfile.shadeClothInstalled}
          weatherMode={farmerProfile.weatherMode}
          litresSaved={farmerProfile.litresSaved}
          foodServings={farmerProfile.foodServings}
          nowMs={nowMs}
          onClose={() => setRackPanelOpen(false)}
          onChangeRackSize={handleChangeRackSize}
          onDeployPipe={handleDeployPipe}
          onPlantSeed={handlePlantSeed}
          onWaterTier={handleWaterTier}
          onHarvestTier={handleHarvestTier}
          onBuildAnotherPipe={handleBuildAnotherPipe}
          onInstallJojo={handleInstallJojo}
          onRefillJojo={handleRefillJojo}
          onToggleShadeCloth={handleToggleShadeCloth}
          onAdvanceWeather={handleAdvanceWeather}
        />
      )}

      {/* Door 3: Recycling & Composting Station (3 Sequential Workstations) */}
      {farmerProfile && (
        <CompostStationModal
          open={compostModalOpen}
          initialWorkstation={compostModalTab}
          gradeTier={gradeTier}
          progress={farmerProfile.door3}
          litresSaved={farmerProfile.litresSaved}
          onClose={() => setCompostModalOpen(false)}
          onUpdateProgress={handleUpdateDoor3}
          onSwitchToGarden={() => {
            setCompostModalOpen(false);
            handleSwitchZone('garden');
          }}
        />
      )}

      {/* Pop-Up Animated Einstein Mentor (Appears Only During Narration) */}
      <EinsteinNarrator
        voiceover={voiceover}
        onDismiss={handleDismissNarrator}
      />
    </div>
  );
}

export default App;
