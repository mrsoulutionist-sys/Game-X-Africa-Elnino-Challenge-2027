import React from 'react';
import {
  Anchor,
  CheckCircle2,
  CloudLightning,
  CloudRain,
  Droplets,
  Flame,
  Recycle,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Sun,
  Wind,
  X,
} from 'lucide-react';
import {
  WEATHER_FORECASTS,
  WEATHER_MODE_ORDER,
  type WeatherMode,
} from '../workshop/crops';

interface ElNinoDefenseModalProps {
  open: boolean;
  jojoInstalled: boolean;
  jojoLitres: number;
  jojoCapacity: number;
  shadeClothInstalled: boolean;
  windbreakInstalled: boolean;
  stormBraceInstalled: boolean;
  weatherMode: WeatherMode;
  litresSaved: number;
  compostCycleCount: number;
  onClose: () => void;
  onInstallJojo: () => void;
  onRefillJojo: () => void;
  onToggleShadeCloth: () => void;
  onToggleWindbreak: () => void;
  onToggleStormBrace: () => void;
  onSelectWeatherMode: (mode: WeatherMode) => void;
  onOpenRackManager: () => void;
  onSwitchToCompost: () => void;
}

const WEATHER_ICONS: Record<WeatherMode, React.ComponentType<{ className?: string }>> = {
  normal: Sun,
  rain_storm: CloudLightning,
  windy: Wind,
  elnino_watch: Flame,
  heatwave: Flame,
};

export const ElNinoDefenseModal: React.FC<ElNinoDefenseModalProps> = ({
  open,
  jojoInstalled,
  jojoLitres,
  jojoCapacity,
  shadeClothInstalled,
  windbreakInstalled,
  stormBraceInstalled,
  weatherMode,
  litresSaved,
  compostCycleCount,
  onClose,
  onInstallJojo,
  onRefillJojo,
  onToggleShadeCloth,
  onToggleWindbreak,
  onToggleStormBrace,
  onSelectWeatherMode,
  onOpenRackManager,
  onSwitchToCompost,
}) => {
  if (!open) return null;

  const weather = WEATHER_FORECASTS[weatherMode];
  const jojoPct = Math.round((jojoLitres / Math.max(1, jojoCapacity)) * 100);

  const isRecommendedComplete =
    weatherMode === 'rain_storm'
      ? stormBraceInstalled && jojoInstalled
      : weatherMode === 'windy'
        ? windbreakInstalled && jojoInstalled
        : weatherMode === 'heatwave' || weatherMode === 'elnino_watch'
          ? shadeClothInstalled && jojoInstalled && jojoLitres >= 12
          : jojoInstalled;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-950 border border-sky-500/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-900/70">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-semibold flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>Live 3D Weather &amp; Climate Precautions Hub</span>
              <span className="text-emerald-300">Water Saved: {Math.round(litresSaved)} L</span>
              <span className="text-amber-300">Compost Cycles: {compostCycleCount}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
              Real-Time 3D Weather Scenarios &amp; Garden Precautions
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
          {/* 5-Scenario Live 3D Weather Switcher */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                  Select Live 3D Weather Scenario
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Switching weather updates 3D sky, rain, lightning, wind gust animation &amp; crop evaporation right away.
                </p>
              </div>
              <span
                style={{ borderColor: weather.badgeHex, color: weather.badgeHex }}
                className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-950 border shrink-0"
              >
                {weather.tempLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {WEATHER_MODE_ORDER.map((modeKey) => {
                const meta = WEATHER_FORECASTS[modeKey];
                const Icon = WEATHER_ICONS[modeKey];
                const active = weatherMode === modeKey;
                return (
                  <button
                    key={modeKey}
                    type="button"
                    onClick={() => onSelectWeatherMode(modeKey)}
                    className={`rounded-xl border px-2.5 py-2 text-left transition-colors cursor-pointer flex flex-col gap-1 ${
                      active
                        ? 'bg-sky-950/90 border-sky-400 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[9px] font-mono uppercase text-slate-400">
                        {meta.evapMultiplier.toFixed(1)}x evap
                      </span>
                    </div>
                    <span className="text-xs font-bold leading-tight">{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Scenario Precautions Guidance */}
            <div
              className={`rounded-xl border p-3.5 text-xs space-y-2 ${
                isRecommendedComplete
                  ? 'bg-emerald-950/45 border-emerald-500/45 text-emerald-100'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 font-bold">
                  {isRecommendedComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
                  )}
                  <span>
                    {isRecommendedComplete
                      ? `Scenario Precautions Ready for ${weather.label}`
                      : `Recommended Precautions for ${weather.label}`}
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase text-slate-300 shrink-0">
                  Wind {weather.windSpeedMult.toFixed(1)}x
                </span>
              </div>

              <p className="text-xs leading-relaxed opacity-95">{weather.tip}</p>

              <ul className="space-y-1 pt-1 border-t border-white/10">
                {weather.precautions.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[11px] leading-snug">
                    <Droplets className="w-3.5 h-3.5 text-sky-300 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 4 Interactive 3D Precaution Equipment Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. JoJo Rainwater Harvesting Tank */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <CloudRain className="w-4 h-4" />
                    JoJo Rainwater Tank
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
                  Stores seasonal rain &amp; storm runoff so municipal drought restrictions never dry out your PVC reservoirs.
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
                        : weatherMode === 'rain_storm'
                          ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold cursor-pointer'
                          : weather.rainAllowed
                            ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                            : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                    }`}
                  >
                    {jojoLitres >= jojoCapacity
                      ? 'Tank Full (60 L)'
                      : weatherMode === 'rain_storm'
                        ? 'Harvest Storm Surge (+28 L)'
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
                    40% Shade Cloth
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    {shadeClothInstalled ? '-35% Heat Evap' : 'Unshaded'}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                  Renders 40% dark UV canopy directly over the rack in 3D, cooling leaves through 38°C afternoon El Niño peaks.
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
                {shadeClothInstalled ? 'Shade Cloth Deployed (On)' : 'Deploy 40% Shade Canopy'}
              </button>
            </div>

            {/* 3. Woven Windbreak Netting */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Wind className="w-4 h-4" />
                    Woven Windbreak Netting
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    {windbreakInstalled ? '-55% Leaf Shear' : 'Exposed'}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                  Installs dark green windbreak screens around the rack perimeter in 3D, slowing berg-wind leaf sway &amp; moisture loss.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleWindbreak}
                className={`mt-3 w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  windbreakInstalled
                    ? 'bg-amber-700/80 hover:bg-amber-600 text-amber-100 border border-amber-400/40'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {windbreakInstalled ? 'Windbreak Screens On' : 'Install Windbreak Netting'}
              </button>
            </div>

            {/* 4. Storm Anchors & JoJo Gutter Diverter */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Anchor className="w-4 h-4" />
                    Storm Anchors &amp; Gutter Pipe
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    {stormBraceInstalled ? 'Braced + Surge' : 'Unbraced'}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                  Mounts steel tie-down straps on rack posts and connects the JoJo roof gutter diverter to catch stormwater automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleStormBrace}
                className={`mt-3 w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  stormBraceInstalled
                    ? 'bg-cyan-700/80 hover:bg-cyan-600 text-cyan-100 border border-cyan-400/40'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                {stormBraceInstalled ? 'Storm Brace & Diverter Active' : 'Latch Storm Anchors + Diverter'}
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
