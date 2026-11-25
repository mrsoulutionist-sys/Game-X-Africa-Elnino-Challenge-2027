export type CropId =
  | 'amaranth'
  | 'spinach'
  | 'kale'
  | 'lettuce'
  | 'coriander'
  | 'basil'
  | 'mint'
  | 'spring_onion'
  | 'bok_choy'
  | 'cowpea';

export type CanopyStyle = 'rosette' | 'upright' | 'herb' | 'broad';
export type WeatherMode = 'normal' | 'rain_storm' | 'windy' | 'elnino_watch' | 'heatwave';

export const WEATHER_MODE_ORDER: WeatherMode[] = [
  'normal',
  'rain_storm',
  'windy',
  'elnino_watch',
  'heatwave',
];

export interface WeatherForecastMeta {
  id: WeatherMode;
  label: string;
  tempLabel: string;
  evapMultiplier: number;
  windSpeedMult: number;
  rainIntensity: number;
  rainAllowed: boolean;
  badgeHex: string;
  tip: string;
  precautions: string[];
}

export const WEATHER_FORECASTS: Record<WeatherMode, WeatherForecastMeta> = {
  normal: {
    id: 'normal',
    label: 'Normal Season',
    tempLabel: '24°C · Calm',
    evapMultiplier: 1.0,
    windSpeedMult: 0.45,
    rainIntensity: 0,
    rainAllowed: true,
    badgeHex: '#38bdf8',
    tip: 'Ideal baseline conditions. Harvest JoJo water and pre-check shade cloth & windbreaks.',
    precautions: [
      'Check capillary wicks hang freely into pipe reservoirs.',
      'Pre-fill JoJo tank before seasonal weather shifts arrive.',
      'Inspect compost bin aeration and moisture.',
    ],
  },
  rain_storm: {
    id: 'rain_storm',
    label: 'Rain & Storm',
    tempLabel: '19°C · Heavy Squall',
    evapMultiplier: 0.55,
    windSpeedMult: 1.75,
    rainIntensity: 1.0,
    rainAllowed: true,
    badgeHex: '#60a5fa',
    tip: 'Heavy storm squalls! Capture free rainwater via JoJo gutter diverter and latch storm anchor straps.',
    precautions: [
      'Install Storm Anchor Tie-Downs so vertical PVC tiers stay locked against gusts.',
      'Open the JoJo Gutter Diverter to harvest free stormwater (+28 L surge).',
      'Check Door 3 mulch collar & drainage so compost nutrients are not washed away.',
    ],
  },
  windy: {
    id: 'windy',
    label: 'High Berg Winds',
    tempLabel: '29°C · 55 km/h Gusts',
    evapMultiplier: 1.48,
    windSpeedMult: 2.3,
    rainIntensity: 0,
    rainAllowed: false,
    badgeHex: '#f59e0b',
    tip: 'Dry berg winds strip moisture off leaves fast! Deploy Windbreak Netting to cut wind shear & evaporation.',
    precautions: [
      'Deploy Woven Windbreak Netting around the rack (-55% wind shear & leaf bruising).',
      'Add Door 3 Cardboard Mulch Collars to lock reservoir & root moisture.',
      'Favor sturdy broad-leaf crops (Morogo, Kale, Spinach) with low center of gravity.',
    ],
  },
  elnino_watch: {
    id: 'elnino_watch',
    label: 'El Niño Watch',
    tempLabel: '32°C · Dry Heat',
    evapMultiplier: 1.35,
    windSpeedMult: 1.15,
    rainIntensity: 0,
    rainAllowed: true,
    badgeHex: '#fb923c',
    tip: 'Hot dry air incoming! Top up your JoJo tank, install 40% Shade Cloth & pick heat-hardy greens.',
    precautions: [
      'Pull 40% Agricultural Shade Cloth over the rack (-35% evaporation).',
      'Install 2L Door 3 Drip-Feeders beside outdoor root beds.',
      'Keep JoJo reserve above 30 L before Level restrictions start.',
    ],
  },
  heatwave: {
    id: 'heatwave',
    label: '38°C Heatwave',
    tempLabel: '38°C · L4 Water Cap',
    evapMultiplier: 2.0,
    windSpeedMult: 0.95,
    rainIntensity: 0,
    rainAllowed: false,
    badgeHex: '#ef4444',
    tip: 'Municipal water restricted! 40% Shade Cloth + closed PVC wicking + mulch save 75% water.',
    precautions: [
      'Engage 40% Shade Cloth immediately to shield crops from 38°C scorching.',
      'Water only from stored JoJo reserves — zero municipal hose waste.',
      'Keep compost layer active so plants stay vigorous without heat stress.',
    ],
  },
};

export interface CropDefinition {
  id: CropId;
  name: string;
  shortLabel: string;
  maturityHours: number;
  waterDurationHours: number;
  servingsPerHarvest: number;
  heatResilient: boolean;
  droughtTrait: string;
  leafColorHex: number;
  accentColorHex: number;
  canopyStyle: CanopyStyle;
}

export interface TierSaveState {
  tierIndex: number;
  pipeInstalled: boolean;
  cropId: CropId | null;
  plantedAtMs: number | null;
  wateredAtMs: number | null;
  waterDurationHours: number;
  harvested: boolean;
}

export interface TierLiveMetrics {
  growthPct: number;
  growthPctExact: number;
  waterPct: number;
  waterPctExact: number;
  harvestReady: boolean;
  remainingMs: number;
  countdownLabel: string;
  waterRemainingMs: number;
  waterCountdownLabel: string;
  harvestAtMs: number | null;
  statusText: string;
}

export function formatDurationCompact(ms: number, includeSeconds = false): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  if (includeSeconds) {
    return `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

export const EL_NINO_CROPS: CropDefinition[] = [
  {
    id: 'amaranth',
    name: 'African Amaranth (Morogo)',
    shortLabel: 'Morogo',
    maturityHours: 18,
    waterDurationHours: 96,
    servingsPerHarvest: 6,
    heatResilient: true,
    droughtTrait: 'Thrives in extreme El Niño heat with minimal water loss; rich in iron and protein.',
    leafColorHex: 0x3b9a45,
    accentColorHex: 0x70c965,
    canopyStyle: 'broad',
  },
  {
    id: 'spinach',
    name: 'Swiss Chard (Spinach)',
    shortLabel: 'Spinach',
    maturityHours: 24,
    waterDurationHours: 84,
    servingsPerHarvest: 6,
    heatResilient: true,
    droughtTrait: 'Cut-and-come-again leaves sustain households even when outdoor fields fail.',
    leafColorHex: 0x2d8242,
    accentColorHex: 0x57b863,
    canopyStyle: 'broad',
  },
  {
    id: 'kale',
    name: 'Drought-Hardy Kale',
    shortLabel: 'Kale',
    maturityHours: 32,
    waterDurationHours: 96,
    servingsPerHarvest: 7,
    heatResilient: true,
    droughtTrait: 'Waxy leaves resist hot dry winds while steady capillary moisture prevents wilting.',
    leafColorHex: 0x2a6e46,
    accentColorHex: 0x489c68,
    canopyStyle: 'broad',
  },
  {
    id: 'lettuce',
    name: 'Heat-Tolerant Butterhead',
    shortLabel: 'Lettuce',
    maturityHours: 18,
    waterDurationHours: 72,
    servingsPerHarvest: 4,
    heatResilient: false,
    droughtTrait: 'Fast compact rosette grows cleanly in shaded PVC tiers away from scorching sun.',
    leafColorHex: 0x62bd4f,
    accentColorHex: 0x8de06e,
    canopyStyle: 'rosette',
  },
  {
    id: 'coriander',
    name: 'Dhania (Coriander)',
    shortLabel: 'Dhania',
    maturityHours: 12,
    waterDurationHours: 72,
    servingsPerHarvest: 3,
    heatResilient: false,
    droughtTrait: 'Rapid 12-hour sprout cycle delivers quick vitamins during sudden food shortages.',
    leafColorHex: 0x4aa854,
    accentColorHex: 0x7cd47d,
    canopyStyle: 'herb',
  },
  {
    id: 'basil',
    name: 'Sweet Genovese Basil',
    shortLabel: 'Basil',
    maturityHours: 16,
    waterDurationHours: 84,
    servingsPerHarvest: 4,
    heatResilient: true,
    droughtTrait: 'Loves warm air and turns passive wicking into dense aromatic foliage.',
    leafColorHex: 0x399444,
    accentColorHex: 0x67c46a,
    canopyStyle: 'herb',
  },
  {
    id: 'mint',
    name: 'Hardy Spearmint',
    shortLabel: 'Mint',
    maturityHours: 20,
    waterDurationHours: 84,
    servingsPerHarvest: 4,
    heatResilient: true,
    droughtTrait: 'Resilient runner roots recover rapidly even after prolonged dry-spell stress.',
    leafColorHex: 0x329c64,
    accentColorHex: 0x5fd192,
    canopyStyle: 'herb',
  },
  {
    id: 'spring_onion',
    name: 'Spring Onion (Scallion)',
    shortLabel: 'Scallion',
    maturityHours: 28,
    waterDurationHours: 108,
    servingsPerHarvest: 5,
    heatResilient: true,
    droughtTrait: 'Hollow tubular shoots conserve moisture and regrow continuously from bulbs.',
    leafColorHex: 0x4ca644,
    accentColorHex: 0x86d164,
    canopyStyle: 'upright',
  },
  {
    id: 'bok_choy',
    name: 'Dwarf Bok Choy',
    shortLabel: 'Bok Choy',
    maturityHours: 22,
    waterDurationHours: 80,
    servingsPerHarvest: 5,
    heatResilient: false,
    droughtTrait: 'Dense nutritious stalks fit 50 mm PVC ports with very low evaporation loss.',
    leafColorHex: 0x409b4b,
    accentColorHex: 0x8cd47e,
    canopyStyle: 'rosette',
  },
  {
    id: 'cowpea',
    name: 'Cowpea Greens (Dinawa)',
    shortLabel: 'Cowpea',
    maturityHours: 36,
    waterDurationHours: 120,
    servingsPerHarvest: 8,
    heatResilient: true,
    droughtTrait: 'Southern African drought-survival staple producing protein-rich leaves on low water.',
    leafColorHex: 0x347d3d,
    accentColorHex: 0x5eb060,
    canopyStyle: 'broad',
  },
];

export function getCropById(cropId: CropId | null): CropDefinition | null {
  if (!cropId) return null;
  return EL_NINO_CROPS.find((c) => c.id === cropId) ?? null;
}

export function createEmptyTier(tierIndex: number): TierSaveState {
  return {
    tierIndex,
    pipeInstalled: false,
    cropId: null,
    plantedAtMs: null,
    wateredAtMs: null,
    waterDurationHours: 84,
    harvested: false,
  };
}

export function computeTierLiveMetrics(
  tier: TierSaveState,
  nowMs: number,
  weatherMode: WeatherMode = 'normal',
  shadeClothInstalled = false,
  windbreakInstalled = false,
  stormBraceInstalled = false
): TierLiveMetrics {
  if (!tier.pipeInstalled) {
    return {
      growthPct: 0,
      growthPctExact: 0,
      waterPct: 0,
      waterPctExact: 0,
      harvestReady: false,
      remainingMs: 0,
      countdownLabel: '—',
      waterRemainingMs: 0,
      waterCountdownLabel: '—',
      harvestAtMs: null,
      statusText: 'Empty Slot',
    };
  }

  const crop = getCropById(tier.cropId);
  const baseWaterDuration = crop ? crop.waterDurationHours : tier.waterDurationHours || 84;
  const forecast = WEATHER_FORECASTS[weatherMode] ?? WEATHER_FORECASTS.normal;
  let mitigation = 1.0;
  if (shadeClothInstalled) mitigation *= 0.65;
  if (windbreakInstalled && (weatherMode === 'windy' || weatherMode === 'elnino_watch')) {
    mitigation *= 0.72;
  }
  if (stormBraceInstalled && weatherMode === 'rain_storm') {
    mitigation *= 0.85;
  }
  const evapMult = forecast.evapMultiplier * mitigation;
  const effectiveWaterMs = (baseWaterDuration / evapMult) * 3600000;

  let waterPctExact = 0;
  let waterRemainingMs = 0;
  if (tier.wateredAtMs !== null) {
    const elapsedWaterMs = Math.max(0, nowMs - tier.wateredAtMs);
    waterRemainingMs = Math.max(0, effectiveWaterMs - elapsedWaterMs);
    waterPctExact = Math.max(0, Math.min(100, (waterRemainingMs / effectiveWaterMs) * 100));
  }
  const waterPct = Math.round(waterPctExact);
  const waterCountdownLabel =
    tier.wateredAtMs === null
      ? 'Empty'
      : waterRemainingMs <= 0
        ? 'Dry — Refill'
        : formatDurationCompact(waterRemainingMs, false);

  if (!crop || tier.plantedAtMs === null) {
    return {
      growthPct: 0,
      growthPctExact: 0,
      waterPct,
      waterPctExact,
      harvestReady: false,
      remainingMs: 0,
      countdownLabel: '—',
      waterRemainingMs,
      waterCountdownLabel,
      harvestAtMs: null,
      statusText: waterPct > 0 ? 'Watered · Pick Seed' : 'Pipe Installed · Pick Seed',
    };
  }

  if (tier.wateredAtMs === null) {
    return {
      growthPct: 5,
      growthPctExact: 5,
      waterPct: 0,
      waterPctExact: 0,
      harvestReady: false,
      remainingMs: crop.maturityHours * 3600000,
      countdownLabel: `${crop.maturityHours}h 00m 00s`,
      waterRemainingMs: 0,
      waterCountdownLabel: 'Needs Water',
      harvestAtMs: null,
      statusText: `${crop.shortLabel} · Needs Water`,
    };
  }

  const maturityMs = crop.maturityHours * 3600000;
  const elapsedMs = Math.max(0, nowMs - tier.plantedAtMs);
  const remainingMs = Math.max(0, maturityMs - elapsedMs);
  const harvestAtMs = tier.plantedAtMs + maturityMs;
  const growthPctExact = Math.min(100, (elapsedMs / maturityMs) * 100);
  const growthPct = Math.min(100, Math.round(growthPctExact));

  const harvestReady = remainingMs <= 0 || growthPctExact >= 100;
  if (harvestReady) {
    return {
      growthPct: 100,
      growthPctExact: 100,
      waterPct,
      waterPctExact,
      harvestReady: true,
      remainingMs: 0,
      countdownLabel: 'Harvest Ready!',
      waterRemainingMs,
      waterCountdownLabel,
      harvestAtMs,
      statusText: `${crop.shortLabel} · Harvest Ready`,
    };
  }

  const countdownLabel = formatDurationCompact(remainingMs, true);
  return {
    growthPct,
    growthPctExact,
    waterPct,
    waterPctExact,
    harvestReady: false,
    remainingMs,
    countdownLabel,
    waterRemainingMs,
    waterCountdownLabel,
    harvestAtMs,
    statusText: `${crop.shortLabel} · ${growthPctExact.toFixed(1)}% · ${countdownLabel}`,
  };
}
