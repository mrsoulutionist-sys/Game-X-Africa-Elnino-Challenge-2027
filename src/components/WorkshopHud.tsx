import React from 'react';
import {
  Eye,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Droplets,
  LogOut,
  Sprout,
  ChevronDown,
  ChevronUp,
  Clock,
  Recycle,
  CheckCircle2,
  Sun,
  Lock,
  Timer,
  FileText,
  Megaphone,
  Trophy,
  X,
  Footprints,
  Hammer,
} from 'lucide-react';
import type { ActiveZone } from '../firebase/firebaseClient';
import {
  BANNER_STAGE_OPTIONS,
  formatStopwatchMs,
  type ChallengeBannerItem,
} from '../firebase/adminService';
import {
  countDoor3CompletedWorkstations,
  type Door3ProgressState,
} from '../workshop/compostData';
import type { WorkshopHudState } from '../workshop/KitchenWorkshopScene';
import {
  WEATHER_FORECASTS,
  computeTierLiveMetrics,
  getCropById,
  type TierSaveState,
  type WeatherMode,
} from '../workshop/crops';
import type { SolarProgressState } from '../workshop/solarData';
import { BUILD_STEPS, type GradeTier } from '../workshop/steps';

interface WorkshopHudProps {
  hudState: WorkshopHudState;
  gradeTier: GradeTier;
  muted: boolean;
  farmerName: string | null;
  readyPipeCount: number;
  jojoLitres: number;
  weatherMode: WeatherMode;
  shadeClothInstalled: boolean;
  windbreakInstalled: boolean;
  stormBraceInstalled: boolean;
  tiers: TierSaveState[];
  rackSize: number;
  builtRacksCount: number;
  ecoBuilderPoints: number;
  door3: Door3ProgressState;
  compostYieldsSinceRefresh: number;
  compostYieldCycleLimit: number;
  solar: SolarProgressState;
  solarPumpEfficiencyPct: number;
  maxHarvestHoursCap: number;
  competitionTimerEnabled: boolean;
  competitionElapsedMs: number;
  bestCompetitionMs: number | null;
  activeBanner: ChallengeBannerItem | null;
  onDismissBanner: () => void;
  adminDocCount: number;
  nowMs: number;
  rackDropdownOpen: boolean;
  compostDropdownOpen: boolean;
  onToggleRackDropdown: () => void;
  onToggleCompostDropdown: () => void;
  onSelectGrade: (tier: GradeTier) => void;
  onSwitchZone: (zone: ActiveZone) => void;
  onReplayVoiceover: () => void;
  onToggleMute: () => void;
  onToggleCutaway: () => void;
  onReset: () => void;
  onOpenWickExplainer: () => void;
  onOpenRackManager: () => void;
  onOpenRackWorkbench: () => void;
  onOpenElNinoHub: () => void;
  onOpenCompostStation: (workstation?: 1 | 2 | 3) => void;
  onOpenAdminDocs: () => void;
  leaderboardOpen: boolean;
  onToggleLeaderboard: () => void;
  onLogout: () => void;
}

const GRADE_TIERS: Array<{ id: GradeTier; label: string }> = [
  { id: '4-6', label: 'G4–6' },
  { id: '7-9', label: 'G7–9' },
  { id: '10-12', label: 'G10–12' },
];

export const WorkshopHud: React.FC<WorkshopHudProps> = ({
  hudState,
  gradeTier,
  muted,
  farmerName,
  readyPipeCount,
  jojoLitres,
  weatherMode,
  shadeClothInstalled,
  windbreakInstalled,
  stormBraceInstalled,
  tiers,
  rackSize,
  builtRacksCount,
  ecoBuilderPoints,
  door3,
  compostYieldsSinceRefresh,
  compostYieldCycleLimit,
  solar,
  solarPumpEfficiencyPct,
  maxHarvestHoursCap,
  competitionTimerEnabled,
  competitionElapsedMs,
  bestCompetitionMs,
  activeBanner,
  onDismissBanner,
  adminDocCount,
  nowMs,
  rackDropdownOpen,
  compostDropdownOpen,
  onToggleRackDropdown,
  onToggleCompostDropdown,
  onSelectGrade,
  onSwitchZone,
  onReplayVoiceover,
  onToggleMute,
  onToggleCutaway,
  onReset,
  onOpenWickExplainer,
  onOpenRackManager,
  onOpenRackWorkbench,
  onOpenElNinoHub,
  onOpenCompostStation,
  onOpenAdminDocs,
  leaderboardOpen,
  onToggleLeaderboard,
  onLogout,
}) => {
  const step = BUILD_STEPS[hudState.stepId];
  const isKitchen = hudState.activeZone === 'kitchen';
  const isGarden = hudState.activeZone === 'garden';
  const isCompost = hudState.activeZone === 'compost';
  const isSolar = hudState.activeZone === 'solar';
  const isComplete = hudState.stepId === 'COMPLETE';
  const solarDustAlert = solar.dustLevel > 0;
  const door3DoneCount = countDoor3CompletedWorkstations(door3);
  const safeLimit = Math.max(1, compostYieldCycleLimit);
  const yieldsRemaining = Math.max(0, safeLimit - compostYieldsSinceRefresh);
  const compostNeedsRefresh = compostYieldsSinceRefresh >= safeLimit;
  const ringCircumference = 2 * Math.PI * 16;
  const ringOffset = ringCircumference * (1 - hudState.subProgress);
  const activeBannerStageLabel = activeBanner
    ? BANNER_STAGE_OPTIONS.find((s) => s.id === activeBanner.stage)?.label ?? 'Game Alert'
    : '';

  return (
    <>
      {/* Center Aiming Reticle */}
      <div className="fixed inset-0 pointer-events-none z-20 flex items-center justify-center">
        {hudState.manualAimMode && hudState.inRange ? (
          <div className="relative flex flex-col items-center justify-center">
            <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
              <circle
                cx="22"
                cy="22"
                r="16"
                fill="none"
                stroke={hudState.reticleAligned ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.48)'}
                strokeWidth="2.5"
              />
              {hudState.subProgress > 0 && (
                <circle
                  cx="22"
                  cy="22"
                  r="16"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              )}
            </svg>
            <div
              className={`absolute w-2 h-2 rounded-full ${
                hudState.reticleAligned ? 'bg-emerald-400' : 'bg-amber-300'
              }`}
            />
          </div>
        ) : (
          <div
            className={`w-1.5 h-1.5 rounded-full transition-transform ${
              hudState.inRange && (!isKitchen || !isComplete)
                ? 'bg-emerald-400 scale-150'
                : 'bg-white/60'
            }`}
          />
        )}
      </div>

      {/* Intermittent Admin Banner (1-min blurb every 2 min, Scroll or Flash) */}
      {activeBanner && (
        activeBanner.style === 'scroll' ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-[7.25rem] inset-x-0 z-30 pointer-events-none"
          >
            <div className="relative w-full overflow-hidden bg-slate-950/95 border-y-2 border-amber-400/85 py-2 pr-11 shadow-2xl">
              <div className="animate-banner-marquee items-center gap-4 text-xs sm:text-sm font-bold text-amber-100">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[10px] uppercase tracking-wider shrink-0">
                  <Megaphone className="w-3 h-3" />
                  <span>{activeBannerStageLabel}</span>
                </span>
                <span>{activeBanner.text}</span>
                <span className="text-emerald-400 font-mono text-xs px-4" aria-hidden="true">
                  ★ GAME X AFRICA · EL NIÑO CHALLENGE ★
                </span>
              </div>
              <button
                type="button"
                onClick={onDismissBanner}
                aria-label="Dismiss announcement banner"
                className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-[7.25rem] left-1/2 -translate-x-1/2 z-30 w-[min(92vw,34rem)] pointer-events-none"
          >
            <div className="animate-banner-flash rounded-2xl bg-slate-950/95 border-2 border-amber-400 px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 truncate">
                    {activeBannerStageLabel}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-amber-100 leading-snug">
                    {activeBanner.text}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissBanner}
                aria-label="Dismiss announcement banner"
                className="pointer-events-auto p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      )}

      {/* Top-Left Compact Zone, Non-Clickable Round-Loop Wayfinder & Collapsible Dropdowns */}
      <div className="fixed top-4 left-4 z-20 flex flex-col items-start gap-1.5 pointer-events-auto max-w-[64vw] sm:max-w-[66vw]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onReplayVoiceover}
            title="Summon Prof. E Voice Guide"
            className="flex items-center gap-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 shadow-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {isKitchen ? (
              <>
                <span className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">
                  {isComplete ? '8/8' : `${step.stepNumber}/${step.totalSteps}`}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white">
                  {step.title}
                </span>
                {hudState.manualAimMode && (
                  <span className="text-xs font-mono font-semibold text-amber-300 tabular-nums">
                    {hudState.completedSubSteps}/{hudState.totalSubSteps}
                  </span>
                )}
              </>
              ) : isGarden ? (
              <>
                <span className="text-xs font-mono font-semibold text-emerald-400">
                  DOOR 2 · GARDEN
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white">
                  {hudState.rackBuildSession && hudState.rackBuildSession.activeRackIndex !== null
                    ? `Rack ${hudState.rackBuildSession.activeRackIndex + 1}/${rackSize} · Step ${hudState.rackBuildSession.step}/5`
                    : WEATHER_FORECASTS[weatherMode].label}
                </span>
                {hudState.manualAimMode && (
                  <span className="text-xs font-mono font-semibold text-amber-300 tabular-nums">
                    {hudState.completedSubSteps}/{hudState.totalSubSteps}
                  </span>
                )}
              </>
            ) : isCompost ? (
              <>
                <span className="text-xs font-mono font-semibold text-amber-300">
                  DOOR 3 · COMPOST
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white tabular-nums">
                  {door3DoneCount}/3 Done
                </span>
              </>
            ) : (
              <>
                <span className="text-xs font-mono font-semibold text-yellow-300">
                  DOOR 4 · SOLAR LAB
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white tabular-nums">
                  {solar.step >= 5 ? 'Operational Hub' : `Step ${solar.step}/4`}
                </span>
              </>
            )}
          </button>

          {/* Compact Room 1–4 Switcher Pills */}
          <div
            role="group"
            aria-label="Workshop Rooms"
            className="flex items-center gap-1 rounded-xl bg-slate-950/90 border border-slate-700/80 p-1 shadow-lg"
          >
            {(
              [
                { id: 'kitchen' as const, label: '1 Kitchen' },
                { id: 'garden' as const, label: '2 Garden' },
                { id: 'compost' as const, label: '3 Compost' },
                { id: 'solar' as const, label: '4 Solar Lab' },
              ] as const
            ).map((room) => {
              const active = hudState.activeZone === room.id;
              const isSolarAlertPill = room.id === 'solar' && solarDustAlert;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onSwitchZone(room.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSolarAlertPill
                      ? 'animate-solar-warning bg-amber-500 text-slate-950 border border-amber-200 font-bold'
                      : active
                        ? room.id === 'solar'
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {room.label}
                </button>
              );
            })}
          </div>

          {/* Non-clickable Round-Loop Walk-Through Door Indicator */}
          {!isSolar && (
            <div
              title="Walk toward the glowing doors inside the 3D workshop to step straight into the next zone"
              className="hidden xl:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border bg-slate-950/90 text-slate-200 border-slate-700/80 shadow-lg select-none"
            >
              <Footprints className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-300">
                {isKitchen
                  ? 'South Doors → Garden (2) · Compost (3)'
                  : isGarden
                    ? 'Doors → Kitchen (1) · Compost (3) · East Solar (4)'
                    : 'Doors → Garden (2) · Kitchen (1) · East Solar (4)'}
              </span>
              {isKitchen && isComplete && readyPipeCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-200 font-mono text-[10px]">
                  Pipe Ready · Walk Door 2
                </span>
              )}
            </div>
          )}

          {solarDustAlert && !isSolar && (
            <button
              type="button"
              onClick={() => onSwitchZone('solar')}
              className="animate-solar-warning flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold border bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-200 shadow-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sun className="w-3.5 h-3.5 shrink-0" />
              <span>Solar efficiency dropping—check your power system!</span>
            </button>
          )}

          {compostNeedsRefresh && !isCompost && (
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold border bg-amber-500/95 text-slate-950 border-amber-300 shadow-lg select-none">
              <Recycle className="w-3.5 h-3.5 shrink-0" />
              <span>Door 3: Compost Needs Batch (Walk South)</span>
            </div>
          )}

          {isGarden && (
            <>
              <button
                type="button"
                onClick={onOpenRackManager}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 px-3 py-2 text-xs font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sprout className="w-3.5 h-3.5" />
                <span>Vertical Rack</span>
                <span className="ml-0.5 px-1.5 py-0.5 rounded bg-slate-950/40 text-emerald-100 font-mono text-[10px] tabular-nums">
                  {builtRacksCount}/{rackSize} · {yieldsRemaining}/{safeLimit}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenRackWorkbench}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  builtRacksCount < rackSize
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 font-bold'
                    : 'bg-slate-950/90 hover:bg-slate-900 text-emerald-300 border-emerald-500/40'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>
                  {builtRacksCount < rackSize
                    ? `3D Build Racks (${builtRacksCount}/${rackSize})`
                    : `Eco-Builder · ${ecoBuilderPoints} pts`}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenElNinoHub}
                className="flex items-center gap-1.5 rounded-xl bg-sky-700/90 hover:bg-sky-600 text-white border border-sky-400/70 px-3 py-2 text-xs font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sun className="w-3.5 h-3.5 text-amber-300" />
                <span>Weather &amp; Defense</span>
                <span className="ml-0.5 px-1.5 py-0.5 rounded bg-slate-950/50 text-sky-200 font-mono text-[10px] tabular-nums">
                  {WEATHER_FORECASTS[weatherMode].tempLabel.split('·')[0].trim()} · {Math.round(jojoLitres)}L
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleRackDropdown}
                aria-expanded={rackDropdownOpen}
                className="flex items-center gap-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-slate-100 border border-slate-700/80 px-3 py-2 text-xs font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Crop Progress</span>
                {rackDropdownOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            </>
          )}

          {isCompost && (
            <>
              <button
                type="button"
                onClick={() => onOpenCompostStation()}
                className="flex items-center gap-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-emerald-300 border border-emerald-500/45 px-3 py-2 text-xs font-semibold shadow-lg transition-colors cursor-pointer"
              >
                <Recycle className="w-3.5 h-3.5" />
                <span>Guide &amp; Sort Check</span>
              </button>

              <button
                type="button"
                onClick={onToggleCompostDropdown}
                aria-expanded={compostDropdownOpen}
                className="flex items-center gap-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-slate-100 border border-slate-700/80 px-3 py-2 text-xs font-semibold shadow-lg transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Station Checklist</span>
                {compostDropdownOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            </>
          )}
        </div>

        {/* Collapsible Live Crop Progress Dropdown Overlay (Door 2) */}
        {isGarden && rackDropdownOpen && (
          <div className="w-72 sm:w-80 rounded-xl bg-slate-950/95 border border-emerald-500/40 p-3 shadow-2xl space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-emerald-400">
              <span>Live Wall-Clock Rack Status</span>
              <span className="text-slate-400">24/7 Real Time</span>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {tiers.map((t, idx) => {
                const live = computeTierLiveMetrics(
                  t,
                  nowMs,
                  weatherMode,
                  shadeClothInstalled,
                  windbreakInstalled,
                  stormBraceInstalled,
                  maxHarvestHoursCap,
                  solarPumpEfficiencyPct
                );
                const crop = getCropById(t.cropId);
                return (
                  <div
                    key={idx}
                    className="rounded-lg bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-emerald-300">
                        T{idx + 1} · {crop ? crop.shortLabel : t.pipeInstalled ? 'Pipe Ready' : 'Empty'}
                      </span>
                      <span className="font-mono text-[11px] text-slate-200 tabular-nums">
                        {crop ? live.countdownLabel : '—'}
                      </span>
                    </div>
                    {crop && (
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 font-mono tabular-nums">
                        <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${Math.max(2, live.growthPctExact)}%` }}
                            className="h-full bg-emerald-500"
                          />
                        </div>
                        <span>{live.growthPctExact.toFixed(1)}%</span>
                        <span className="text-sky-300">H₂O {live.waterPct}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsible Door 3 Workstation Checklist Dropdown */}
        {isCompost && compostDropdownOpen && (
          <div className="w-72 sm:w-80 rounded-xl bg-slate-950/95 border border-amber-500/40 p-3 shadow-2xl space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-amber-300">
              <span>Door 3 Eco-Shield Checklist</span>
              <span className="text-emerald-400 tabular-nums">{door3DoneCount}/3 Done</span>
            </div>
            <div className="space-y-1.5">
              {[
                {
                  tab: 1 as const,
                  title: '1 · 2L Bottle Drip-Feeder',
                  done: door3.dripStep >= 4,
                  unlocked: true,
                  status: door3.dripStep >= 4 ? 'Active Root Drip' : `Step ${door3.dripStep}/4`,
                },
                {
                  tab: 2 as const,
                  title: '2 · Bucket / Crate / Pallet Composter',
                  done: door3.compostStep >= 6,
                  unlocked: true,
                  status:
                    door3.compostStep >= 6
                      ? '2:1 Layered & Misted'
                      : `Step ${door3.compostStep}/6`,
                },
                {
                  tab: 3 as const,
                  title: '3 · Cardboard Mulch Shield',
                  done: door3.mulchStep >= 4,
                  unlocked: true,
                  status:
                    door3.mulchStep >= 4
                      ? 'Leaf-Anchored Collar'
                      : `Step ${door3.mulchStep}/4`,
                },
              ].map((ws) => (
                <button
                  key={ws.tab}
                  type="button"
                  disabled={!ws.unlocked}
                  onClick={() => onOpenCompostStation(ws.tab)}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 border text-left text-xs transition-colors ${
                    ws.unlocked
                      ? 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/50 text-slate-100 cursor-pointer'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{ws.title}</div>
                    <div className="text-[10px] font-mono text-slate-400">{ws.status}</div>
                  </div>
                  {ws.done && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top-Right Compact Utility Controls */}
      <div className="fixed top-4 right-4 z-20 flex flex-col items-end gap-1.5 pointer-events-auto">
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <div
            role="group"
            aria-label="Grade Tier"
            className="hidden sm:flex items-center rounded-lg bg-slate-950/90 border border-slate-700/80 p-0.5 text-[11px] font-mono"
          >
            {GRADE_TIERS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectGrade(g.id)}
                className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  gradeTier === g.id
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleLeaderboard}
            aria-expanded={leaderboardOpen}
            title="View Full-Screen Harvest & Grade Sales Leaderboard"
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              leaderboardOpen
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-slate-950/90 text-amber-300 border-amber-400/50 hover:bg-slate-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Leaderboard</span>
          </button>

          <button
            type="button"
            onClick={onOpenWickExplainer}
            title="How Wicks & Self-Watering Work"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-950/90 text-sky-300 border border-sky-500/40 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <Droplets className="w-3.5 h-3.5" />
            <span className="hidden md:inline">How Wicks Work</span>
          </button>

          {adminDocCount > 0 && (
            <button
              type="button"
              onClick={onOpenAdminDocs}
              title="View Guides & Admin Documents"
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-950/90 text-amber-300 border border-amber-500/40 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Guides ({adminDocCount})</span>
            </button>
          )}

          {hudState.cutawayAvailable && (
            <button
              type="button"
              onClick={onToggleCutaway}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                hudState.cutawayMode
                  ? 'bg-sky-600 text-white border-sky-400'
                  : 'bg-slate-950/90 text-slate-200 border-slate-700/80 hover:bg-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{hudState.cutawayMode ? 'Cutaway On' : 'Cutaway'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio and voiceover' : 'Mute audio and voiceover'}
            className="p-2 rounded-lg bg-slate-950/90 text-slate-200 border border-slate-700/80 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {isKitchen && (
            <button
              type="button"
              onClick={onReset}
              aria-label="Reset current PVC pipe"
              title="Reset Current Pipe"
              className="p-2 rounded-lg bg-slate-950/90 text-slate-200 border border-slate-700/80 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {farmerName && (
            <button
              type="button"
              onClick={onLogout}
              title={`Switch Farmer (${farmerName})`}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-950/90 text-slate-200 border border-slate-700/80 hover:bg-slate-900 text-xs font-medium transition-colors cursor-pointer"
            >
              <span className="max-w-[76px] truncate">{farmerName}</span>
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        <div
          role="group"
          aria-label="Grade Tier Mobile"
          className="flex sm:hidden items-center rounded-lg bg-slate-950/90 border border-slate-700/80 p-0.5 text-[10px] font-mono"
        >
          {GRADE_TIERS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGrade(g.id)}
              className={`px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                gradeTier === g.id
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Competition Speed Timer Pill + Grayed-Out Admin-Only Toggle */}
        <div
          title="Competition Speed Timer toggle is grayed out and restricted to Admin"
          className="flex items-center gap-2 rounded-xl bg-slate-950/90 border border-slate-800 px-2.5 py-1.5 shadow-lg"
        >
          <Timer
            className={`w-3.5 h-3.5 shrink-0 ${
              competitionTimerEnabled ? 'text-amber-300' : 'text-slate-500'
            }`}
          />
          <div className="flex flex-col leading-tight">
            <span
              className={`text-[11px] font-mono font-bold tabular-nums ${
                competitionTimerEnabled ? 'text-amber-200' : 'text-slate-400'
              }`}
            >
              {competitionTimerEnabled
                ? `RACE ${formatStopwatchMs(competitionElapsedMs)}`
                : 'Timer Off'}
            </span>
            {competitionTimerEnabled && bestCompetitionMs !== null ? (
              <span className="text-[9px] font-mono text-emerald-400 tabular-nums">
                Best {formatStopwatchMs(bestCompetitionMs)}
              </span>
            ) : (
              <span className="text-[9px] font-mono text-slate-500 flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" />
                <span>Admin Only</span>
              </span>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={competitionTimerEnabled}
            aria-label="Competition timer toggle (Admin only)"
            disabled
            className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-slate-700 bg-slate-800/80 opacity-45 cursor-not-allowed grayscale"
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-400 transition-transform ${
                competitionTimerEnabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </>
  );
};
