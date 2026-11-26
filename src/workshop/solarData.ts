import type { WeatherMode } from './crops';

export type SolarWiringMode = 'series' | 'parallel';

export type SolarStepNumber = 1 | 2 | 3 | 4 | 5;
// 1 = PVC Mounting Frame, 2 = Assemble Solar Panel, 3 = Wire System, 4 = Sun Alignment, 5 = Operational

export interface SolarProgressState {
  step: SolarStepNumber;
  framePartsDone: number; // 0..4 (Base Skids, Uprights, Angled Rails, Cross Brace)
  panelPartsDone: number; // 0..3 (Aluminum Frame, PV Cell Array, Tempered Glass)
  wiringMode: SolarWiringMode;
  wiredStage: number; // 0..4 (Panel->Controller, Controller->Battery, Battery->Inverter, Inverter->Bus)
  tiltDeg: number; // 0..75
  azimuthDeg: number; // -90..90
  dustLevel: number; // 0..100
  yieldsSinceClean: number; // 0..50
  cleanCount: number; // 0..10000
}

export const DEFAULT_SOLAR_PROGRESS: SolarProgressState = {
  step: 1,
  framePartsDone: 0,
  panelPartsDone: 0,
  wiringMode: 'series',
  wiredStage: 0,
  tiltDeg: 18,
  azimuthDeg: -35,
  dustLevel: 0,
  yieldsSinceClean: 0,
  cleanCount: 0,
};

export interface SolarStepGuide {
  step: 1 | 2 | 3 | 4;
  title: string;
  whatToDo: string;
  whyItMatters: string;
  grade10Note: string;
}

export const SOLAR_STEP_GUIDES: SolarStepGuide[] = [
  {
    step: 1,
    title: 'Step 1: Elevated PVC Mounting Frame',
    whatToDo:
      'Snap and connect the 4 PVC base skids, upright legs, angled sun rails, and cross-brace strut on the assembly bench.',
    whyItMatters:
      'Elevating solar panels creates an airflow gap underneath. During an El Niño heatwave, hot solar panels lose voltage—rising cool air keeps them efficient!',
    grade10Note:
      'Silicon PV cells lose ~0.4% efficiency per °C above 25°C (negative temperature coefficient of Voc). Passive convective airflow reduces cell temperature by 8–12°C.',
  },
  {
    step: 2,
    title: 'Step 2: Assemble the Solar Panel',
    whatToDo:
      'Snap the aluminum frame border, seat the photovoltaic (PV) silicon cell array inside, and lock the protective glass cover onto your PVC rig.',
    whyItMatters:
      'Photovoltaic cells knock electrons loose when sunlight photons hit silicon, creating Direct Current (DC) power while tempered glass guards against windblown dust.',
    grade10Note:
      'Two 12V / 100W monocrystalline modules yield ~200Wp under 1000 W/m² irradiance; anti-reflective tempered glass preserves >91% photon transmission.',
  },
  {
    step: 3,
    title: 'Step 3: Wire the System (Series vs. Parallel)',
    whatToDo:
      'Choose Series or Parallel wiring on the Digital Multimeter, then connect Red (+) and Black (-) cables in order: Charge Controller → Battery Bank → Inverter → Facility Bus.',
    whyItMatters:
      'Series adds Voltage (great for pushing heavy Garden water pumps). Parallel adds Amperage (faster Battery charging). The Charge Controller protects the battery and the Inverter turns DC into AC!',
    grade10Note:
      'Series: V_total = V1 + V2 (~36V open, ~24V load), I = I_single. Parallel: I_total = I1 + I2 (~11A), V = V_single (~12V). Power P = V × I stays balanced before losses.',
  },
  {
    step: 4,
    title: 'Step 4: Sun Alignment & Tilt Calibration',
    whatToDo:
      'Use the Tilt and Rotate controls in the sunlit mounting zone until your panel faces the live sun rays and hits 90%–100% Optimal Solar Capture.',
    whyItMatters:
      'Tilting panels perpendicular to South African sunlight maximizes photon capture so Kitchen tools, Garden irrigation pumps, and Compost sensors run smoothly all day.',
    grade10Note:
      'Irradiance follows Lambert’s Cosine Law: P_captured ∝ cos(θ_incidence). Keeping incidence angle θ < 16° maintains >96% peak solar capture.',
  },
];

export const SOLAR_FRAME_PART_LABELS = [
  '1. PVC Base Skids',
  '2. Rear & Front Uprights',
  '3. Angled Tilt Rails',
  '4. Stability Cross-Brace',
];

export const SOLAR_PANEL_PART_LABELS = [
  '1. Aluminum Frame',
  '2. Silicon PV Cell Array',
  '3. Tempered Glass Shield',
];

export const SOLAR_WIRING_STAGE_LABELS = [
  '1. Panel → Charge Controller (Yellow DC)',
  '2. Charge Controller → Battery Bank (Blue Storage)',
  '3. Battery Bank → Inverter (DC Bus)',
  '4. Inverter → Kitchen/Garden/Compost (Green AC)',
];

export interface SolarTelemetry {
  targetTiltDeg: number;
  targetAzimuthDeg: number;
  sunAlignmentPct: number;
  angleOffsetDeg: number;
  voltageV: number;
  currentA: number;
  watts: number;
  maxPotentialWatts: number;
  panelTempC: number;
  batteryHealthPct: number;
  dustPenaltyPct: number;
  gardenPumpEfficiencyPct: number;
  isOptimalCapture: boolean;
  needsDustMaintenance: boolean;
}

export function getSunTargetAngles(weatherMode: WeatherMode): {
  tiltDeg: number;
  azimuthDeg: number;
} {
  if (weatherMode === 'heatwave') {
    return { tiltDeg: 28, azimuthDeg: 10 };
  }
  if (weatherMode === 'elnino_watch') {
    return { tiltDeg: 32, azimuthDeg: 5 };
  }
  if (weatherMode === 'windy') {
    return { tiltDeg: 36, azimuthDeg: -5 };
  }
  if (weatherMode === 'rain_storm') {
    return { tiltDeg: 40, azimuthDeg: 0 };
  }
  return { tiltDeg: 34, azimuthDeg: 0 };
}

export function computeSolarTelemetry(
  solar: SolarProgressState,
  weatherMode: WeatherMode
): SolarTelemetry {
  const target = getSunTargetAngles(weatherMode);
  const tiltDiff = Math.abs(solar.tiltDeg - target.tiltDeg);
  const azDiff = Math.abs(solar.azimuthDeg - target.azimuthDeg);
  const angleOffsetDeg = Math.round(Math.hypot(tiltDiff, azDiff * 0.75));

  const alignmentFactor = Math.max(0.18, Math.cos((Math.min(78, angleOffsetDeg) * Math.PI) / 180));
  const sunAlignmentPct = Math.round(alignmentFactor * 100);

  const weatherIrradiance =
    weatherMode === 'rain_storm'
      ? 0.62
      : weatherMode === 'windy'
        ? 0.92
        : weatherMode === 'elnino_watch'
          ? 1.04
          : weatherMode === 'heatwave'
            ? 1.08
            : 1.0;

  // Elevated PVC airflow keeps panel cooler, though El Nino heat + dust still warm cells
  const baseAmbientC =
    weatherMode === 'heatwave'
      ? 38
      : weatherMode === 'elnino_watch'
        ? 32
        : weatherMode === 'windy'
          ? 27
          : weatherMode === 'rain_storm'
            ? 19
            : 24;
  const coolingBonus = solar.framePartsDone >= 4 ? -7 : 4;
  const dustHeatPenalty = (solar.dustLevel / 100) * 9;
  const panelTempC = Math.round(baseAmbientC + 16 + coolingBonus + dustHeatPenalty);
  const thermalDerate = Math.max(0.76, 1 - Math.max(0, panelTempC - 25) * 0.004);

  const dustFactor = Math.max(0.32, 1 - (solar.dustLevel / 100) * 0.62);
  const dustPenaltyPct = Math.round((1 - dustFactor) * 100);

  const systemComplete = solar.step >= 4 && solar.wiredStage >= 4;
  const baseV = solar.wiringMode === 'series' ? 24.4 : 12.6;
  const baseA = solar.wiringMode === 'series' ? 4.4 : 8.5;

  const effectiveRatio = systemComplete
    ? alignmentFactor * weatherIrradiance * thermalDerate * dustFactor
    : solar.step === 3 && solar.wiredStage > 0
      ? 0.35 * dustFactor
      : 0;

  const voltageV = Number((baseV * (systemComplete ? Math.max(0.65, alignmentFactor * dustFactor) : solar.wiredStage > 0 ? 0.85 : 0)).toFixed(1));
  const currentA = Number((baseA * effectiveRatio).toFixed(1));
  const maxPotentialWatts = 200;
  const watts = Math.min(220, Math.round(baseV * baseA * effectiveRatio));

  const batteryHealthPct =
    solar.dustLevel > 0
      ? Math.max(38, Math.round(96 - solar.dustLevel * 0.52))
      : systemComplete
        ? Math.min(100, Math.round(78 + sunAlignmentPct * 0.22))
        : 65;

  const needsDustMaintenance = solar.dustLevel > 0;
  const isOptimalCapture = sunAlignmentPct >= 90 && solar.dustLevel === 0;

  // Baseline 85% if Room 4 hasn't been commissioned yet so existing garden flows still operate,
  // 100% when built & optimal, dropping cleanly to 45–60% when dusty!
  const gardenPumpEfficiencyPct = needsDustMaintenance
    ? Math.max(42, Math.round(92 - solar.dustLevel * 0.48))
    : solar.step >= 4 && solar.wiredStage >= 4
      ? Math.max(65, Math.min(100, Math.round(62 + sunAlignmentPct * 0.38)))
      : 85;

  return {
    targetTiltDeg: target.tiltDeg,
    targetAzimuthDeg: target.azimuthDeg,
    sunAlignmentPct,
    angleOffsetDeg,
    voltageV,
    currentA,
    watts,
    maxPotentialWatts,
    panelTempC,
    batteryHealthPct,
    dustPenaltyPct,
    gardenPumpEfficiencyPct,
    isOptimalCapture,
    needsDustMaintenance,
  };
}
