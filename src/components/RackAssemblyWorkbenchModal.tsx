import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Drill,
  Hammer,
  Layers,
  Recycle,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { workshopAudio } from '../workshop/audio';
import {
  RACK_MATERIAL_CATALOG,
  getRackMaterialById,
  type BuiltRackRecord,
  type RackMaterialCategory,
  type RackMaterialId,
} from '../workshop/rackMaterials';

interface RackAssemblyWorkbenchModalProps {
  open: boolean;
  targetRackIndex: number;
  rackSize: number;
  builtRacks: BuiltRackRecord[];
  farmerName: string;
  ecoBuilderPoints: number;
  onSelectTargetRack: (rackIndex: number) => void;
  onCompleteRackAssembly: (record: BuiltRackRecord) => void;
  onClose: () => void;
  onProceedToPlanting: () => void;
}

type WorkbenchStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Array<{ step: WorkbenchStep; title: string; short: string }> = [
  { step: 1, title: 'Material Choice', short: '1 · Material' },
  { step: 2, title: '2 Side Uprights', short: '2 · Uprights' },
  { step: 3, title: '3 Cross Slats', short: '3 · Slats' },
  { step: 4, title: 'Drain & Liner', short: '4 · Drain/Liner' },
  { step: 5, title: 'Place in Grid', short: '5 · Place' },
];

export const RackAssemblyWorkbenchModal: React.FC<RackAssemblyWorkbenchModalProps> = ({
  open,
  targetRackIndex,
  rackSize,
  builtRacks,
  farmerName,
  ecoBuilderPoints,
  onSelectTargetRack,
  onCompleteRackAssembly,
  onClose,
  onProceedToPlanting,
}) => {
  const [step, setStep] = useState<WorkbenchStep>(1);
  const [categoryFilter, setCategoryFilter] = useState<RackMaterialCategory>('recyclable');
  const [selectedMaterialId, setSelectedMaterialId] = useState<RackMaterialId>('reclaimed_pvc');
  const [leftUprightPlaced, setLeftUprightPlaced] = useState(false);
  const [rightUprightPlaced, setRightUprightPlaced] = useState(false);
  const [slatsPlaced, setSlatsPlaced] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [drainDrilled, setDrainDrilled] = useState(false);
  const [linerFitted, setLinerFitted] = useState(false);
  const [quickBuildEnabled, setQuickBuildEnabled] = useState(false);
  const [builderName, setBuilderName] = useState(farmerName || 'Farmer');
  const [justPlacedRackIndex, setJustPlacedRackIndex] = useState<number | null>(null);

  const builtByIndex = useMemo(() => {
    const map = new Map<number, BuiltRackRecord>();
    builtRacks.forEach((r) => map.set(r.rackIndex, r));
    return map;
  }, [builtRacks]);

  const clampedRackIndex = Math.max(0, Math.min(Math.max(0, rackSize - 1), targetRackIndex));
  const selectedMat = getRackMaterialById(selectedMaterialId);
  const existingForTarget = builtByIndex.get(clampedRackIndex);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setLeftUprightPlaced(false);
    setRightUprightPlaced(false);
    setSlatsPlaced([false, false, false]);
    setDrainDrilled(false);
    setLinerFitted(false);
    setJustPlacedRackIndex(null);
    if (existingForTarget) {
      setSelectedMaterialId(existingForTarget.materialId);
      setCategoryFilter(existingForTarget.isRecyclable ? 'recyclable' : 'standard');
      setBuilderName(existingForTarget.builderName);
    } else {
      setBuilderName((prev) => prev || farmerName || 'Farmer');
    }
  }, [open, clampedRackIndex, existingForTarget, farmerName]);

  if (!open) return null;

  const builtCount = Array.from({ length: rackSize }, (_, idx) => builtByIndex.has(idx)).filter(
    Boolean
  ).length;
  const nextUnbuiltIndex = Array.from({ length: rackSize }, (_, idx) => idx).find(
    (idx) => !builtByIndex.has(idx)
  );

  const uprightsDoneCount = (leftUprightPlaced ? 1 : 0) + (rightUprightPlaced ? 1 : 0);
  const slatsDoneCount = slatsPlaced.filter(Boolean).length;
  const step2Ready = leftUprightPlaced && rightUprightPlaced;
  const step3Ready = slatsPlaced.every(Boolean);
  const step4Ready = drainDrilled && linerFitted;

  const filteredMaterials = RACK_MATERIAL_CATALOG.filter((m) => m.category === categoryFilter);

  const handleSelectMaterial = (id: RackMaterialId) => {
    workshopAudio.playPickup();
    setSelectedMaterialId(id);
  };

  const handlePlaceUpright = (side: 'left' | 'right') => {
    workshopAudio.playSnapComplete();
    if (side === 'left') setLeftUprightPlaced(true);
    if (side === 'right') setRightUprightPlaced(true);
  };

  const handlePlaceSlat = (idx: 0 | 1 | 2) => {
    workshopAudio.playSnapComplete();
    setSlatsPlaced((prev) => {
      const next: [boolean, boolean, boolean] = [...prev];
      next[idx] = true;
      return next;
    });
  };

  const handleDrillDrainage = () => {
    workshopAudio.playSnapComplete();
    setDrainDrilled(true);
  };

  const handleFitLiner = () => {
    workshopAudio.playPickup();
    setLinerFitted(true);
  };

  const handleQuickBuildComplete = () => {
    workshopAudio.playPourAndBloom();
    setLeftUprightPlaced(true);
    setRightUprightPlaced(true);
    setSlatsPlaced([true, true, true]);
    setDrainDrilled(true);
    setLinerFitted(true);
    const cleanBuilder = builderName.trim().slice(0, 40) || farmerName || 'Farmer';
    onCompleteRackAssembly({
      rackIndex: clampedRackIndex,
      materialId: selectedMat.id,
      isRecyclable: selectedMat.category === 'recyclable',
      builderName: cleanBuilder,
      builtAtMs: Date.now(),
      quickBuilt: true,
    });
    setJustPlacedRackIndex(clampedRackIndex);
  };

  const handleConfirmPlacement = () => {
    workshopAudio.playPourAndBloom();
    const cleanBuilder = builderName.trim().slice(0, 40) || farmerName || 'Farmer';
    onCompleteRackAssembly({
      rackIndex: clampedRackIndex,
      materialId: selectedMat.id,
      isRecyclable: selectedMat.category === 'recyclable',
      builderName: cleanBuilder,
      builtAtMs: Date.now(),
      quickBuilt: false,
    });
    setJustPlacedRackIndex(clampedRackIndex);
  };

  const coOpPresets = [
    farmerName || 'Farmer 1',
    'Teammate 2',
    'Teammate 3',
  ].filter((val, idx, arr) => arr.indexOf(val) === idx);

  const visibleUprightLeft = step >= 3 || leftUprightPlaced;
  const visibleUprightRight = step >= 3 || rightUprightPlaced;
  const visibleSlats = [
    step >= 4 || slatsPlaced[0],
    step >= 4 || slatsPlaced[1],
    step >= 4 || slatsPlaced[2],
  ];
  const visibleDrains = step >= 5 || drainDrilled;
  const visibleLiner = step >= 5 || linerFitted;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="5-Step Garden Rack Assembly Workbench"
      className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-3 sm:p-5"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-950 border border-emerald-500/45 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <span>Rack Assembly Workbench</span>
              <span className="text-slate-500">·</span>
              <span className="text-white tabular-nums">
                Rack {clampedRackIndex + 1} of {rackSize}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-amber-300 tabular-nums">
                {builtCount} of {rackSize} Racks Built
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-300 tabular-nums">
                Eco-Builder: {ecoBuilderPoints} pts
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
              5-Step Garden Rack Builder
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setQuickBuildEnabled((v) => !v)}
              aria-pressed={quickBuildEnabled}
              title="Subtle testing shortcut to quick-assemble with the chosen material"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                quickBuildEnabled
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Quick-Build / Demo Skip</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close rack assembly workbench"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-Rack Queue & Co-Op Builder Strip */}
        <div className="px-5 py-2.5 bg-slate-900/65 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {Array.from({ length: rackSize }, (_, idx) => {
              const built = builtByIndex.get(idx);
              const active = idx === clampedRackIndex;
              const mat = built ? getRackMaterialById(built.materialId) : null;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectTargetRack(idx)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    active
                      ? 'bg-emerald-600/25 border-emerald-400 text-white'
                      : built
                        ? 'bg-slate-900 border-emerald-500/35 text-emerald-300 hover:bg-slate-800'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {built ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Hammer className="w-3 h-3 text-amber-300 shrink-0" />
                  )}
                  <span>Rack {idx + 1}</span>
                  {mat && (
                    <span className="text-[10px] font-mono text-slate-300">
                      · {mat.shortName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Users className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            <span className="text-slate-400 hidden sm:inline">Co-Op Builder:</span>
            <div className="flex items-center gap-1">
              {coOpPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBuilderName(preset)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap shrink-0 cursor-pointer ${
                    builderName === preset
                      ? 'bg-sky-600/30 border-sky-400 text-sky-100'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={builderName}
              maxLength={40}
              aria-label="Co-op builder name"
              onChange={(e) => setBuilderName(e.target.value)}
              placeholder="Builder name"
              className="w-28 rounded-md bg-slate-950 border border-slate-700 px-2 py-0.5 text-xs text-white focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        {/* 5-Step Progress Bar */}
        <div className="px-5 py-2.5 border-b border-slate-800/90 flex items-center gap-1.5 overflow-x-auto">
          {STEP_LABELS.map((item) => {
            const isCurrent = step === item.step && justPlacedRackIndex === null;
            const isDone =
              justPlacedRackIndex !== null ||
              step > item.step ||
              (item.step === 2 && step2Ready) ||
              (item.step === 3 && step3Ready) ||
              (item.step === 4 && step4Ready);
            return (
              <button
                key={item.step}
                type="button"
                disabled={item.step > step && justPlacedRackIndex === null}
                onClick={() => {
                  if (item.step <= step && justPlacedRackIndex === null) {
                    setStep(item.step);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                  isCurrent
                    ? 'bg-emerald-600 text-white border-emerald-400 cursor-pointer'
                    : isDone
                      ? 'bg-slate-900 text-emerald-300 border-emerald-500/40 cursor-pointer'
                      : 'bg-slate-950 text-slate-500 border-slate-800 cursor-not-allowed'
                }`}
              >
                {item.short}
              </button>
            );
          })}
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {justPlacedRackIndex !== null ? (
            <div className="rounded-2xl bg-slate-900 border border-emerald-500/45 p-5 sm:p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                  Rack {justPlacedRackIndex + 1} of {rackSize} Active in Garden Grid
                </div>
                <h3 className="text-xl font-bold text-white mt-1">
                  {selectedMat.name} Rack Placed!
                </h3>
                <p className="text-sm text-slate-300 mt-1">
                  Assembled by <strong className="text-white">{builderName || farmerName}</strong> ·{' '}
                  {selectedMat.category === 'recyclable'
                    ? `+${selectedMat.ecoPoints} Eco-Builder points earned`
                    : 'Standard hardware build'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                {nextUnbuiltIndex !== undefined ? (
                  <button
                    type="button"
                    onClick={() => onSelectTargetRack(nextUnbuiltIndex)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Hammer className="w-4 h-4" />
                    <span>
                      Assemble Next Rack (Rack {nextUnbuiltIndex + 1} of {rackSize})
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-full text-xs font-mono text-emerald-300 pb-1">
                    All {rackSize} of {rackSize} racks are built and active for PVC pipes &amp; seeds!
                  </div>
                )}

                <button
                  type="button"
                  onClick={onProceedToPlanting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Go to Garden Rack Manager</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left: Step Interactive Controls (7 cols) */}
              <div className="lg:col-span-7 space-y-3.5">
                {step === 1 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white">
                          Step 1: Choose Frame Material for Rack {clampedRackIndex + 1}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Recyclable builds earn <strong className="text-emerald-300">+25 Eco-Builder pts</strong> and display that exact material in your 3D garden.
                        </p>
                      </div>
                      <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryFilter('recyclable');
                            if (selectedMat.category !== 'recyclable') {
                              setSelectedMaterialId('reclaimed_pvc');
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                            categoryFilter === 'recyclable'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          <Recycle className="w-3.5 h-3.5" />
                          <span>Recyclable (+25)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryFilter('standard');
                            if (selectedMat.category !== 'standard') {
                              setSelectedMaterialId('standard_pvc');
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                            categoryFilter === 'standard'
                              ? 'bg-slate-700 text-white'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Standard
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {filteredMaterials.map((mat) => {
                        const selected = mat.id === selectedMaterialId;
                        return (
                          <button
                            key={mat.id}
                            type="button"
                            onClick={() => handleSelectMaterial(mat.id)}
                            className={`text-left rounded-xl p-3 border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                              selected
                                ? 'bg-slate-900 border-emerald-400 ring-1 ring-emerald-400/50'
                                : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-4 h-4 rounded border shrink-0"
                                  style={{
                                    backgroundColor: mat.swatchHex,
                                    borderColor: mat.edgeHex,
                                  }}
                                />
                                <span className="text-xs sm:text-sm font-bold text-white truncate">
                                  {mat.name}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-mono font-bold shrink-0 ${
                                  mat.ecoPoints > 0 ? 'text-emerald-300' : 'text-slate-400'
                                }`}
                              >
                                {mat.badgeLabel}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Educational Sustainability / Cost / Durability Card */}
                    <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          Material Field Guide: {selectedMat.name}
                        </span>
                        <span
                          className={`font-mono text-[11px] font-semibold ${
                            selectedMat.ecoPoints > 0 ? 'text-emerald-300' : 'text-slate-400'
                          }`}
                        >
                          {selectedMat.ecoPoints > 0 ? `+${selectedMat.ecoPoints} Eco-Builder Pts` : '0 Bonus Pts'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-slate-300">
                        <p>
                          <strong className="text-emerald-300">Sustainability:</strong>{' '}
                          {selectedMat.sustainabilityTip}
                        </p>
                        <p>
                          <strong className="text-amber-300">Cost-Saving:</strong>{' '}
                          {selectedMat.costSavingTip}
                        </p>
                        <p>
                          <strong className="text-sky-300">Structural Durability:</strong>{' '}
                          {selectedMat.durabilityTip}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Step 2: Position the 2 Vertical Side Uprights ({uprightsDoneCount}/2)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Tap each upright piece below or click the glowing left &amp; right sockets on the workbench diagram to lock the load-bearing frame posts.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={leftUprightPlaced}
                        onClick={() => handlePlaceUpright('left')}
                        className={`flex items-center justify-between gap-2 rounded-xl p-3 border text-left transition-colors ${
                          leftUprightPlaced
                            ? 'bg-emerald-950/35 border-emerald-500/45 text-emerald-200 cursor-default'
                            : 'bg-slate-900 border-amber-400/50 hover:bg-slate-800 text-white cursor-pointer'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">1. Left Vertical Upright</div>
                          <div className="text-[11px] text-slate-400">
                            {leftUprightPlaced ? 'Anchored at West bay post' : 'Click to snap into West slot'}
                          </div>
                        </div>
                        {leftUprightPlaced ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Wrench className="w-4 h-4 text-amber-300 shrink-0" />
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={rightUprightPlaced}
                        onClick={() => handlePlaceUpright('right')}
                        className={`flex items-center justify-between gap-2 rounded-xl p-3 border text-left transition-colors ${
                          rightUprightPlaced
                            ? 'bg-emerald-950/35 border-emerald-500/45 text-emerald-200 cursor-default'
                            : 'bg-slate-900 border-amber-400/50 hover:bg-slate-800 text-white cursor-pointer'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">2. Right Vertical Upright</div>
                          <div className="text-[11px] text-slate-400">
                            {rightUprightPlaced ? 'Anchored at East bay post' : 'Click to snap into East slot'}
                          </div>
                        </div>
                        {rightUprightPlaced ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Wrench className="w-4 h-4 text-amber-300 shrink-0" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Step 3: Attach 3 Horizontal Cross Slats ({slatsDoneCount}/3)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Bolt all 3 horizontal cross slats between your uprights to prevent bowing when water fills the hydroponic trough.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {(['Rear Support Slat', 'Center Load Slat', 'Front Cradle Slat'] as const).map(
                        (label, sIdx) => {
                          const placed = slatsPlaced[sIdx];
                          return (
                            <button
                              key={label}
                              type="button"
                              disabled={placed}
                              onClick={() => handlePlaceSlat(sIdx as 0 | 1 | 2)}
                              className={`w-full flex items-center justify-between gap-2 rounded-xl p-3 border text-left transition-colors ${
                                placed
                                  ? 'bg-emerald-950/35 border-emerald-500/45 text-emerald-200 cursor-default'
                                  : 'bg-slate-900 border-amber-400/50 hover:bg-slate-800 text-white cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div>
                                  <div className="text-xs font-bold">
                                    Slat {sIdx + 1}: {label}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {placed ? 'Fastened across uprights' : 'Click to bolt slat across bay'}
                                  </div>
                                </div>
                              </div>
                              {placed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <span className="text-xs font-semibold text-amber-300 shrink-0">
                                  Attach
                                </span>
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Step 4: Drill Drainage Holes &amp; Fit Moisture Liner
                      </h3>
                      <p className="text-xs text-slate-400">
                        Drill 4 overflow drainage holes and lay down the waterproof liner so splashes never rot your rack frame.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={drainDrilled}
                        onClick={handleDrillDrainage}
                        className={`flex items-center justify-between gap-2 rounded-xl p-3 border text-left transition-colors ${
                          drainDrilled
                            ? 'bg-emerald-950/35 border-emerald-500/45 text-emerald-200 cursor-default'
                            : 'bg-slate-900 border-sky-400/50 hover:bg-slate-800 text-white cursor-pointer'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">Drill 4 Drainage Holes</div>
                          <div className="text-[11px] text-slate-400">
                            {drainDrilled ? '4 clean ports drilled' : 'Click to drill overflow ports'}
                          </div>
                        </div>
                        {drainDrilled ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Drill className="w-4 h-4 text-sky-300 shrink-0" />
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={linerFitted}
                        onClick={handleFitLiner}
                        className={`flex items-center justify-between gap-2 rounded-xl p-3 border text-left transition-colors ${
                          linerFitted
                            ? 'bg-emerald-950/35 border-emerald-500/45 text-emerald-200 cursor-default'
                            : 'bg-slate-900 border-emerald-400/50 hover:bg-slate-800 text-white cursor-pointer'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">Fit Waterproof Liner</div>
                          <div className="text-[11px] text-slate-400">
                            {linerFitted ? 'Liner tucked & aligned' : 'Click to seat shelf liner'}
                          </div>
                        </div>
                        {linerFitted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Step 5: Confirm &amp; Place Rack {clampedRackIndex + 1} in Garden Grid
                      </h3>
                      <p className="text-xs text-slate-400">
                        Inspect your finished 5-piece rack before placing it into the 3D garden stand for PVC pipes and El Niño seeds.
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-900 border border-emerald-500/35 p-3.5 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-400">Garden Grid Slot</span>
                        <span className="font-mono font-bold text-white">
                          Rack {clampedRackIndex + 1} of {rackSize}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-400">Frame Material</span>
                        <span className="font-semibold text-emerald-300">{selectedMat.name}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-400">Co-Op Teammate Credit</span>
                        <span className="font-semibold text-sky-300">
                          {builderName.trim() || farmerName || 'Farmer'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-400">Eco-Builder Bonus</span>
                        <span className="font-mono font-bold text-amber-300">
                          {selectedMat.ecoPoints > 0
                            ? `+${selectedMat.ecoPoints} Eco-Builder Pts`
                            : '0 Bonus Pts (Standard)'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Live Interactive SVG Workbench Blueprint (5 cols) */}
              <div className="lg:col-span-5 rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>LIVE WORKBENCH BLUEPRINT</span>
                  <span style={{ color: selectedMat.accentHex }}>{selectedMat.shortName}</span>
                </div>

                <svg
                  viewBox="0 0 320 210"
                  className="w-full h-44 rounded-lg bg-slate-950 border border-slate-800"
                  aria-label="Interactive rack assembly diagram"
                >
                  {/* Blueprint Grid */}
                  <defs>
                    <pattern id="wbGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path
                        d="M 20 0 L 0 0 0 20"
                        fill="none"
                        stroke="rgba(148,163,184,0.08)"
                        strokeWidth="1"
                      />
                    </pattern>
                  </defs>
                  <rect width="320" height="210" fill="url(#wbGrid)" />

                  {/* Ground plinth */}
                  <rect x="28" y="182" width="264" height="8" rx="3" fill="#334155" />

                  {/* Left Upright Slot (clickable in Step 2) */}
                  {visibleUprightLeft ? (
                    <rect
                      x="48"
                      y="32"
                      width="20"
                      height="150"
                      rx="3"
                      fill={selectedMat.swatchHex}
                      stroke={selectedMat.edgeHex}
                      strokeWidth="2"
                    />
                  ) : (
                    <g
                      onClick={() => step === 2 && handlePlaceUpright('left')}
                      className={step === 2 ? 'cursor-pointer' : ''}
                    >
                      <rect
                        x="48"
                        y="32"
                        width="20"
                        height="150"
                        rx="3"
                        fill="rgba(251,191,36,0.12)"
                        stroke="#fbbf24"
                        strokeWidth="1.8"
                        strokeDasharray="5 4"
                      />
                      <text
                        x="58"
                        y="112"
                        textAnchor="middle"
                        fill="#fde68a"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        L
                      </text>
                    </g>
                  )}

                  {/* Right Upright Slot (clickable in Step 2) */}
                  {visibleUprightRight ? (
                    <rect
                      x="252"
                      y="32"
                      width="20"
                      height="150"
                      rx="3"
                      fill={selectedMat.swatchHex}
                      stroke={selectedMat.edgeHex}
                      strokeWidth="2"
                    />
                  ) : (
                    <g
                      onClick={() => step === 2 && handlePlaceUpright('right')}
                      className={step === 2 ? 'cursor-pointer' : ''}
                    >
                      <rect
                        x="252"
                        y="32"
                        width="20"
                        height="150"
                        rx="3"
                        fill="rgba(251,191,36,0.12)"
                        stroke="#fbbf24"
                        strokeWidth="1.8"
                        strokeDasharray="5 4"
                      />
                      <text
                        x="262"
                        y="112"
                        textAnchor="middle"
                        fill="#fde68a"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        R
                      </text>
                    </g>
                  )}

                  {/* 3 Horizontal Cross Slats */}
                  {[58, 102, 146].map((sy, idx) =>
                    visibleSlats[idx] ? (
                      <rect
                        key={sy}
                        x="66"
                        y={sy}
                        width="188"
                        height="14"
                        rx="2"
                        fill={selectedMat.swatchHex}
                        stroke={selectedMat.edgeHex}
                        strokeWidth="1.6"
                      />
                    ) : (
                      <g
                        key={sy}
                        onClick={() => step === 3 && handlePlaceSlat(idx as 0 | 1 | 2)}
                        className={step === 3 ? 'cursor-pointer' : ''}
                      >
                        <rect
                          x="66"
                          y={sy}
                          width="188"
                          height="14"
                          rx="2"
                          fill={step === 3 ? 'rgba(52,211,153,0.14)' : 'rgba(148,163,184,0.06)'}
                          stroke={step === 3 ? '#34d399' : '#475569'}
                          strokeWidth="1.4"
                          strokeDasharray="5 4"
                        />
                      </g>
                    )
                  )}

                  {/* Moisture Liner */}
                  {visibleLiner && (
                    <rect
                      x="70"
                      y="134"
                      width="180"
                      height="11"
                      rx="2"
                      fill="#1e293b"
                      stroke="#34d399"
                      strokeWidth="1.2"
                    />
                  )}

                  {/* 4 Drilled Drainage Ports */}
                  {visibleDrains &&
                    [92, 136, 184, 228].map((dx) => (
                      <g key={dx}>
                        <circle cx={dx} cy="153" r="4.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                      </g>
                    ))}
                </svg>

                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>
                    Parts:{' '}
                    <strong className="text-slate-200">
                      {uprightsDoneCount}/2 uprights · {slatsDoneCount}/3 slats
                    </strong>
                  </span>
                  <span className="text-sky-300">
                    {visibleLiner && visibleDrains ? 'Drain & Liner Ready' : 'Step ' + step + ' of 5'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        {justPlacedRackIndex === null && (
          <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/55 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(1, s - 1) as WorkbenchStep)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Back
                </button>
              )}
              {quickBuildEnabled && (
                <button
                  type="button"
                  onClick={handleQuickBuildComplete}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Quick-Build Rack {clampedRackIndex + 1} Now</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step === 1 && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Step 2: Position 2 Uprights</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {step === 2 && (
                <button
                  type="button"
                  disabled={!step2Ready}
                  onClick={() => setStep(3)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 ${
                    step2Ready
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Step 3: Attach 3 Cross Slats</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {step === 3 && (
                <button
                  type="button"
                  disabled={!step3Ready}
                  onClick={() => setStep(4)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 ${
                    step3Ready
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Step 4: Drill &amp; Fit Liner</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {step === 4 && (
                <button
                  type="button"
                  disabled={!step4Ready}
                  onClick={() => setStep(5)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 ${
                    step4Ready
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>Step 5: Review &amp; Place</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {step === 5 && (
                <button
                  type="button"
                  onClick={handleConfirmPlacement}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm &amp; Place Rack {clampedRackIndex + 1}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
