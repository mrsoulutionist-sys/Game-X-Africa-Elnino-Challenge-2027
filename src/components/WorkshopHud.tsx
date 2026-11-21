import React from 'react';
import {
  Eye,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Droplets,
  Trees,
  Hammer,
  LogOut,
  Sprout,
  ChevronDown,
  ChevronUp,
  Clock,
  Recycle,
  CheckCircle2,
} from 'lucide-react';
import type { ActiveZone } from '../firebase/firebaseClient';
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
  tiers: TierSaveState[];
  door3: Door3ProgressState;
  nowMs: number;
  rackDropdownOpen: boolean;
  compostDropdownOpen: boolean;
  onToggleRackDropdown: () => void;
  onToggleCompostDropdown: () => void;
  onSelectGrade: (tier: GradeTier) => void;
  onReplayVoiceover: () => void;
  onToggleMute: () => void;
  onToggleCutaway: () => void;
  onReset: () => void;
  onOpenWickExplainer: () => void;
  onOpenRackManager: () => void;
  onOpenCompostStation: (workstation?: 1 | 2 | 3) => void;
  onSwitchZone: (zone: ActiveZone) => void;
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
  tiers,
  door3,
  nowMs,
  rackDropdownOpen,
  compostDropdownOpen,
  onToggleRackDropdown,
  onToggleCompostDropdown,
  onSelectGrade,
  onReplayVoiceover,
  onToggleMute,
  onToggleCutaway,
  onReset,
  onOpenWickExplainer,
  onOpenRackManager,
  onOpenCompostStation,
  onSwitchZone,
  onLogout,
}) => {
  const step = BUILD_STEPS[hudState.stepId];
  const isKitchen = hudState.activeZone === 'kitchen';
  const isGarden = hudState.activeZone === 'garden';
  const isCompost = hudState.activeZone === 'compost';
  const isComplete = hudState.stepId === 'COMPLETE';
  const door3DoneCount = countDoor3CompletedWorkstations(door3);
  const ringCircumference = 2 * Math.PI * 16;
  const ringOffset = ringCircumference * (1 - hudState.subProgress);

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

      {/* Top-Left Compact Zone, Quick 3-Door Switcher & Collapsible Dropdowns */}
      <div className="fixed top-4 left-4 z-20 flex flex-col items-start gap-2 pointer-events-auto max-w-[70vw]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReplayVoiceover}
            title="Summon Prof. E Voice Guide"
            className="flex items-center gap-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-slate-700/80 px-3 py-2 shadow-lg transition-colors cursor-pointer"
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
                  {WEATHER_FORECASTS[weatherMode].label}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs font-mono font-semibold text-amber-300">
                  DOOR 3 · COMPOST
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white tabular-nums">
                  {door3DoneCount}/3 Done
                </span>
              </>
            )}
          </button>

          {/* Door 1: Kitchen */}
          {!isKitchen && (
            <button
              type="button"
              onClick={() => onSwitchZone('kitchen')}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border bg-slate-950/90 hover:bg-slate-900 text-slate-200 border-slate-700/80 shadow-lg transition-colors cursor-pointer"
            >
              <Hammer className="w-3.5 h-3.5 text-amber-300" />
              <span>Door 1: Kitchen</span>
            </button>
          )}

          {/* Door 2: Garden Yard */}
          {!isGarden && (
            <button
              type="button"
              onClick={() => onSwitchZone('garden')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border shadow-lg transition-colors cursor-pointer ${
                isKitchen && isComplete
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                  : 'bg-slate-950/90 hover:bg-slate-900 text-slate-200 border-slate-700/80'
              }`}
            >
              <Trees className="w-3.5 h-3.5 text-emerald-300" />
              <span>Door 2: Garden</span>
              {readyPipeCount > 0 && isKitchen && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-200 font-mono text-[10px]">
                  Pipe Ready
                </span>
              )}
            </button>
          )}

          {/* Door 3: Recycling & Composting Station */}
          {!isCompost && (
            <button
              type="button"
              onClick={() => onSwitchZone('compost')}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border bg-slate-950/90 hover:bg-slate-900 text-slate-200 border-amber-500/45 shadow-lg transition-colors cursor-pointer"
            >
              <Recycle className="w-3.5 h-3.5 text-amber-300" />
              <span>Door 3: Compost</span>
              <span className="ml-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 font-mono text-[10px] tabular-nums">
                {door3DoneCount}/3
              </span>
            </button>
          )}

          {isGarden && (
            <>
              <button
                type="button"
                onClick={onOpenRackManager}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 px-3 py-2 text-xs font-semibold shadow-lg transition-colors cursor-pointer"
              >
                <Sprout className="w-3.5 h-3.5" />
                <span>Rack &amp; Defense</span>
                <span className="ml-0.5 px-1.5 py-0.5 rounded bg-slate-950/50 text-sky-200 font-mono text-[10px] tabular-nums">
                  {Math.round(jojoLitres)}L
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleRackDropdown}
                aria-expanded={rackDropdownOpen}
                className="flex items-center gap-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-slate-100 border border-slate-700/80 px-3 py-2 text-xs font-semibold shadow-lg transition-colors cursor-pointer"
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
                const live = computeTierLiveMetrics(t, nowMs, weatherMode, shadeClothInstalled);
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
            onClick={onOpenWickExplainer}
            title="How Wicks & Self-Watering Work"
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-950/90 text-sky-300 border border-sky-500/40 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <Droplets className="w-3.5 h-3.5" />
            <span className="hidden md:inline">How Wicks Work</span>
          </button>

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
      </div>
    </>
  );
};
