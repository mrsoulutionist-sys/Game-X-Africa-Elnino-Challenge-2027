import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminDocumentsModal } from './components/AdminDocumentsModal';
import { AdminPortal } from './components/AdminPortal';
import {
  CompostStationModal,
  type WorkstationTab,
} from './components/CompostStationModal';
import { DualTouchControls } from './components/DualTouchControls';
import { EinsteinNarrator } from './components/EinsteinNarrator';
import { ElNinoDefenseModal } from './components/ElNinoDefenseModal';
import { FarmerLoginOverlay } from './components/FarmerLoginOverlay';
import { GardenRackPanel } from './components/GardenRackPanel';
import { LeaderboardModal } from './components/LeaderboardModal';
import { ParentPortal } from './components/ParentPortal';
import { WickExplainerModal } from './components/WickExplainerModal';
import { WorkshopHud } from './components/WorkshopHud';
import {
  BANNER_DISPLAY_DURATION_MS,
  BANNER_INTERVAL_MS,
  claimOrLoginAdmin,
  DEFAULT_SYSTEM_CONFIG,
  recordCompetitionRun,
  subscribeToAdminDocuments,
  subscribeToSystemConfig,
  type AdminDocumentRecord,
  type AdminProfile,
  type BannerStage,
  type ChallengeBannerItem,
  type SystemConfigState,
} from './firebase/adminService';
import {
  loginOrCreateFarmer,
  loginOrCreateParent,
  resizeTierArray,
  saveFarmerProgress,
  testFirestoreConnection,
  type ActiveZone,
  type FarmerProfile,
  type ParentLoginPayload,
  type ParentProfile,
  type StudentLoginMetadata,
} from './firebase/firebaseClient';
import {
  recordStudentHarvest,
  syncStudentActiveGrows,
} from './firebase/storeService';
import { workshopAudio } from './workshop/audio';
import {
  COMPOST_CONTAINER_OPTIONS,
  DRIP_BOTTLE_OPTIONS,
  MULCH_OPTIONS,
  type Door3ProgressState,
} from './workshop/compostData';
import {
  computeTierLiveMetrics,
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
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [systemConfig, setSystemConfig] = useState<SystemConfigState>(DEFAULT_SYSTEM_CONFIG);
  const [adminDocs, setAdminDocs] = useState<AdminDocumentRecord[]>([]);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [competitionStartMs, setCompetitionStartMs] = useState<number | null>(null);
  const [competitionElapsedMs, setCompetitionElapsedMs] = useState(0);
  const systemConfigRef = useRef<SystemConfigState>(DEFAULT_SYSTEM_CONFIG);
  const competitionStartRef = useRef<number | null>(null);

  const [wickModalOpen, setWickModalOpen] = useState(false);
  const [rackPanelOpen, setRackPanelOpen] = useState(false);
  const [elNinoHubOpen, setElNinoHubOpen] = useState(false);
  const [rackDropdownOpen, setRackDropdownOpen] = useState(false);
  const [compostModalOpen, setCompostModalOpen] = useState(false);
  const [compostModalTab, setCompostModalTab] = useState<WorkstationTab | undefined>(undefined);
  const [compostDropdownOpen, setCompostDropdownOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    profileRef.current = farmerProfile;
  }, [farmerProfile]);

  useEffect(() => {
    systemConfigRef.current = systemConfig;
  }, [systemConfig]);

  useEffect(() => {
    competitionStartRef.current = competitionStartMs;
  }, [competitionStartMs]);

  useEffect(() => {
    const unsubConfig = subscribeToSystemConfig((next) => setSystemConfig(next));
    const unsubDocs = subscribeToAdminDocuments((docs) => setAdminDocs(docs));
    return () => {
      unsubConfig();
      unsubDocs();
    };
  }, []);

  useEffect(() => {
    if (!farmerProfile || !systemConfig.competitionTimerEnabled) {
      setCompetitionStartMs(null);
      setCompetitionElapsedMs(0);
      return;
    }
    const start = Date.now();
    setCompetitionStartMs(start);
    setCompetitionElapsedMs(0);
    const id = window.setInterval(() => {
      setCompetitionElapsedMs(Date.now() - start);
    }, 100);
    return () => window.clearInterval(id);
  }, [farmerProfile?.farmerKey, systemConfig.competitionTimerEnabled]);

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
        const prevProfile = profileRef.current;
        const compEnabled = systemConfigRef.current.competitionTimerEnabled;
        const startMs = competitionStartRef.current;
        const elapsed = compEnabled && startMs !== null ? Math.max(500, Date.now() - startMs) : null;

        persistProfileUpdate((prev) => {
          const nextBest =
            step === 'COMPLETE' && elapsed !== null
              ? prev.bestCompetitionMs == null
                ? elapsed
                : Math.min(prev.bestCompetitionMs, elapsed)
              : prev.bestCompetitionMs ?? null;
          return {
            ...prev,
            kitchenStep: step,
            bestCompetitionMs: nextBest,
          };
        });

        if (step === 'COMPLETE' && prevProfile && elapsed !== null) {
          void recordCompetitionRun({
            profile: prevProfile,
            elapsedMs: elapsed,
            milestoneLabel: 'Kitchen PVC Build',
          }).catch((err) => {
            console.error('Failed to record competition run:', err);
          });
        }
      },
      onZoneChanged: (zone: ActiveZone) => {
        persistProfileUpdate((prev) => ({
          ...prev,
          activeZone: zone,
        }));
      },
      onOpenRackManager: () => {
        setNowMs(Date.now());
        setElNinoHubOpen(false);
        setRackPanelOpen(true);
      },
      onOpenElNinoHub: () => {
        setRackPanelOpen(false);
        setElNinoHubOpen(true);
      },
      onOpenCompostStation: (workstation?: 1 | 2 | 3) => {
        setCompostModalTab(workstation);
        setCompostModalOpen(true);
      },
      onDoor3Update: (updater, bonusLitres = 0, narration?: string) => {
        const prevProfile = profileRef.current;
        const nextDoor3Preview = prevProfile ? updater(prevProfile.door3) : null;
        const completedFreshCompost =
          Boolean(prevProfile && nextDoor3Preview) &&
          prevProfile!.door3.compostStep < 6 &&
          nextDoor3Preview!.compostStep >= 6;

        persistProfileUpdate((prev) => {
          const nextDoor3 = updater(prev.door3);
          sceneRef.current?.syncCompostProgress(nextDoor3);
          const didFinishCompost = prev.door3.compostStep < 6 && nextDoor3.compostStep >= 6;
          return {
            ...prev,
            door3: nextDoor3,
            litresSaved: prev.litresSaved + bonusLitres,
            compostYieldsSinceRefresh: didFinishCompost ? 0 : prev.compostYieldsSinceRefresh,
            compostCycleCount: didFinishCompost
              ? prev.compostCycleCount + 1
              : prev.compostCycleCount,
          };
        });
        if (prevProfile && nextDoor3Preview) {
          const nextSnapshot: FarmerProfile = {
            ...prevProfile,
            door3: nextDoor3Preview,
            litresSaved: prevProfile.litresSaved + bonusLitres,
            compostYieldsSinceRefresh: completedFreshCompost
              ? 0
              : prevProfile.compostYieldsSinceRefresh,
            compostCycleCount: completedFreshCompost
              ? prevProfile.compostCycleCount + 1
              : prevProfile.compostCycleCount,
          };
          const uidPrefix = prevProfile.farmerKey.slice(0, 24);
          if (completedFreshCompost) {
            void recordStudentHarvest({
              profile: nextSnapshot,
              itemTitle: 'Rich School Compost Batch',
              category: 'mulch_compost',
              quantity: 2,
              growId: `${uidPrefix}_door3_compost`,
            }).catch((err) => {
              console.error('Failed to publish Door 3 compost batch to store:', err);
            });
          } else if (prevProfile.door3.mulchStep < 4 && nextDoor3Preview.mulchStep >= 4) {
            void recordStudentHarvest({
              profile: nextSnapshot,
              itemTitle: 'Moisture-Shield Mulch Kit',
              category: 'mulch_compost',
              quantity: 2,
              growId: `${uidPrefix}_door3_mulch`,
            }).catch((err) => {
              console.error('Failed to publish Door 3 mulch kit to store:', err);
            });
          } else {
            void syncStudentActiveGrows(nextSnapshot).catch((err) => {
              console.error('Failed to sync Door 3 grow pipeline:', err);
            });
          }
        }
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

  const hasActiveCrops = Boolean(farmerProfile?.tiers.some((t) => t.cropId !== null));

  useEffect(() => {
    if (!rackPanelOpen && !rackDropdownOpen && hudState.activeZone !== 'garden' && !hasActiveCrops) {
      return;
    }
    const intervalMs =
      rackPanelOpen || rackDropdownOpen
        ? 1000
        : hudState.activeZone === 'garden'
          ? 5000
          : 15000;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [rackPanelOpen, rackDropdownOpen, hudState.activeZone, hasActiveCrops]);

  const eligibleBanners = useMemo(() => {
    if (!farmerProfile) return [];
    const activeStages = new Set<BannerStage>(['all', hudState.activeZone]);
    const limit = Math.max(1, systemConfig.compostYieldCycleLimit);
    if (farmerProfile.compostYieldsSinceRefresh >= limit) {
      activeStages.add('compost_needed');
    }
    const anyHarvestReady = farmerProfile.tiers.some(
      (t) =>
        computeTierLiveMetrics(
          t,
          nowMs,
          farmerProfile.weatherMode,
          farmerProfile.shadeClothInstalled
        ).harvestReady
    );
    if (anyHarvestReady) {
      activeStages.add('harvest_ready');
    }

    const stagePriority = (stage: BannerStage): number => {
      if (stage === 'compost_needed' || stage === 'harvest_ready') return 0;
      if (stage === hudState.activeZone) return 1;
      return 2;
    };

    return systemConfig.banners
      .filter((b) => b.active && activeStages.has(b.stage))
      .sort((a, b) => stagePriority(a.stage) - stagePriority(b.stage));
  }, [
    farmerProfile,
    hudState.activeZone,
    systemConfig.banners,
    systemConfig.compostYieldCycleLimit,
    nowMs,
  ]);

  const eligibleBannerKey = eligibleBanners
    .map((b) => `${b.id}:${b.text}:${b.style}:${b.stage}`)
    .join('|');

  useEffect(() => {
    if (!farmerProfile || eligibleBanners.length === 0) {
      setBannerVisible(false);
      setBannerIndex(0);
      return;
    }

    setBannerIndex(0);
    setBannerVisible(true);

    let hideTimer: number | null = null;
    const scheduleHide = () => {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        setBannerVisible(false);
      }, BANNER_DISPLAY_DURATION_MS);
    };

    scheduleHide();
    const cycleTimer = window.setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % eligibleBanners.length);
      setBannerVisible(true);
      scheduleHide();
    }, BANNER_INTERVAL_MS);

    return () => {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      window.clearInterval(cycleTimer);
    };
  }, [farmerProfile?.farmerKey, eligibleBannerKey, eligibleBanners.length]);

  const activeBanner: ChallengeBannerItem | null =
    bannerVisible && eligibleBanners.length > 0
      ? eligibleBanners[bannerIndex % eligibleBanners.length]
      : null;

  const handleStudentLogin = useCallback(
    async (farmerName: string, passcode: string, meta: StudentLoginMetadata) => {
      setLoginLoading(true);
      setLoginError(null);
      workshopAudio.unlock();
      workshopVoiceover.unlockAndSpeakPending();
      try {
        const { profile, isReturning } = await loginOrCreateFarmer(farmerName, passcode, meta);
        setParentProfile(null);
        setAdminProfile(null);
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
        void syncStudentActiveGrows(profile).catch((err) => {
          console.error('Failed to sync student active grows on login:', err);
        });
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : 'Unable to load farm profile.');
      } finally {
        setLoginLoading(false);
      }
    },
    []
  );

  const handleParentLogin = useCallback(async (payload: ParentLoginPayload) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const { profile } = await loginOrCreateParent(payload);
      profileRef.current = null;
      setFarmerProfile(null);
      setAdminProfile(null);
      setParentProfile(profile);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unable to load parent profile.');
    } finally {
      setLoginLoading(false);
    }
  }, []);

  const handleAdminLogin = useCallback(async (adminName: string, passcode: string) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const profile = await claimOrLoginAdmin(adminName, passcode);
      profileRef.current = null;
      setFarmerProfile(null);
      setParentProfile(null);
      setAdminProfile(profile);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unable to verify Admin access.');
    } finally {
      setLoginLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    workshopVoiceover.stop();
    setRackPanelOpen(false);
    setElNinoHubOpen(false);
    setCompostModalOpen(false);
    setWickModalOpen(false);
    setDocsModalOpen(false);
    setLeaderboardOpen(false);
    setFarmerProfile(null);
    setParentProfile(null);
    setAdminProfile(null);
    setLoginError(null);
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

  const handleGuideToDoor = useCallback((targetZone: ActiveZone) => {
    setRackPanelOpen(false);
    setElNinoHubOpen(false);
    setCompostModalOpen(false);
    if (targetZone === 'kitchen') {
      workshopVoiceover.speakCustom(
        'Walk toward South Door 1 (Kitchen) to step inside and fabricate your next self-watering PVC pipe!'
      );
    } else if (targetZone === 'garden') {
      workshopVoiceover.speakCustom(
        'Walk toward South Door 2 (Garden) to step outside and check your Vertical Rack!'
      );
    } else {
      workshopVoiceover.speakCustom(
        'Walk toward South Door 3 (Compost) to step inside and prepare a fresh compost batch!'
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
      const prevSnapshot = profileRef.current;
      const limit = Math.max(1, systemConfigRef.current.compostYieldCycleLimit);
      if (prevSnapshot && prevSnapshot.compostYieldsSinceRefresh >= limit) {
        workshopVoiceover.speakCustom(
          `Your rack needs fresh compost after ${limit} yields! Head to Door 3 Compost to prepare and bring in a new batch first.`
        );
        return;
      }
      workshopAudio.playPlanting();
      persistProfileUpdate((prev) => {
        if (prev.compostYieldsSinceRefresh >= limit) return prev;
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
      if (prevSnapshot && prevSnapshot.compostYieldsSinceRefresh < limit) {
        const nextSnapshot: FarmerProfile = {
          ...prevSnapshot,
          tiers: prevSnapshot.tiers.map((t, idx) =>
            idx === tierIndex
              ? { ...t, cropId, plantedAtMs: now, wateredAtMs: now }
              : t
          ),
        };
        void syncStudentActiveGrows(nextSnapshot).catch((err) => {
          console.error('Failed to sync planted crop to store pipeline:', err);
        });
      }
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
      const prevSnapshot = profileRef.current;
      const harvestedCrop = getCropById(prevSnapshot?.tiers[tierIndex]?.cropId ?? null);
      const limit = Math.max(1, systemConfigRef.current.compostYieldCycleLimit);
      const compEnabled = systemConfigRef.current.competitionTimerEnabled;
      const startMs = competitionStartRef.current;
      const elapsed = compEnabled && startMs !== null ? Math.max(500, now - startMs) : null;

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
        const nextBest =
          elapsed !== null
            ? prev.bestCompetitionMs == null
              ? elapsed
              : Math.min(prev.bestCompetitionMs, elapsed)
            : prev.bestCompetitionMs ?? null;
        return {
          ...prev,
          totalHarvestedCount: prev.totalHarvestedCount + 1,
          foodServings: prev.foodServings + servingsGain,
          compostYieldsSinceRefresh: Math.min(50, prev.compostYieldsSinceRefresh + 1),
          bestCompetitionMs: nextBest,
          tiers: nextTiers,
        };
      });
      if (prevSnapshot) {
        const yieldQty = Math.max(
          1,
          Math.min(8, Math.round((harvestedCrop?.servingsPerHarvest ?? 4) / 2))
        );
        void recordStudentHarvest({
          profile: prevSnapshot,
          itemTitle: harvestedCrop?.name ?? 'Fresh Garden Greens',
          category: 'harvest_produce',
          quantity: yieldQty,
          growId: `${prevSnapshot.farmerKey.slice(0, 24)}_tier_${tierIndex}`,
        }).catch((err) => {
          console.error('Failed to record student harvest to Produce Store:', err);
          workshopVoiceover.speakCustom(
            'Your garden harvest was saved locally, but uploading to the Parent Store failed. Please check your connection and try harvesting another tier.'
          );
        });

        if (elapsed !== null) {
          void recordCompetitionRun({
            profile: prevSnapshot,
            elapsedMs: elapsed,
            milestoneLabel: `Harvest: ${harvestedCrop?.shortLabel ?? 'Crop'}`,
          }).catch((err) => {
            console.error('Failed to record harvest competition run:', err);
          });
        }
      }

      const nextYieldCount = (prevSnapshot?.compostYieldsSinceRefresh ?? 0) + 1;
      if (nextYieldCount >= limit) {
        workshopVoiceover.speakCustom(
          `Great harvest! After ${limit} yield${limit === 1 ? '' : 's'}, your rack compost needs refreshing—head to Door 3 Compost to bring a fresh compost batch in before planting again!`
        );
      } else {
        workshopVoiceover.speakCustom(
          'Great harvest! Your shaded wicking pipe saved water through the dry spell. Your fresh harvest is now live on the School Produce Store!'
        );
      }
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
      const prevProfile = profileRef.current;
      const nextDoor3Preview = prevProfile ? updater(prevProfile.door3) : null;
      const completedFreshCompost =
        Boolean(prevProfile && nextDoor3Preview) &&
        prevProfile!.door3.compostStep < 6 &&
        nextDoor3Preview!.compostStep >= 6;
      workshopAudio.playPickup();
      persistProfileUpdate((prev) => {
        const nextDoor3 = updater(prev.door3);
        sceneRef.current?.syncCompostProgress(nextDoor3);
        const didFinishCompost = prev.door3.compostStep < 6 && nextDoor3.compostStep >= 6;
        return {
          ...prev,
          door3: nextDoor3,
          litresSaved: prev.litresSaved + bonusLitres,
          compostYieldsSinceRefresh: didFinishCompost ? 0 : prev.compostYieldsSinceRefresh,
          compostCycleCount: didFinishCompost
            ? prev.compostCycleCount + 1
            : prev.compostCycleCount,
        };
      });
      if (prevProfile && nextDoor3Preview) {
        const nextSnapshot: FarmerProfile = {
          ...prevProfile,
          door3: nextDoor3Preview,
          litresSaved: prevProfile.litresSaved + bonusLitres,
          compostYieldsSinceRefresh: completedFreshCompost
            ? 0
            : prevProfile.compostYieldsSinceRefresh,
          compostCycleCount: completedFreshCompost
            ? prevProfile.compostCycleCount + 1
            : prevProfile.compostCycleCount,
        };
        const uidPrefix = prevProfile.farmerKey.slice(0, 24);
        if (completedFreshCompost) {
          void recordStudentHarvest({
            profile: nextSnapshot,
            itemTitle: 'Rich School Compost Batch',
            category: 'mulch_compost',
            quantity: 2,
            growId: `${uidPrefix}_door3_compost`,
          }).catch((err) => {
            console.error('Failed to publish Door 3 compost batch to store:', err);
          });
        } else if (prevProfile.door3.mulchStep < 4 && nextDoor3Preview.mulchStep >= 4) {
          void recordStudentHarvest({
            profile: nextSnapshot,
            itemTitle: 'Moisture-Shield Mulch Kit',
            category: 'mulch_compost',
            quantity: 2,
            growId: `${uidPrefix}_door3_mulch`,
          }).catch((err) => {
            console.error('Failed to publish Door 3 mulch kit to store:', err);
          });
        } else {
          void syncStudentActiveGrows(nextSnapshot).catch((err) => {
            console.error('Failed to sync Door 3 progress to store pipeline:', err);
          });
        }
      }
      if (narration) {
        workshopAudio.playPourAndBloom();
        workshopVoiceover.speakCustom(narration);
      }
    },
    [persistProfileUpdate]
  );

  const handleStartFreshCompostCycle = useCallback(() => {
    workshopAudio.playPickup();
    persistProfileUpdate((prev) => {
      const nextDoor3: Door3ProgressState = {
        ...prev.door3,
        compostContainer: null,
        compostStep: 0,
      };
      sceneRef.current?.syncCompostProgress(nextDoor3);
      return {
        ...prev,
        door3: nextDoor3,
      };
    });
    workshopVoiceover.speakCustom(
      'Starting a fresh compost batch! Choose your composter container, collect Greens and Browns, layer 2:1, and mist with water to nourish your Vertical Rack.'
    );
  }, [persistProfileUpdate]);

  const handleBuildAnotherPipe = useCallback(() => {
    handleGuideToDoor('kitchen');
  }, [handleGuideToDoor]);

  const currentStep = BUILD_STEPS[hudState.stepId];
  const isKitchenComplete = hudState.activeZone === 'kitchen' && hudState.stepId === 'COMPLETE';
  const hasReadyPipe = farmerProfile?.kitchenStep === 'COMPLETE' || hudState.stepId === 'COMPLETE';
  const isDoorTarget =
    (hudState.activeZone === 'garden' &&
      (hudState.gardenTarget === 'kitchen_door' || hudState.gardenTarget === 'compost_door')) ||
    (hudState.activeZone === 'compost' &&
      (hudState.compostTarget === 'garden_door' || hudState.compostTarget === 'kitchen_door'));

  const dualActionLabel =
    hudState.activeZone === 'garden'
      ? hudState.gardenTarget === 'compost_door'
        ? 'Walk Through → Door 3 Compost'
        : hudState.gardenTarget === 'kitchen_door'
          ? 'Walk Through → Door 1 Kitchen'
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
      ? hudState.gardenTarget === 'compost_door' || hudState.gardenTarget === 'kitchen_door'
        ? dualActionLabel
        : 'Walk to Rack, JoJo or Doors'
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
            isDoorTarget={isDoorTarget}
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
            compostYieldsSinceRefresh={farmerProfile.compostYieldsSinceRefresh}
            compostYieldCycleLimit={systemConfig.compostYieldCycleLimit}
            competitionTimerEnabled={systemConfig.competitionTimerEnabled}
            competitionElapsedMs={competitionElapsedMs}
            bestCompetitionMs={farmerProfile.bestCompetitionMs ?? null}
            activeBanner={activeBanner}
            onDismissBanner={() => setBannerVisible(false)}
            adminDocCount={adminDocs.length}
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
              setElNinoHubOpen(false);
              setRackPanelOpen(true);
            }}
            onOpenElNinoHub={() => {
              setRackPanelOpen(false);
              setElNinoHubOpen(true);
            }}
            onOpenCompostStation={(workstation?: 1 | 2 | 3) => {
              setCompostModalTab(workstation);
              setCompostModalOpen(true);
            }}
            onOpenAdminDocs={() => setDocsModalOpen(true)}
            leaderboardOpen={leaderboardOpen}
            onToggleLeaderboard={() => setLeaderboardOpen((v) => !v)}
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

              {hudState.compostTarget === 'compost_bay' &&
                farmerProfile.door3.compostStep >= 6 &&
                farmerProfile.compostYieldsSinceRefresh >= systemConfig.compostYieldCycleLimit && (
                  <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-xl bg-amber-950/95 border border-amber-400 px-3 py-2 shadow-lg">
                    <span className="text-xs font-semibold text-amber-200">
                      Rack compost depleted after {systemConfig.compostYieldCycleLimit} yields!
                    </span>
                    <button
                      type="button"
                      onClick={handleStartFreshCompostCycle}
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Bring Fresh Compost In
                    </button>
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

      {/* Split Login Overlay for Students, Parents / Sponsors, and Admin */}
      {!farmerProfile && !parentProfile && !adminProfile && (
        <FarmerLoginOverlay
          onStudentLogin={handleStudentLogin}
          onParentLogin={handleParentLogin}
          onAdminLogin={handleAdminLogin}
          loading={loginLoading}
          errorMsg={loginError}
          onClearError={() => setLoginError(null)}
        />
      )}

      {/* Isolated Parent / Sponsor Portal */}
      {parentProfile && (
        <ParentPortal profile={parentProfile} onLogout={handleLogout} />
      )}

      {/* Isolated Admin Control Center */}
      {adminProfile && (
        <AdminPortal
          admin={adminProfile}
          systemConfig={systemConfig}
          onLogout={handleLogout}
        />
      )}

      {/* Interactive Capillary Wick & Air-Gap Cross-Section Modal */}
      <WickExplainerModal
        open={wickModalOpen}
        onClose={() => setWickModalOpen(false)}
      />

      {/* Admin Uploaded Guides & Documents Viewer */}
      <AdminDocumentsModal
        open={docsModalOpen}
        documents={adminDocs}
        onClose={() => setDocsModalOpen(false)}
      />

      {/* Vertical Hydroponic Rack Stand (Separated from El Niño Defense & Compost) */}
      {farmerProfile && (
        <GardenRackPanel
          open={rackPanelOpen}
          rackSize={farmerProfile.rackSize}
          tiers={farmerProfile.tiers}
          hasReadyPipe={hasReadyPipe}
          totalHarvestedCount={farmerProfile.totalHarvestedCount}
          jojoLitres={farmerProfile.jojoLitres}
          shadeClothInstalled={farmerProfile.shadeClothInstalled}
          weatherMode={farmerProfile.weatherMode}
          litresSaved={farmerProfile.litresSaved}
          foodServings={farmerProfile.foodServings}
          compostYieldsSinceRefresh={farmerProfile.compostYieldsSinceRefresh}
          compostYieldCycleLimit={systemConfig.compostYieldCycleLimit}
          compostCycleCount={farmerProfile.compostCycleCount}
          nowMs={nowMs}
          onClose={() => setRackPanelOpen(false)}
          onChangeRackSize={handleChangeRackSize}
          onDeployPipe={handleDeployPipe}
          onPlantSeed={handlePlantSeed}
          onWaterTier={handleWaterTier}
          onHarvestTier={handleHarvestTier}
          onBuildAnotherPipe={handleBuildAnotherPipe}
          onOpenElNinoHub={() => {
            setRackPanelOpen(false);
            setElNinoHubOpen(true);
          }}
          onSwitchToCompost={() => handleGuideToDoor('compost')}
        />
      )}

      {/* Separate El Niño Defense Hub (JoJo Tank, 40% Shade Cloth & Forecast) */}
      {farmerProfile && (
        <ElNinoDefenseModal
          open={elNinoHubOpen}
          jojoInstalled={farmerProfile.jojoInstalled}
          jojoLitres={farmerProfile.jojoLitres}
          jojoCapacity={farmerProfile.jojoCapacity}
          shadeClothInstalled={farmerProfile.shadeClothInstalled}
          weatherMode={farmerProfile.weatherMode}
          litresSaved={farmerProfile.litresSaved}
          compostCycleCount={farmerProfile.compostCycleCount}
          onClose={() => setElNinoHubOpen(false)}
          onInstallJojo={handleInstallJojo}
          onRefillJojo={handleRefillJojo}
          onToggleShadeCloth={handleToggleShadeCloth}
          onAdvanceWeather={handleAdvanceWeather}
          onOpenRackManager={() => {
            setNowMs(Date.now());
            setElNinoHubOpen(false);
            setRackPanelOpen(true);
          }}
          onSwitchToCompost={() => handleGuideToDoor('compost')}
        />
      )}

      {/* Door 3: Recycling & Composting Station (3 Sequential Workstations + Refresh Cycle) */}
      {farmerProfile && (
        <CompostStationModal
          open={compostModalOpen}
          initialWorkstation={compostModalTab}
          gradeTier={gradeTier}
          progress={farmerProfile.door3}
          litresSaved={farmerProfile.litresSaved}
          compostYieldsSinceRefresh={farmerProfile.compostYieldsSinceRefresh}
          compostYieldCycleLimit={systemConfig.compostYieldCycleLimit}
          compostCycleCount={farmerProfile.compostCycleCount}
          onClose={() => setCompostModalOpen(false)}
          onUpdateProgress={handleUpdateDoor3}
          onStartFreshCompostCycle={handleStartFreshCompostCycle}
          onSwitchToGarden={() => handleGuideToDoor('garden')}
        />
      )}

      {/* Full-Screen Live Leaderboard Accessible from Student HUD */}
      {farmerProfile && (
        <LeaderboardModal
          open={leaderboardOpen}
          onClose={() => setLeaderboardOpen(false)}
          viewerRole="student"
          currentStudentUid={farmerProfile.farmerKey}
          currentSchoolName={farmerProfile.schoolName}
          currentGrade={farmerProfile.grade}
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
