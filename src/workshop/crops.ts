export type CropId =
  | 'potatoes'
  | 'tomatoes'
  | 'onions'
  | 'green_peppers'
  | 'sweet_peppers'
  | 'sweet_corn'
  | 'cabbage'
  | 'carrots'
  | 'butternut'
  | 'beetroot';

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
      'Favor sturdy broad-leaf crops (Cabbage, Potatoes, Butternut) with low center of gravity.',
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
    id: 'potatoes',
    name: 'SA Potatoes (Sifra)',
    shortLabel: 'Potatoes',
    maturityHours: 24,
    waterDurationHours: 96,
    servingsPerHarvest: 8,
    heatResilient: true,
    droughtTrait: 'South Africa’s #1 staple crop; feeds households, stocks the market & fuels sanctuary herbivores.',
    leafColorHex: 0x3b8c3e,
    accentColorHex: 0xe2e8f0,
    canopyStyle: 'broad',
  },
  {
    id: 'tomatoes',
    name: 'Roma Jam Tomatoes',
    shortLabel: 'Tomatoes',
    maturityHours: 20,
    waterDurationHours: 84,
    servingsPerHarvest: 6,
    heatResilient: true,
    droughtTrait: 'Sun-loving SA market favorite; high daily yield for school sales and fresh pet treats.',
    leafColorHex: 0x2f8540,
    accentColorHex: 0xef4444,
    canopyStyle: 'broad',
  },
  {
    id: 'onions',
    name: 'Caledon Brown Onions',
    shortLabel: 'Onions',
    maturityHours: 22,
    waterDurationHours: 108,
    servingsPerHarvest: 6,
    heatResilient: true,
    droughtTrait: 'Low-evaporation tubular shoots store moisture and keep kitchens & markets supplied year-round.',
    leafColorHex: 0x4ca644,
    accentColorHex: 0xd97706,
    canopyStyle: 'upright',
  },
  {
    id: 'green_peppers',
    name: 'Green Bell Peppers',
    shortLabel: 'Green Peppers',
    maturityHours: 18,
    waterDurationHours: 84,
    servingsPerHarvest: 5,
    heatResilient: true,
    droughtTrait: 'Crisp, fast-turning crop ideal for shaded PVC channels, market baskets & animal vitamins.',
    leafColorHex: 0x2d7d3f,
    accentColorHex: 0x22c55e,
    canopyStyle: 'broad',
  },
  {
    id: 'sweet_peppers',
    name: 'Sweet Red & Gold Peppers',
    shortLabel: 'Peppers',
    maturityHours: 20,
    waterDurationHours: 84,
    servingsPerHarvest: 6,
    heatResilient: true,
    droughtTrait: 'High-value colourful peppers prized in school markets and rich in tortoise-friendly vitamin C.',
    leafColorHex: 0x358744,
    accentColorHex: 0xf59e0b,
    canopyStyle: 'broad',
  },
  {
    id: 'sweet_corn',
    name: 'South African Mielies (Corn)',
    shortLabel: 'Corn',
    maturityHours: 24,
    waterDurationHours: 96,
    servingsPerHarvest: 8,
    heatResilient: true,
    droughtTrait: 'Iconic maize staple; grain & sweet husks sell fast and feed sanctuary tortoises, rabbits & dassies.',
    leafColorHex: 0x4b993f,
    accentColorHex: 0xfacc15,
    canopyStyle: 'upright',
  },
  {
    id: 'cabbage',
    name: 'Cape Green Cabbage',
    shortLabel: 'Cabbage',
    maturityHours: 22,
    waterDurationHours: 92,
    servingsPerHarvest: 7,
    heatResilient: true,
    droughtTrait: 'Top SA household leaf crop; outer leaves nourish sanctuary animals while heads stock the store.',
    leafColorHex: 0x4fa85b,
    accentColorHex: 0x9be28d,
    canopyStyle: 'rosette',
  },
  {
    id: 'carrots',
    name: 'Nantes Garden Carrots',
    shortLabel: 'Carrots',
    maturityHours: 18,
    waterDurationHours: 80,
    servingsPerHarvest: 6,
    heatResilient: false,
    droughtTrait: 'Quick 18h harvest; sweet roots and leafy tops are the top snack for rabbits, grysbok & dassies.',
    leafColorHex: 0x469e49,
    accentColorHex: 0xf97316,
    canopyStyle: 'herb',
  },
  {
    id: 'butternut',
    name: 'Waltham Butternut Squash',
    shortLabel: 'Butternut',
    maturityHours: 24,
    waterDurationHours: 104,
    servingsPerHarvest: 7,
    heatResilient: true,
    droughtTrait: 'Heat-hardy SA dryland favorite that stores naturally and delivers high-calorie animal & family food.',
    leafColorHex: 0x378542,
    accentColorHex: 0xfb923c,
    canopyStyle: 'broad',
  },
  {
    id: 'beetroot',
    name: 'Detroit Red Beetroot',
    shortLabel: 'Beetroot',
    maturityHours: 18,
    waterDurationHours: 84,
    servingsPerHarvest: 5,
    heatResilient: true,
    droughtTrait: 'Dual-harvest crop: vitamin-rich leafy greens feed sanctuary pets while roots stock local markets.',
    leafColorHex: 0x3a8744,
    accentColorHex: 0xbe123c,
    canopyStyle: 'rosette',
  },
];

const LEGACY_CROP_FALLBACK: Record<string, CropId> = {
  amaranth: 'cabbage',
  spinach: 'beetroot',
  kale: 'cabbage',
  lettuce: 'green_peppers',
  coriander: 'carrots',
  basil: 'tomatoes',
  mint: 'sweet_peppers',
  spring_onion: 'onions',
  bok_choy: 'butternut',
  cowpea: 'potatoes',
};

export function getCropById(cropId: CropId | string | null): CropDefinition | null {
  if (!cropId) return null;
  const direct = EL_NINO_CROPS.find((c) => c.id === cropId);
  if (direct) return direct;
  const mappedId = LEGACY_CROP_FALLBACK[cropId];
  return mappedId ? EL_NINO_CROPS.find((c) => c.id === mappedId) ?? null : null;
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
