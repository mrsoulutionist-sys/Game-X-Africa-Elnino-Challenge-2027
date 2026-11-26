import React from 'react';
import {
  BatteryCharging,
  CheckCircle2,
  Compass,
  Droplets,
  Gauge,
  Lock,
  Sun,
  Thermometer,
  Volume2,
  Wrench,
  Zap,
} from 'lucide-react';
import type { WeatherMode } from '../workshop/crops';
import {
  SOLAR_FRAME_PART_LABELS,
  SOLAR_PANEL_PART_LABELS,
  SOLAR_WIRING_STAGE_LABELS,
  computeSolarTelemetry,
  type SolarProgressState,
  type SolarWiringMode,
} from '../workshop/solarData';
import type { SolarTargetKind } from '../workshop/solarWorkshopBuilder';

interface SolarWorkshopPanelProps {
  solar: SolarProgressState;
  weatherMode: WeatherMode;
  solarTarget: SolarTargetKind;
  onSnapFramePart: (partIndex: number) => void;
  onSnapPanelPart: (partIndex: number) => void;
  onSetWiringMode: (mode: SolarWiringMode) => void;
  onAdvanceWiringStage: (stageIndex: number) => void;
  onSetAngles: (tiltDeg: number, azimuthDeg: number) => void;
  onWashPanels: () => void;
  onSpeakGuide: () => void;
}

const FRAME_SHORT_LABELS = ['1. Skids', '2. Legs', '3. Rails', '4. Braces'];
const PANEL_SHORT_LABELS = ['1. Alum Frame', '2. PV Cells', '3. Glass'];
const WIRE_SHORT_LABELS = ['1. → Controller', '2. → Battery', '3. → Inverter', '4. → Rooms'];

export const SolarWorkshopPanel: React.FC<SolarWorkshopPanelProps> = ({
  solar,
  weatherMode,
  solarTarget,
  onSnapFramePart,
  onSnapPanelPart,
  onSetWiringMode,
  onAdvanceWiringStage,
  onSetAngles,
  onWashPanels,
  onSpeakGuide,
}) => {
  const telemetry = computeSolarTelemetry(solar, weatherMode);
  const activeStepNum: 1 | 2 | 3 | 4 = solar.step === 5 ? 4 : solar.step;
  const isDoorTarget = solarTarget === 'kitchen_door' || solarTarget === 'garden_door';

  const alignmentBadgeClass =
    telemetry.sunAlignmentPct >= 90
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60'
      : telemetry.sunAlignmentPct >= 65
        ? 'bg-amber-500/20 text-amber-200 border-amber-400/60'
        : 'bg-rose-500/20 text-rose-200 border-rose-400/60';

  const alignmentBarClass =
    telemetry.sunAlignmentPct >= 90
      ? 'bg-emerald-400'
      : telemetry.sunAlignmentPct >= 65
        ? 'bg-amber-400'
        : 'bg-rose-500';

  if (isDoorTarget) return null;

  return (
    <div className="fixed bottom-24 md:bottom-5 left-1/2 -translate-x-1/2 z-20 w-[min(92vw,34rem)] md:w-[min(calc(100vw-21rem),34rem)] rounded-2xl bg-slate-950/88 border border-amber-400/45 px-3 py-2.5 shadow-2xl space-y-2 pointer-events-auto">
      {/* Compact Header: Step Dots + Vocal Replay Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sun className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex items-center gap-1 text-[10px] font-mono">
            {[1, 2, 3, 4].map((n) => {
              const done = solar.step > n || (n === 4 && solar.step >= 5);
              const active = activeStepNum === n && solar.step < 5;
              return (
                <span
                  key={n}
                  className={`px-2 py-0.5 rounded-md border whitespace-nowrap ${
                    done
                      ? 'bg-emerald-600/30 border-emerald-400/60 text-emerald-300'
                      : active
                        ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}
                >
                  {done ? `✓ S${n}` : `S${n}`}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {solar.dustLevel > 0 && (
            <button
              type="button"
              onClick={onWashPanels}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-bold whitespace-nowrap cursor-pointer"
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>Wash</span>
            </button>
          )}
          <button
            type="button"
            onClick={onSpeakGuide}
            title="Hear Prof. E Vocal Guide"
            aria-label="Hear Prof. E Vocal Guide"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/45 text-[11px] font-semibold cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Voice</span>
          </button>
        </div>
      </div>

      {/* Step 1: Elevated PVC Frame Parts */}
      {solar.step === 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {SOLAR_FRAME_PART_LABELS.map((fullLabel, idx) => {
            const done = solar.framePartsDone > idx;
            const next = solar.framePartsDone === idx;
            return (
              <button
                key={fullLabel}
                type="button"
                disabled={!next}
                title={fullLabel}
                onClick={() => onSnapFramePart(idx)}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  done
                    ? 'bg-emerald-600/25 border-emerald-400/60 text-emerald-300 cursor-default'
                    : next
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200 font-bold cursor-pointer'
                      : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : next ? (
                  <Wrench className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Lock className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate">{FRAME_SHORT_LABELS[idx] ?? fullLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 2: Solar Panel Stack */}
      {solar.step === 2 && (
        <div className="grid grid-cols-3 gap-1.5">
          {SOLAR_PANEL_PART_LABELS.map((fullLabel, idx) => {
            const done = solar.panelPartsDone > idx;
            const next = solar.panelPartsDone === idx;
            return (
              <button
                key={fullLabel}
                type="button"
                disabled={!next}
                title={fullLabel}
                onClick={() => onSnapPanelPart(idx)}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  done
                    ? 'bg-emerald-600/25 border-emerald-400/60 text-emerald-300 cursor-default'
                    : next
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200 font-bold cursor-pointer'
                      : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : next ? (
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Lock className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate">{PANEL_SHORT_LABELS[idx] ?? fullLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 3: Multimeter Toggle + Cable Snaps */}
      {solar.step === 3 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/90 border border-amber-500/35 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-300 tabular-nums">
              <Gauge className="w-4 h-4 shrink-0" />
              <span>
                {telemetry.voltageV}V · {telemetry.currentA}A
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSetWiringMode('series')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border cursor-pointer ${
                  solar.wiringMode === 'series'
                    ? 'bg-sky-500 text-slate-950 border-sky-300'
                    : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                Series
              </button>
              <button
                type="button"
                onClick={() => onSetWiringMode('parallel')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border cursor-pointer ${
                  solar.wiringMode === 'parallel'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                    : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                Parallel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {SOLAR_WIRING_STAGE_LABELS.map((fullLabel, idx) => {
              const done = solar.wiredStage > idx;
              const next = solar.wiredStage === idx;
              return (
                <button
                  key={fullLabel}
                  type="button"
                  disabled={!next}
                  title={fullLabel}
                  onClick={() => onAdvanceWiringStage(idx)}
                  className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                    done
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 cursor-default'
                      : next
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200 font-bold cursor-pointer'
                        : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : next ? (
                    <Zap className="w-3 h-3 shrink-0" />
                  ) : (
                    <Lock className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">{WIRE_SHORT_LABELS[idx] ?? fullLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4 & Operational Hub: Numeric Metrics + Gimbal Sliders */}
      {solar.step >= 4 && (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono tabular-nums">
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
              <span className="font-bold text-white truncate">{telemetry.watts}W</span>
            </div>
            <div className={`rounded-lg border px-2 py-1 flex items-center gap-1 ${alignmentBadgeClass}`}>
              <Compass className="w-3 h-3 shrink-0" />
              <span className="font-bold truncate">{telemetry.sunAlignmentPct}%</span>
            </div>
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 flex items-center gap-1 text-sky-300">
              <BatteryCharging className="w-3 h-3 shrink-0" />
              <span className="font-bold truncate">{telemetry.batteryHealthPct}%</span>
            </div>
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 flex items-center gap-1 text-amber-200">
              <Thermometer className="w-3 h-3 shrink-0" />
              <span className="font-bold truncate">{telemetry.panelTempC}°C</span>
            </div>
          </div>

          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              style={{ width: `${telemetry.sunAlignmentPct}%` }}
              className={`h-full transition-all duration-200 ${alignmentBarClass}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 items-center text-[11px] font-mono">
            <label className="flex flex-col gap-0.5 text-slate-200">
              <div className="flex justify-between">
                <span>Tilt</span>
                <span className="text-amber-300 font-bold">{solar.tiltDeg}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={75}
                value={solar.tiltDeg}
                onChange={(e) => onSetAngles(Number(e.target.value), solar.azimuthDeg)}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </label>

            <label className="flex flex-col gap-0.5 text-slate-200">
              <div className="flex justify-between">
                <span>Rotate</span>
                <span className="text-sky-300 font-bold">{solar.azimuthDeg}°</span>
              </div>
              <input
                type="range"
                min={-90}
                max={90}
                value={solar.azimuthDeg}
                onChange={(e) => onSetAngles(solar.tiltDeg, Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSetWiringMode('series')}
                className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer ${
                  solar.wiringMode === 'series'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Series
              </button>
              <button
                type="button"
                onClick={() => onSetWiringMode('parallel')}
                className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer ${
                  solar.wiringMode === 'parallel'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Parallel
              </button>
            </div>

            <button
              type="button"
              onClick={onWashPanels}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-semibold border bg-slate-900 hover:bg-slate-800 text-sky-300 border-sky-500/40 cursor-pointer"
            >
              <Droplets className="w-3 h-3" />
              <span>Clean ({solar.cleanCount}x)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
