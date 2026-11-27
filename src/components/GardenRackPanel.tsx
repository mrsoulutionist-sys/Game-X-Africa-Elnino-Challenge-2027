import React, { useState } from 'react';
import {
  X,
  Droplets,
  Sprout,
  Hammer,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Recycle,
  Sun,
  AlertTriangle,
} from 'lucide-react';
import {
  EL_NINO_CROPS,
  computeTierLiveMetrics,
  getCropById,
  type CropId,
  type TierSaveState,
  type WeatherMode,
} from '../workshop/crops';
import { getRackMaterialById, type BuiltRackRecord } from '../workshop/rackMaterials';

interface GardenRackPanelProps {
  open: boolean;
  rackSize: number;
  tiers: TierSaveState[];
  builtRacks: BuiltRackRecord[];
  ecoBuilderPoints: number;
  hasReadyPipe: boolean;
  totalHarvestedCount: number;
  jojoLitres: number;
  shadeClothInstalled: boolean;
  windbreakInstalled: boolean;
  stormBraceInstalled: boolean;
  weatherMode: WeatherMode;
  litresSaved: number;
  foodServings: number;
  compostYieldsSinceRefresh: number;
  compostYieldCycleLimit: number;
  compostCycleCount: number;
  maxHarvestHoursCap?: number;
  solarPumpEfficiencyPct?: number;
  solarDustWarning?: boolean;
  nowMs: number;
  onClose: () => void;
  onChangeRackSize: (size: number) => void;
  onOpenRackWorkbench: (rackIndex: number) => void;
  onDeployPipe: (tierIndex: number) => void;
  onPlantSeed: (tierIndex: number, cropId: CropId) => void;
  onWaterTier: (tierIndex: number) => void;
  onHarvestTier: (tierIndex: number) => void;
  onBuildAnotherPipe: () => void;
  onOpenElNinoHub: () => void;
  onSwitchToCompost: () => void;
}

const RACK_OPTIONS = [
  { size: 1, label: '1 Rack' },
  { size: 2, label: '2 Racks' },
  { size: 3, label: '3 Racks' },
  { size: 4, label: '4 Racks' },
  { size: 5, label: '5 Racks' },
  { size: 6, label: '6 Racks' },
];

function getGrowthStageLabel(pct: number, harvestReady: boolean): string {
  if (harvestReady) return 'Mature · Harvest Ready';
  if (pct < 10) return 'Germinating (Capillary Uptake)';
  if (pct < 35) return 'Early Sprout';
  if (pct < 70) return 'Active Leaf Canopy';
  return 'Late Maturation';
}

function formatShortTimestamp(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const GardenRackPanel: React.FC<GardenRackPanelProps> = ({
  open,
  rackSize,
  tiers,
  builtRacks,
  ecoBuilderPoints,
  hasReadyPipe,
  totalHarvestedCount,
  jojoLitres,
  shadeClothInstalled,
  windbreakInstalled,
  stormBraceInstalled,
  weatherMode,
  litresSaved,
  foodServings,
  compostYieldsSinceRefresh,
  compostYieldCycleLimit,
  compostCycleCount,
  maxHarvestHoursCap = 24,
  solarPumpEfficiencyPct = 100,
  solarDustWarning = false,
  nowMs,
  onClose,
  onChangeRackSize,
  onOpenRackWorkbench,
  onDeployPipe,
  onPlantSeed,
  onWaterTier,
  onHarvestTier,
  onBuildAnotherPipe,
  onOpenElNinoHub,
  onSwitchToCompost,
}) => {
  const [plantingTier, setPlantingTier] = useState<number | null>(null);
  const [expandedTier, setExpandedTier] = useState<number | null>(0);

  if (!open) return null;

  const builtMap = new Map<number, BuiltRackRecord>();
  builtRacks.forEach((b) => builtMap.set(b.rackIndex, b));
  const builtCount = Array.from({ length: rackSize }, (_, idx) => builtMap.has(idx)).filter(
    Boolean
  ).length;
  const firstUnbuiltIndex = Array.from({ length: rackSize }, (_, idx) => idx).find(
    (idx) => !builtMap.has(idx)
  );

  const minAllowedSize = Math.max(
    1,
    tiers.reduce((max, t, idx) => (t.pipeInstalled ? Math.max(max, idx + 1) : max), 1)
  );
  const canWaterFromSupply = jojoLitres >= 3;
  const safeLimit = Math.max(1, compostYieldCycleLimit);
  const yieldsRemaining = Math.max(0, safeLimit - compostYieldsSinceRefresh);
  const compostNeedsRefresh = compostYieldsSinceRefresh >= safeLimit;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-950 border border-emerald-500/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>Harvested: {totalHarvestedCount}</span>
              <span>Servings: {foodServings}</span>
              <span className="text-sky-300">Water Saved: {Math.round(litresSaved)} L</span>
              <span className="text-amber-300">Eco-Builder: {ecoBuilderPoints} pts</span>
              <span className={solarDustWarning ? 'text-amber-300 font-bold' : 'text-emerald-300'}>
                Solar Pumps: {solarPumpEfficiencyPct}%
              </span>
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                Live 24/7 Growth Clock
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Vertical Hydroponic Rack
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rack manager"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compost Nutrient Cycle Status Bar (Separate Door 3 Compost Loop) */}
        <div
          className={`px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
            compostNeedsRefresh
              ? 'bg-amber-950/55 border-amber-500/45 text-amber-100'
              : 'bg-slate-900/70 border-slate-800 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {compostNeedsRefresh ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Recycle className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>
              {compostNeedsRefresh
                ? `Compost depleted after ${safeLimit} yields! Bring fresh compost in from Door 3 before planting new seeds.`
                : `Compost Vitality: ${yieldsRemaining} of ${safeLimit} yield${safeLimit === 1 ? '' : 's'} remaining · Cycles applied: ${compostCycleCount}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToCompost();
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                compostNeedsRefresh
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/35'
              }`}
            >
              {compostNeedsRefresh ? 'Redo Compost (Door 3)' : 'Door 3: Compost'}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenElNinoHub();
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/35 text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sun className="w-3 h-3" />
              <span>El Niño Hub</span>
            </button>
          </div>
        </div>

        {/* Rack Size Selector (1 to 6 Racks) + Multi-Rack Assembly Progress */}
        <div className="px-5 py-2.5 bg-slate-900/50 border-b border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-300">Choose Rack Count (1–6):</span>
            <div className="flex flex-wrap gap-1.5">
              {RACK_OPTIONS.map((opt) => {
                const disabled = opt.size < minAllowedSize;
                const active = rackSize === opt.size;
                return (
                  <button
                    key={opt.size}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChangeRackSize(opt.size)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-400 cursor-pointer'
                        : disabled
                          ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white cursor-pointer'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-300 font-mono">
              Racks Built:{' '}
              <strong className={builtCount === rackSize ? 'text-emerald-300' : 'text-amber-300'}>
                {builtCount} of {rackSize} Built
              </strong>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-400">
                {firstUnbuiltIndex !== undefined
                  ? 'Assemble each rack before placing pipes or planting'
                  : 'All selected racks assembled & ready'}
              </span>
            </span>

            {firstUnbuiltIndex !== undefined && (
              <button
                type="button"
                onClick={() => onOpenRackWorkbench(firstUnbuiltIndex)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>Build Rack {firstUnbuiltIndex + 1} of {rackSize} in 3D</span>
              </button>
            )}
          </div>
        </div>

        {/* Tier List with Expandable Real-Time Crop Progress Dropdowns */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {tiers.slice(0, Math.max(1, Math.min(6, rackSize))).map((tier, idx) => {
            const live = computeTierLiveMetrics(
              tier,
              nowMs,
              weatherMode,
              shadeClothInstalled,
              windbreakInstalled,
              stormBraceInstalled,
              maxHarvestHoursCap,
              solarPumpEfficiencyPct
            );
            const crop = getCropById(tier.cropId);
            const builtInfo = builtMap.get(idx);
            const matDef = builtInfo ? getRackMaterialById(builtInfo.materialId) : null;
            const isPickingSeed = plantingTier === idx && !compostNeedsRefresh;
            const isExpanded = expandedTier === idx;

            return (
              <div
                key={idx}
                className={`rounded-xl border p-3.5 ${
                  builtInfo
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-900/55 border-amber-500/35'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-300 tabular-nums shrink-0">
                      RACK {idx + 1}
                    </span>
                    {builtInfo && matDef ? (
                      <>
                        <span className="text-sm font-semibold text-white truncate tabular-nums">
                          {live.statusText}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 truncate">
                          · {matDef.shortName} · by {builtInfo.builderName}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-amber-200 truncate">
                        Needs 3D 5-Step Frame &amp; Drill Build
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!builtInfo ? (
                      <button
                        type="button"
                        onClick={() => onOpenRackWorkbench(idx)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Hammer className="w-3.5 h-3.5" />
                        <span>Build Rack {idx + 1} in 3D</span>
                      </button>
                    ) : !tier.pipeInstalled ? (
                      hasReadyPipe ? (
                        <button
                          type="button"
                          onClick={() => onDeployPipe(idx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Place PVC Pipe Here</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onBuildAnotherPipe}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Hammer className="w-3.5 h-3.5" />
                          <span>Build Pipe in Kitchen</span>
                        </button>
                      )
                    ) : !tier.cropId ? (
                      compostNeedsRefresh ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSwitchToCompost();
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Recycle className="w-3.5 h-3.5" />
                          <span>Bring Compost First</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPlantingTier(isPickingSeed ? null : idx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Sprout className="w-3.5 h-3.5" />
                          <span>{isPickingSeed ? 'Close Seeds' : 'Choose Seed (10)'}</span>
                        </button>
                      )
                    ) : (
                      <>
                        {live.waterPct < 90 && (
                          <button
                            type="button"
                            disabled={!canWaterFromSupply}
                            onClick={() => onWaterTier(idx)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              canWaterFromSupply
                                ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <Droplets className="w-3.5 h-3.5" />
                            <span>
                              {!canWaterFromSupply
                                ? 'Refill JoJo (3 L)'
                                : tier.wateredAtMs === null
                                  ? 'Water (-3 L)'
                                  : 'Refill (-3 L)'}
                            </span>
                          </button>
                        )}
                        {live.harvestReady && (
                          <button
                            type="button"
                            onClick={() => onHarvestTier(idx)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Harvest Crop</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedTier(isExpanded ? null : idx)}
                          aria-expanded={isExpanded}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                        >
                          <span>Details</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Live Growth & Reservoir Bars */}
                {tier.pipeInstalled && tier.cropId && (
                  <div className="mt-2.5 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Growth</span>
                        <span className="tabular-nums text-emerald-300 font-mono">
                          {live.growthPctExact.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(2, live.growthPctExact)}%` }}
                          className="h-full bg-emerald-500 transition-all duration-500"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Water Reserve</span>
                        <span className="tabular-nums text-sky-300 font-mono">
                          {live.waterPct}% ({live.waterCountdownLabel})
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${live.waterPctExact}%` }}
                          className="h-full bg-sky-500 transition-all duration-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Expandable Real-Time Crop Progress Dropdown */}
                {tier.pipeInstalled && crop && isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800/90 rounded-lg bg-slate-950/70 p-3 text-xs space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">Stage</div>
                        <div className="text-slate-100 font-semibold mt-0.5">
                          {getGrowthStageLabel(live.growthPctExact, live.harvestReady)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">Time Remaining</div>
                        <div className="text-emerald-300 font-mono font-semibold tabular-nums mt-0.5">
                          {live.countdownLabel}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">Harvest Ready At</div>
                        <div className="text-slate-200 font-medium mt-0.5">
                          {formatShortTimestamp(live.harvestAtMs)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">Water Lasts</div>
                        <div className="text-sky-300 font-mono font-semibold tabular-nums mt-0.5">
                          {live.waterCountdownLabel}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/70 text-[11px] text-slate-400">
                      <span>
                        Planted: <strong className="text-slate-200">{formatShortTimestamp(tier.plantedAtMs)}</strong>
                        {' · '}
                        Yield: <strong className="text-amber-300">+{crop.servingsPerHarvest} servings</strong>
                      </span>
                      <span className="text-emerald-400/90">
                        {crop.heatResilient ? 'El Niño Heat-Hardy' : 'Shade Cloth Recommended'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 10 El Niño Seed Picker */}
                {isPickingSeed && (
                  <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {EL_NINO_CROPS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onPlantSeed(idx, c.id);
                          setPlantingTier(null);
                          setExpandedTier(idx);
                        }}
                        className="text-left rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 p-2.5 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">{c.name}</span>
                          <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                            {c.maturityHours}h · +{c.servingsPerHarvest} srv
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                          {c.heatResilient ? 'Heat-Hardy · ' : ''}
                          {c.droughtTrait}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
