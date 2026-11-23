import React from 'react';
import {
  CheckCircle2,
  CloudRain,
  Droplets,
  Recycle,
  ShieldCheck,
  Sprout,
  Sun,
  X,
} from 'lucide-react';
import { WEATHER_FORECASTS, type WeatherMode } from '../workshop/crops';

interface ElNinoDefenseModalProps {
  open: boolean;
  jojoInstalled: boolean;
  jojoLitres: number;
  jojoCapacity: number;
  shadeClothInstalled: boolean;
  weatherMode: WeatherMode;
  litresSaved: number;
  compostCycleCount: number;
  onClose: () => void;
  onInstallJojo: () => void;
  onRefillJojo: () => void;
  onToggleShadeCloth: () => void;
  onAdvanceWeather: () => void;
  onOpenRackManager: () => void;
  onSwitchToCompost: () => void;
}

export const ElNinoDefenseModal: React.FC<ElNinoDefenseModalProps> = ({
  open,
  jojoInstalled,
  jojoLitres,
  jojoCapacity,
  shadeClothInstalled,
  weatherMode,
  litresSaved,
  compostCycleCount,
  onClose,
  onInstallJojo,
  onRefillJojo,
  onToggleShadeCloth,
  onAdvanceWeather,
  onOpenRackManager,
  onSwitchToCompost,
}) => {
  if (!open) return null;

  const weather = WEATHER_FORECASTS[weatherMode];
  const jojoPct = Math.round((jojoLitres / Math.max(1, jojoCapacity)) * 100);
  const readyForHeatwave = jojoInstalled && shadeClothInstalled && jojoLitres >= 12;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-950 border border-sky-500/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-900/70">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-semibold flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>El Niño Climate Defense Hub</span>
              <span className="text-emerald-300">Water Saved: {Math.round(litresSaved)} L</span>
              <span className="text-amber-300">Compost Cycles: {compostCycleCount}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
              JoJo Tank, 40% Shade Cloth &amp; Drought Forecast
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close El Niño defense hub"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Drought Readiness Status Banner */}
          <div
            className={`rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs ${
              readyForHeatwave
                ? 'bg-emerald-950/50 border-emerald-500/45 text-emerald-100'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
            }`}
          >
            <div className="flex items-center gap-2">
              {readyForHeatwave ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Droplets className="w-4 h-4 text-amber-300 shrink-0" />
              )}
              <span>
                {readyForHeatwave
                  ? 'Heatwave Defense Active: JoJo reserve + 40% shade canopy are shielding your vertical rack.'
                  : 'Preemptive Tip: Build your JoJo rainwater tank and install 40% shade cloth before testing heatwave mode.'}
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-slate-950/70 border border-slate-700/80">
              {weather.tempLabel}
            </span>
          </div>

          {/* 3 El Niño Defense Station Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. JoJo Rainwater Harvesting Tank */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <CloudRain className="w-4 h-4" />
                    JoJo Tank
                  </span>
                  <span className="text-xs font-mono text-white tabular-nums">
                    {jojoInstalled
                      ? `${Math.round(jojoLitres)}/${jojoCapacity} L`
                      : `${Math.round(jojoLitres)} L Bucket`}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, jojoPct)}%` }}
                    className="h-full bg-sky-500 transition-all"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                  Stores seasonal rain so Level 4 water restrictions never dry out your hydroponic pipes.
                </p>
              </div>
              <div className="mt-3">
                {!jojoInstalled ? (
                  <button
                    type="button"
                    onClick={onInstallJojo}
                    className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Build JoJo Tank (60 L)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRefillJojo}
                    disabled={jojoLitres >= jojoCapacity}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                      jojoLitres >= jojoCapacity
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : weather.rainAllowed
                          ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                          : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                    }`}
                  >
                    {jojoLitres >= jojoCapacity
                      ? 'Tank Full (60 L)'
                      : weather.rainAllowed
                        ? 'Catch Rain (+20 L)'
                        : 'Dew Recovery (+6 L)'}
                  </button>
                )}
              </div>
            </div>

            {/* 2. 40% Shade-Cloth Canopy */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Shade Cloth
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    {shadeClothInstalled ? '-35% Evap' : 'Exposed'}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                  40% agricultural shade cloth cools leaves during 38°C afternoon peaks and extends wicking water reserve.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleShadeCloth}
                className={`mt-3 w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  shadeClothInstalled
                    ? 'bg-emerald-700/80 hover:bg-emerald-600 text-emerald-100 border border-emerald-400/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {shadeClothInstalled ? 'Shade Cloth Active' : 'Install 40% Shade'}
              </button>
            </div>

            {/* 3. Solar El Niño Weather Forecast */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`text-xs font-bold flex items-center gap-1.5 ${
                      weatherMode === 'heatwave'
                        ? 'text-rose-400'
                        : weatherMode === 'elnino_watch'
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    {weather.label}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-snug">{weather.tip}</p>
              </div>
              <button
                type="button"
                onClick={onAdvanceWeather}
                className="mt-3 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/35 text-xs font-semibold cursor-pointer"
              >
                Test Next Forecast
              </button>
            </div>
          </div>
        </div>

        {/* Clean Cross-Segment Navigation Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            El Niño Defense is separate from your Vertical Rack and Door 3 Compost.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRackManager();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
            >
              <Sprout className="w-3.5 h-3.5" />
              <span>Open Vertical Rack</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToCompost();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
            >
              <Recycle className="w-3.5 h-3.5" />
              <span>Door 3: Compost</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
