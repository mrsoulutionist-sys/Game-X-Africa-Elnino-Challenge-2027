import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Droplets,
  Layers,
  Lock,
  Recycle,
  Scissors,
  ShieldCheck,
  Sparkles,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import {
  COMPOST_CONTAINER_OPTIONS,
  COMPOST_INGREDIENTS,
  COMPOST_SORT_CHECK_ITEMS,
  DOOR3_GRADE_TIPS,
  DRIP_BOTTLE_OPTIONS,
  MULCH_OPTIONS,
  countDoor3CompletedWorkstations,
  type CompostContainerType,
  type Door3ProgressState,
  type DripBottleType,
  type MulchMaterialType,
} from '../workshop/compostData';
import type { GradeTier } from '../workshop/steps';

export type WorkstationTab = 1 | 2 | 3;

interface CompostStationModalProps {
  open: boolean;
  initialWorkstation?: WorkstationTab;
  gradeTier: GradeTier;
  progress: Door3ProgressState;
  litresSaved: number;
  compostYieldsSinceRefresh: number;
  compostYieldCycleLimit: number;
  compostCycleCount: number;
  onClose: () => void;
  onUpdateProgress: (updater: (prev: Door3ProgressState) => Door3ProgressState, bonusLitres?: number, narration?: string) => void;
  onStartFreshCompostCycle: () => void;
  onSwitchToGarden: () => void;
}

export const CompostStationModal: React.FC<CompostStationModalProps> = ({
  open,
  initialWorkstation,
  gradeTier,
  progress,
  litresSaved,
  compostYieldsSinceRefresh,
  compostYieldCycleLimit,
  compostCycleCount,
  onClose,
  onUpdateProgress,
  onStartFreshCompostCycle,
  onSwitchToGarden,
}) => {
  const [activeTab, setActiveTab] = useState<WorkstationTab>(1);
  const [holeCount, setHoleCount] = useState<number>(progress.dripStep >= 2 ? 3 : 0);
  const [gatheredIds, setGatheredIds] = useState<string[]>(() =>
    progress.compostStep >= 2 ? COMPOST_INGREDIENTS.map((i) => i.id) : []
  );
  const [lastSortFeedback, setLastSortFeedback] = useState<{
    id: string;
    ok: boolean;
    message: string;
  } | null>(null);
  const [testedAvoidIds, setTestedAvoidIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initialWorkstation) {
      setActiveTab(initialWorkstation);
      return;
    }
    if (progress.dripStep < 4) setActiveTab(1);
    else if (progress.compostStep < 6) setActiveTab(2);
    else setActiveTab(3);
  }, [open, initialWorkstation, progress.dripStep, progress.compostStep]);

  useEffect(() => {
    if (progress.dripStep >= 2 && holeCount < 3) {
      setHoleCount(3);
    }
  }, [progress.dripStep, holeCount]);

  useEffect(() => {
    if (progress.compostStep >= 2 && gatheredIds.length < COMPOST_INGREDIENTS.length) {
      setGatheredIds(COMPOST_INGREDIENTS.map((i) => i.id));
    }
  }, [progress.compostStep, gatheredIds.length]);

  if (!open) return null;

  const ws1Done = progress.dripStep >= 4;
  const ws2Done = progress.compostStep >= 6;
  const ws3Done = progress.mulchStep >= 4;
  const completedCount = countDoor3CompletedWorkstations(progress);
  const gradeTips = DOOR3_GRADE_TIPS[gradeTier];
  const safeLimit = Math.max(1, compostYieldCycleLimit);
  const yieldsRemaining = Math.max(0, safeLimit - compostYieldsSinceRefresh);
  const compostNeedsRefresh = compostYieldsSinceRefresh >= safeLimit;

  const handleRestartCompostBatch = () => {
    setGatheredIds([]);
    setLastSortFeedback(null);
    onStartFreshCompostCycle();
  };

  const handleSelectBottle = (bottleId: DripBottleType) => {
    setHoleCount(0);
    onUpdateProgress((prev) => ({
      ...prev,
      dripBottleType: bottleId,
      dripStep: Math.max(prev.dripStep, 1),
    }));
  };

  const handlePokeHole = () => {
    const nextHoles = Math.min(3, holeCount + 1);
    setHoleCount(nextHoles);
    if (nextHoles >= 3 && progress.dripStep < 2) {
      onUpdateProgress(
        (prev) => ({
          ...prev,
          dripStep: Math.max(prev.dripStep, 2),
        }),
        0,
        'Nice piercing! Tiny pinholes at the bottom third plus one cap pinhole let gravity drip slowly without flooding.'
      );
    }
  };

  const handleBuryBottle = () => {
    if (progress.dripStep < 2) return;
    onUpdateProgress((prev) => ({
      ...prev,
      dripStep: Math.max(prev.dripStep, 3),
    }));
  };

  const handleFillAndCapBottle = () => {
    if (progress.dripStep < 3) return;
    const isFirstFinish = progress.dripStep < 4;
    onUpdateProgress(
      (prev) => ({
        ...prev,
        dripStep: 4,
      }),
      isFirstFinish ? 12 : 0,
      'Workstation 1 complete! Underground drip feeds roots directly and cuts El Niño surface evaporation by up to 70%.'
    );
  };

  const handleSelectContainer = (container: CompostContainerType) => {
    onUpdateProgress((prev) => ({
      ...prev,
      compostContainer: container,
      compostStep: Math.max(prev.compostStep, 1),
    }));
  };

  const handleToggleGather = (id: string) => {
    setGatheredIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      if (next.length >= COMPOST_INGREDIENTS.length && progress.compostStep < 2) {
        onUpdateProgress((p) => ({
          ...p,
          compostStep: Math.max(p.compostStep, 2),
        }));
      }
      return next;
    });
  };

  const handleGatherAllRemaining = () => {
    const allIds = COMPOST_INGREDIENTS.map((i) => i.id);
    setGatheredIds(allIds);
    if (progress.compostStep < 2) {
      onUpdateProgress((p) => ({
        ...p,
        compostStep: Math.max(p.compostStep, 2),
      }));
    }
  };

  const handleTestSortItem = (item: (typeof COMPOST_SORT_CHECK_ITEMS)[number]) => {
    const ok = item.category !== 'avoid';
    setLastSortFeedback({
      id: item.id,
      ok,
      message: item.reason,
    });
    if (!ok && !testedAvoidIds.includes(item.id)) {
      const nextAvoid = [...testedAvoidIds, item.id];
      setTestedAvoidIds(nextAvoid);
      onUpdateProgress((prev) => ({
        ...prev,
        compostRejectTested: Math.min(4, Math.max(prev.compostRejectTested, nextAvoid.length)),
      }));
    }
  };

  const handleAddCompostLayer = (targetStep: 3 | 4 | 5 | 6) => {
    if (progress.compostStep < targetStep - 1) return;
    const isCompleting = targetStep === 6 && progress.compostStep < 6;
    onUpdateProgress(
      (prev) => ({
        ...prev,
        compostStep: Math.max(prev.compostStep, targetStep),
      }),
      isCompleting ? 10 : 0,
      isCompleting
        ? 'Workstation 2 complete! Your 2:1 Browns-to-Greens compost turns kitchen and yard scraps into living sponge-like soil.'
        : undefined
    );
  };

  const handleSelectMulch = (material: MulchMaterialType) => {
    onUpdateProgress((prev) => ({
      ...prev,
      mulchMaterial: material,
      mulchStep: Math.max(prev.mulchStep, 1),
    }));
  };

  const handleMulchAction = (targetStep: 2 | 3 | 4) => {
    if (progress.mulchStep < targetStep - 1) return;
    const isCompleting = targetStep === 4 && progress.mulchStep < 4;
    onUpdateProgress(
      (prev) => ({
        ...prev,
        mulchStep: Math.max(prev.mulchStep, targetStep),
      }),
      isCompleting ? 18 : 0,
      isCompleting
        ? 'All 3 Door 3 workstations complete! Prevention is better than cure—your soil is fed, dripped, and sun-shielded against El Niño.'
        : undefined
    );
  };

  const greensCollected = COMPOST_INGREDIENTS.filter(
    (i) => i.category === 'green' && gatheredIds.includes(i.id)
  ).length;
  const brownsCollected = COMPOST_INGREDIENTS.filter(
    (i) => i.category === 'brown' && gatheredIds.includes(i.id)
  ).length;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-2.5 sm:p-5">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-950 border border-emerald-500/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-800 bg-slate-900/70">
          <div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono text-emerald-400">
              <span>Door 3 · Recycling &amp; Composting Station</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-300">Prevention is Better Than Cure</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-300 tabular-nums">{Math.round(litresSaved)} L Saved</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
              Zero-Waste El Niño Soil &amp; Drip Lab ({completedCount}/3 Complete)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Door 3 workstation panel"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sequential 3-Workstation Stepper Tabs */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-slate-800 bg-slate-900/40 grid grid-cols-3 gap-2">
          {[
            {
              id: 1 as WorkstationTab,
              title: '1. 2L Drip-Feeder',
              sub: ws1Done ? 'Done' : `Step ${Math.min(4, progress.dripStep + 1)}/4`,
              done: ws1Done,
              locked: false,
            },
            {
              id: 2 as WorkstationTab,
              title: '2. Composter',
              sub: ws2Done ? 'Done' : `Step ${Math.min(6, progress.compostStep + 1)}/6`,
              done: ws2Done,
              locked: false,
            },
            {
              id: 3 as WorkstationTab,
              title: '3. Mulch Shield',
              sub: ws3Done ? 'Done' : `Step ${Math.min(4, progress.mulchStep + 1)}/4`,
              done: ws3Done,
              locked: false,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={tab.locked}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 text-left border transition-colors ${
                  tab.locked
                    ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed'
                    : isActive
                      ? 'bg-emerald-600/20 border-emerald-400 text-white cursor-pointer'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600 cursor-pointer'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[11px] sm:text-xs font-bold truncate">{tab.title}</div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">{tab.sub}</div>
                </div>
                {tab.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : tab.locked ? (
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* WORKSTATION 1 — 2L BOTTLE DRIP-FEEDER */}
          {activeTab === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                {/* Left: Step 1 Recycling Shelf + Step 2 Actions */}
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-300">
                        Step 1 · Pick a 2L Bottle from Recycling Shelf
                      </span>
                      {progress.dripStep >= 1 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {DRIP_BOTTLE_OPTIONS.map((opt) => {
                        const selected = progress.dripBottleType === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectBottle(opt.id)}
                            className={`flex items-center gap-3 rounded-lg p-2.5 border text-left transition-colors cursor-pointer ${
                              selected
                                ? 'bg-sky-950/70 border-sky-400 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <div
                              className="w-8 h-10 rounded-md border flex items-center justify-center shrink-0 font-mono text-[10px] font-bold"
                              style={{
                                borderColor: opt.tintHex,
                                color: opt.tintHex,
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                              }}
                            >
                              2L
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold truncate">{opt.label}</div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {opt.materialCode} · {opt.badgeText}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2 Sequential Interactive Actions */}
                  <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-white">
                      Step 2 · Build Your Underground Drip-Feeder
                    </div>

                    {/* 2a: Poke Tiny Holes */}
                    <button
                      type="button"
                      disabled={progress.dripStep < 1 || progress.dripStep >= 2}
                      onClick={handlePokeHole}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold border transition-colors ${
                        progress.dripStep >= 2
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                          : progress.dripStep >= 1
                            ? 'bg-sky-600 hover:bg-sky-500 border-sky-400 text-white cursor-pointer'
                            : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-left">
                        (a) Poke Tiny Holes in Bottom Third &amp; Cap ({holeCount}/3)
                      </span>
                      {progress.dripStep >= 2 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950/40 shrink-0">
                          Tap to Poke
                        </span>
                      )}
                    </button>

                    {/* 2b: Bury Bottom Half */}
                    <button
                      type="button"
                      disabled={progress.dripStep < 2 || progress.dripStep >= 3}
                      onClick={handleBuryBottle}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold border transition-colors ${
                        progress.dripStep >= 3
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                          : progress.dripStep >= 2
                            ? 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white cursor-pointer'
                            : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-left">(b) Bury Bottom Half Next to Plant Roots</span>
                      {progress.dripStep >= 3 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </button>

                    {/* 2c: Fill with Water & Cap */}
                    <button
                      type="button"
                      disabled={progress.dripStep < 3 || progress.dripStep >= 4}
                      onClick={handleFillAndCapBottle}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold border transition-colors ${
                        progress.dripStep >= 4
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                          : progress.dripStep >= 3
                            ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white cursor-pointer'
                            : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-left">(c) Fill with Water &amp; Screw Pinhole Cap</span>
                      {progress.dripStep >= 4 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Right: Live Root-Zone Comparison & Diagram */}
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Droplets className="w-4 h-4 text-sky-400" />
                      Why Underground Drip Beats Surface Watering
                    </div>
                    <div className="mt-2.5 rounded-lg bg-slate-950 border border-slate-800 p-2.5">
                      <svg
                        viewBox="0 0 360 190"
                        className="w-full h-auto"
                        aria-label="Surface evaporation vs 2L bottle root drip diagram"
                      >
                        {/* Hot El Nino Sun */}
                        <circle cx="88" cy="24" r="14" fill="#f59e0b" />
                        <text x="110" y="28" fill="#fbbf24" fontSize="10" fontFamily="monospace">
                          EL NIÑO SUN (EVAPORATION)
                        </text>

                        {/* Divider */}
                        <line x1="180" y1="36" x2="180" y2="182" stroke="#334155" strokeDasharray="4 4" />

                        {/* Left: Surface Watering */}
                        <text x="16" y="54" fill="#f87171" fontSize="10" fontWeight="bold" fontFamily="monospace">
                          SURFACE POUR (-70% LOST)
                        </text>
                        <rect x="14" y="106" width="152" height="72" rx="6" fill="#4a3321" />
                        <path d="M 45 102 Q 55 82 50 66" stroke="#fb923c" strokeWidth="2" fill="none" strokeDasharray="3 3" />
                        <path d="M 80 102 Q 90 80 84 62" stroke="#fb923c" strokeWidth="2" fill="none" strokeDasharray="3 3" />
                        <rect x="26" y="103" width="128" height="7" rx="3" fill="#38bdf8" opacity="0.65" />
                        <line x1="115" y1="74" x2="115" y2="106" stroke="#4ade80" strokeWidth="3" />
                        <ellipse cx="105" cy="78" rx="9" ry="4" fill="#22c55e" />
                        <ellipse cx="125" cy="76" rx="9" ry="4" fill="#4ade80" />
                        {/* Dry shallow roots */}
                        <path d="M 115 108 L 105 130 M 115 108 L 126 128" stroke="#d6b88d" strokeWidth="2" />

                        {/* Right: 2L Underground Bottle */}
                        <text x="192" y="54" fill="#34d399" fontSize="10" fontWeight="bold" fontFamily="monospace">
                          2L DRIP-FEEDER (ROOT ZONE)
                        </text>
                        <rect x="194" y="106" width="152" height="72" rx="6" fill="#4a3321" />
                        {/* Plant & Deep Healthy Roots */}
                        <line x1="292" y1="68" x2="292" y2="106" stroke="#4ade80" strokeWidth="3" />
                        <ellipse cx="281" cy="74" rx="10" ry="5" fill="#22c55e" />
                        <ellipse cx="303" cy="72" rx="10" ry="5" fill="#4ade80" />
                        <path
                          d="M 292 108 Q 272 130 256 156 M 292 108 Q 288 136 276 164 M 292 108 Q 308 135 318 158"
                          stroke="#bae6fd"
                          strokeWidth="2.2"
                          fill="none"
                        />

                        {/* 2L Bottle visual */}
                        {progress.dripStep >= 1 && (
                          <g
                            transform={
                              progress.dripStep >= 3
                                ? 'translate(216, 78)'
                                : 'translate(216, 56)'
                            }
                          >
                            <rect
                              x="0"
                              y="12"
                              width="34"
                              height="66"
                              rx="8"
                              fill={
                                progress.dripBottleType === 'green_sparkling'
                                  ? 'rgba(52,211,153,0.38)'
                                  : 'rgba(186,230,253,0.32)'
                              }
                              stroke={
                                progress.dripBottleType === 'green_sparkling' ? '#34d399' : '#7dd3fc'
                              }
                              strokeWidth="2"
                            />
                            {progress.dripStep >= 4 && (
                              <rect x="3" y="26" width="28" height="49" rx="5" fill="#0284c7" opacity="0.78" />
                            )}
                            {/* Cap */}
                            <rect x="10" y="4" width="14" height="8" rx="2" fill="#f59e0b" />
                            {/* Holes in bottom third */}
                            {(holeCount >= 1 || progress.dripStep >= 2) && (
                              <circle cx="8" cy="64" r="2.5" fill="#fbbf24" />
                            )}
                            {(holeCount >= 2 || progress.dripStep >= 2) && (
                              <circle cx="26" cy="68" r="2.5" fill="#fbbf24" />
                            )}
                            {(holeCount >= 3 || progress.dripStep >= 2) && (
                              <circle cx="17" cy="6" r="2" fill="#ffffff" />
                            )}
                            {/* Drip arrows to roots */}
                            {progress.dripStep >= 4 && (
                              <>
                                <circle cx="38" cy="66" r="3" fill="#38bdf8" />
                                <circle cx="46" cy="72" r="2.5" fill="#38bdf8" />
                                <circle cx="36" cy="76" r="2.5" fill="#38bdf8" />
                              </>
                            )}
                          </g>
                        )}
                      </svg>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-950/80 border border-sky-500/30 p-3 text-xs text-slate-200 leading-relaxed">
                    <span className="font-semibold text-sky-300">Why it works ({gradeTier}): </span>
                    {gradeTips.station1}
                  </div>

                  {ws1Done && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(2)}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Continue to Workstation 2: Composter</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* WORKSTATION 2 — BUCKET / CRATE / PALLET COMPOSTER */}
          {activeTab === 2 && (
            <div className="space-y-4">
              {/* Compost Yield Refresh Cycle Card */}
              <div
                className={`rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                  compostNeedsRefresh
                    ? 'bg-amber-950/55 border-amber-400/60 text-amber-100'
                    : 'bg-emerald-950/35 border-emerald-500/35 text-emerald-100'
                }`}
              >
                <div className="space-y-0.5 text-xs">
                  <div className="font-bold flex items-center gap-1.5">
                    <Recycle className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>
                      {compostNeedsRefresh
                        ? `Compost Refresh Required (${safeLimit} Yields Harvested)`
                        : `Rack Compost Vitality: ${yieldsRemaining}/${safeLimit} yields left`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {compostNeedsRefresh
                      ? 'Your garden beds have used up their compost nutrients. Build & mist a fresh batch below to unlock new yields!'
                      : `Cycles delivered to Vertical Rack: ${compostCycleCount}. Redo compost every ${safeLimit} yields to keep soil rich.`}
                  </p>
                </div>

                {ws2Done && (
                  <button
                    type="button"
                    onClick={handleRestartCompostBatch}
                    className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer shrink-0 transition-colors ${
                      compostNeedsRefresh
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40'
                    }`}
                  >
                    Bring Fresh Compost Batch In
                  </button>
                )}
              </div>

              {/* Step 1: Container Selection */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">
                    Step 1 · Choose Your Composter Container
                  </span>
                  {progress.compostStep >= 1 && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {COMPOST_CONTAINER_OPTIONS.map((opt) => {
                    const selected = progress.compostContainer === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectContainer(opt.id)}
                        className={`rounded-xl p-3 border text-left transition-colors cursor-pointer ${
                          selected
                            ? 'bg-emerald-950/60 border-emerald-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
                          {opt.dimensions}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                          {opt.spaceFit}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Ingredient Collection */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-white">
                      Step 2 · Gather Greens (Door 1) &amp; Browns (Door 2 &amp; Recycling)
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Greens: {greensCollected}/3 · Browns: {brownsCollected}/3
                    </div>
                  </div>
                  {progress.compostStep >= 1 && gatheredIds.length < COMPOST_INGREDIENTS.length && (
                    <button
                      type="button"
                      onClick={handleGatherAllRemaining}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Collect All Ingredients
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {COMPOST_INGREDIENTS.map((item) => {
                    const collected = gatheredIds.includes(item.id);
                    const isGreen = item.category === 'green';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={progress.compostStep < 1}
                        onClick={() => handleToggleGather(item.id)}
                        className={`rounded-lg p-2.5 border text-left transition-colors ${
                          progress.compostStep < 1
                            ? 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                            : collected
                              ? isGreen
                                ? 'bg-emerald-950/60 border-emerald-500/60 text-white'
                                : 'bg-amber-950/50 border-amber-500/60 text-white'
                              : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={`text-[10px] font-mono font-bold uppercase ${
                              isGreen ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {isGreen ? 'Green (N)' : 'Brown (C)'}
                          </span>
                          {collected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </div>
                        <div className="text-xs font-bold mt-0.5">{item.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.sourceLabel}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Interactive Layering Builder & Avoid Feedback */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      Step 3 · Build Your Compost Layers
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300">2 Browns : 1 Green</span>
                  </div>

                  {[
                    { step: 3 as const, label: '1. Add Twigs Base (Airflow & Drainage)' },
                    { step: 4 as const, label: '2. Add 1 Part Greens (Peels, Scraps & Rooibos)' },
                    { step: 5 as const, label: '3. Add 2 Parts Browns (Leaves & Shredded Cardboard)' },
                    { step: 6 as const, label: '4. Mist Lightly with Water (Damp Sponge Feel)' },
                  ].map((layer) => {
                    const done = progress.compostStep >= layer.step;
                    const ready = progress.compostStep === layer.step - 1;
                    return (
                      <button
                        key={layer.step}
                        type="button"
                        disabled={!ready}
                        onClick={() => handleAddCompostLayer(layer.step)}
                        className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold border transition-colors ${
                          done
                            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                            : ready
                              ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white cursor-pointer'
                              : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-left">{layer.label}</span>
                        {done && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}

                  {/* Live Cross-Section Container Visualization */}
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-2.5">
                    <svg viewBox="0 0 280 120" className="w-full h-auto" aria-label="Compost layers cross section">
                      {/* Container Outline */}
                      <rect
                        x="60"
                        y="14"
                        width="160"
                        height="94"
                        rx={progress.compostContainer === 'bucket' ? 12 : 4}
                        fill="#0f172a"
                        stroke={
                          progress.compostContainer === 'pallet'
                            ? '#b45309'
                            : progress.compostContainer === 'crate'
                              ? '#14b8a6'
                              : '#3b82f6'
                        }
                        strokeWidth="4"
                      />
                      {progress.compostStep >= 3 && (
                        <rect x="66" y="84" width="148" height="18" rx="3" fill="#78350f" />
                      )}
                      {progress.compostStep >= 4 && (
                        <rect x="66" y="64" width="148" height="19" rx="3" fill="#15803d" />
                      )}
                      {progress.compostStep >= 5 && (
                        <rect x="66" y="38" width="148" height="25" rx="3" fill="#a16207" />
                      )}
                      {progress.compostStep >= 6 && (
                        <>
                          <rect x="66" y="24" width="148" height="13" rx="3" fill="#38bdf8" opacity="0.35" />
                          <circle cx="95" cy="22" r="2.5" fill="#7dd3fc" />
                          <circle cx="140" cy="20" r="2.5" fill="#7dd3fc" />
                          <circle cx="185" cy="22" r="2.5" fill="#7dd3fc" />
                        </>
                      )}
                      <text x="140" y="96" textAnchor="middle" fill="#fef3c7" fontSize="9" fontFamily="monospace">
                        {progress.compostStep >= 3 ? 'TWIGS BASE' : 'EMPTY CONTAINER'}
                      </text>
                      {progress.compostStep >= 4 && (
                        <text x="140" y="77" textAnchor="middle" fill="#dcfce7" fontSize="9" fontFamily="monospace">
                          1 PART GREENS
                        </text>
                      )}
                      {progress.compostStep >= 5 && (
                        <text x="140" y="54" textAnchor="middle" fill="#fef9c3" fontSize="9" fontFamily="monospace">
                          2 PARTS BROWNS
                        </text>
                      )}
                    </svg>
                  </div>
                </div>

                {/* Belongs vs. Avoid Instant Feedback Tester */}
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-300">
                        Quick Check · What Belongs vs. What to Avoid
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Avoid traps spotted: {progress.compostRejectTested}/4
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Tap any item below to see whether it helps microbes or ruins compost:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {COMPOST_SORT_CHECK_ITEMS.map((item) => {
                        const isSelected = lastSortFeedback?.id === item.id;
                        const isAvoid = item.category === 'avoid';
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleTestSortItem(item)}
                            className={`rounded-lg px-2.5 py-2 border text-left text-[11px] font-semibold transition-colors cursor-pointer ${
                              isSelected
                                ? isAvoid
                                  ? 'bg-rose-950/70 border-rose-400 text-rose-100'
                                  : 'bg-emerald-950/70 border-emerald-400 text-emerald-100'
                                : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-600'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    {lastSortFeedback && (
                      <div
                        className={`rounded-lg border p-2.5 text-xs flex items-start gap-2 ${
                          lastSortFeedback.ok
                            ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                            : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                        }`}
                      >
                        {lastSortFeedback.ok ? (
                          <ThumbsUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <ThumbsDown className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <span>{lastSortFeedback.message}</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-950/80 border border-emerald-500/30 p-3 text-xs text-slate-200 leading-relaxed">
                    <span className="font-semibold text-emerald-300">Compost Tip ({gradeTier}): </span>
                    {gradeTips.station2}
                  </div>

                  {ws2Done && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={onSwitchToGarden}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sprout className="w-4 h-4" />
                        <span>Take Compost to Rack</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab(3)}
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Workstation 3: Mulch Shield</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* WORKSTATION 3 — CARDBOARD MULCH & MOISTURE SHIELD */}
          {activeTab === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                <div className="space-y-3">
                  {/* Step 1: Select Mulch Material */}
                  <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">
                        Step 1 · Select Flattened Cardboard or Newspaper
                      </span>
                      {progress.mulchStep >= 1 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {MULCH_OPTIONS.map((opt) => {
                        const selected = progress.mulchMaterial === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectMulch(opt.id)}
                            className={`rounded-lg p-3 border text-left transition-colors cursor-pointer ${
                              selected
                                ? 'bg-amber-950/60 border-amber-400 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <div className="text-xs font-bold">{opt.label}</div>
                            <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                              {opt.prepNote}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Sequential Collar & Leaf Blanket Steps */}
                  <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Scissors className="w-4 h-4 text-amber-300" />
                      Step 2 · Cut Collar, Place &amp; Lock Moisture
                    </div>

                    <button
                      type="button"
                      disabled={progress.mulchStep < 1 || progress.mulchStep >= 2}
                      onClick={() => handleMulchAction(2)}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold border transition-colors ${
                        progress.mulchStep >= 2
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                          : progress.mulchStep >= 1
                            ? 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white cursor-pointer'
                            : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-left">(a) Cut Plant Collar with Center Slit</span>
                      {progress.mulchStep >= 2 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={progress.mulchStep < 2 || progress.mulchStep >= 3}
                      onClick={() => handleMulchAction(3)}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold border transition-colors ${
                        progress.mulchStep >= 3
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                          : progress.mulchStep >= 2
                            ? 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white cursor-pointer'
                            : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-left">
                        (b) Place Flat Around Stem Next to Drip Bottle
                      </span>
                      {progress.mulchStep >= 3 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={progress.mulchStep < 3 || progress.mulchStep >= 4}
                      onClick={() => handleMulchAction(4)}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold border transition-colors ${
                        progress.mulchStep >= 4
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                          : progress.mulchStep >= 3
                            ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white cursor-pointer'
                            : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-left">
                        (c) Cover with Dry Leaves to Stay Put &amp; Block Sun
                      </span>
                      {progress.mulchStep >= 4 && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Right: Live Mulch Shield Visual Preview */}
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-300" />
                      Soil Shield &amp; Drip Bottle Teamwork
                    </div>
                    <div className="mt-2.5 rounded-lg bg-slate-950 border border-slate-800 p-2.5">
                      <svg viewBox="0 0 320 175" className="w-full h-auto" aria-label="Plant collar mulch diagram">
                        {/* Soil Bed */}
                        <rect x="20" y="90" width="280" height="72" rx="8" fill="#4a3321" />

                        {/* Buried 2L Drip Bottle on left */}
                        <rect x="64" y="66" width="32" height="58" rx="6" fill="rgba(52,211,153,0.4)" stroke="#34d399" strokeWidth="2" />
                        <rect x="73" y="58" width="14" height="8" rx="2" fill="#f59e0b" />
                        <text x="80" y="142" textAnchor="middle" fill="#7dd3fc" fontSize="9" fontFamily="monospace">
                          2L DRIP
                        </text>

                        {/* Mulch Collar visual */}
                        {progress.mulchStep >= 2 && (
                          <g transform={progress.mulchStep >= 3 ? 'translate(132, 78)' : 'translate(185, 22)'}>
                            <ellipse
                              cx="58"
                              cy="14"
                              rx="54"
                              ry="12"
                              fill={progress.mulchMaterial === 'newspaper' ? '#d6d3d1' : '#c49562'}
                              stroke="#fde68a"
                              strokeWidth="1.5"
                            />
                            {/* Center slit & stem hole */}
                            <line x1="58" y1="14" x2="112" y2="14" stroke="#78350f" strokeWidth="2.5" strokeDasharray="3 2" />
                            <circle cx="58" cy="14" r="6" fill="#1e293b" />
                          </g>
                        )}

                        {/* Dry Leaf Cover over collar */}
                        {progress.mulchStep >= 4 && (
                          <g>
                            {[138, 156, 174, 206, 224, 240].map((lx, i) => (
                              <ellipse
                                key={lx}
                                cx={lx}
                                cy={86 + (i % 2) * 4}
                                rx="12"
                                ry="4.5"
                                transform={`rotate(${(i % 2 === 0 ? -15 : 18)} ${lx} 86)`}
                                fill="#b45309"
                                stroke="#f59e0b"
                                strokeWidth="0.8"
                              />
                            ))}
                          </g>
                        )}

                        {/* Plant Stem rising through collar */}
                        <line x1="190" y1="24" x2="190" y2="94" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" />
                        <ellipse cx="176" cy="36" rx="13" ry="6" transform="rotate(-18 176 36)" fill="#22c55e" />
                        <ellipse cx="204" cy="33" rx="13" ry="6" transform="rotate(18 204 33)" fill="#4ade80" />
                        <text x="190" y="142" textAnchor="middle" fill="#a7f3d0" fontSize="9" fontFamily="monospace">
                          {progress.mulchStep >= 4
                            ? 'SHIELDED & WIND-ANCHORED'
                            : progress.mulchStep >= 3
                              ? 'COLLAR PLACED FLAT'
                              : progress.mulchStep >= 2
                                ? 'CENTER SLIT CUT'
                                : 'BARE SOIL EXPOSED'}
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-950/80 border border-amber-500/30 p-3 text-xs text-slate-200 leading-relaxed">
                    <span className="font-semibold text-amber-300">Shield Tip ({gradeTier}): </span>
                    {gradeTips.station3}
                  </div>
                </div>
              </div>

              {ws3Done && (
                <div className="rounded-xl bg-emerald-950/60 border border-emerald-400/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-white">
                        Door 3 Complete · Prevention Is Better Than Cure!
                      </div>
                      <p className="text-xs text-emerald-200 mt-0.5 leading-snug">
                        You built an underground 2L drip-feeder, a 2:1 balanced composter from Door 1 &amp; Door 2 waste, and a cardboard-and-leaf sun shield.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onSwitchToGarden}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Sprout className="w-4 h-4" />
                    <span>Visit Door 2 Garden</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Encouragement Bar */}
        <div className="px-4 sm:px-5 py-2.5 border-t border-slate-800 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Recycle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Door 1 Kitchen + Door 2 Garden + Door 3 Recycling = Climate-Ready Farming</span>
          </span>
          <span className="font-mono text-emerald-400 tabular-nums">
            {completedCount}/3 Workstations Checked
          </span>
        </div>
      </div>
    </div>
  );
};
