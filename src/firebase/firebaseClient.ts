import { initializeApp } from 'firebase/app';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  createEmptyTier,
  type CropId,
  type TierSaveState,
  type WeatherMode,
} from '../workshop/crops';
import type { BuildStepId } from '../workshop/steps';

export type ActiveZone = 'kitchen' | 'garden';

export interface FarmerProfile {
  farmerKey: string;
  farmerName: string;
  activeZone: ActiveZone;
  kitchenStep: BuildStepId;
  rackSize: number;
  tiers: TierSaveState[];
  totalHarvestedCount: number;
  jojoInstalled: boolean;
  jojoLitres: number;
  jojoCapacity: number;
  shadeClothInstalled: boolean;
  weatherMode: WeatherMode;
  litresSaved: number;
  foodServings: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  };
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let activeFarmerKeyForErrors: string | null = null;

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: activeFarmerKeyForErrors,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

function fallbackSha256Hex(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  let h3 = 0x85ebca6b;
  let h4 = 0xc2b2ae35;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
    h3 = Math.imul(h3 ^ (c * 31), 0xc2b2ae35) >>> 0;
    h4 = Math.imul(h4 ^ (c ^ 0x5a), 0x27d4eb2f) >>> 0;
  }
  const seg = (n: number) => n.toString(16).padStart(8, '0');
  return (seg(h1) + seg(h2) + seg(h3) + seg(h4)).repeat(2);
}

export async function deriveFarmerKey(farmerName: string, passcode: string): Promise<string> {
  const normalizedName = farmerName.trim().toLowerCase();
  const material = `gamex-elnino-farmer:${normalizedName}\0${passcode}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(material);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return fallbackSha256Hex(material);
}

const VALID_KITCHEN_STEPS: Set<BuildStepId> = new Set([
  'GET_SAW',
  'CUT_AND_ASSEMBLE_PVC',
  'GET_DRILL',
  'DRILL_PORTS',
  'GET_WICKS',
  'THREAD_WICKS_AND_PLANT',
  'FILL_AT_SINK',
  'POUR_AND_GROW',
  'COMPLETE',
]);

const VALID_WEATHER_MODES: Set<WeatherMode> = new Set(['normal', 'elnino_watch', 'heatwave']);

function sanitizeTiers(rawTiers: unknown, rackSize: number): TierSaveState[] {
  const clampedSize = Math.max(2, Math.min(6, Math.round(rackSize || 2)));
  const arr = Array.isArray(rawTiers) ? rawTiers : [];
  const result: TierSaveState[] = [];
  for (let i = 0; i < clampedSize; i++) {
    const src = arr[i] as Partial<TierSaveState> | undefined;
    result.push({
      tierIndex: i,
      pipeInstalled: Boolean(src?.pipeInstalled),
      cropId: typeof src?.cropId === 'string' ? (src.cropId as CropId) : null,
      plantedAtMs: typeof src?.plantedAtMs === 'number' ? src.plantedAtMs : null,
      wateredAtMs: typeof src?.wateredAtMs === 'number' ? src.wateredAtMs : null,
      waterDurationHours:
        typeof src?.waterDurationHours === 'number' && src.waterDurationHours > 0
          ? src.waterDurationHours
          : 84,
      harvested: Boolean(src?.harvested),
    });
  }
  return result;
}

export async function loginOrCreateFarmer(
  rawName: string,
  passcode: string
): Promise<{ profile: FarmerProfile; isReturning: boolean }> {
  const farmerName = rawName.trim().slice(0, 40) || 'Farmer';
  const farmerKey = await deriveFarmerKey(farmerName, passcode);
  activeFarmerKeyForErrors = farmerKey;

  const path = `farmers/${farmerKey}`;
  const ref = doc(db, 'farmers', farmerKey);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (snap.exists()) {
    const data = snap.data();
    const rackSize =
      typeof data.rackSize === 'number' ? Math.max(2, Math.min(6, Math.round(data.rackSize))) : 2;
    const rawStep = String(data.kitchenStep || 'GET_SAW') as BuildStepId;
    const kitchenStep: BuildStepId = VALID_KITCHEN_STEPS.has(rawStep) ? rawStep : 'GET_SAW';
    const activeZone: ActiveZone = data.activeZone === 'garden' ? 'garden' : 'kitchen';
    const rawWeather = String(data.weatherMode || 'normal') as WeatherMode;
    const weatherMode: WeatherMode = VALID_WEATHER_MODES.has(rawWeather) ? rawWeather : 'normal';
    const jojoCapacity =
      typeof data.jojoCapacity === 'number'
        ? Math.max(20, Math.min(500, data.jojoCapacity))
        : 60;
    const jojoLitres =
      typeof data.jojoLitres === 'number'
        ? Math.max(0, Math.min(jojoCapacity, data.jojoLitres))
        : 18;

    const profile: FarmerProfile = {
      farmerKey,
      farmerName: String(data.farmerName || farmerName).slice(0, 40),
      activeZone,
      kitchenStep,
      rackSize,
      tiers: sanitizeTiers(data.tiers, rackSize),
      totalHarvestedCount:
        typeof data.totalHarvestedCount === 'number' ? Math.max(0, data.totalHarvestedCount) : 0,
      jojoInstalled: Boolean(data.jojoInstalled),
      jojoLitres,
      jojoCapacity,
      shadeClothInstalled: Boolean(data.shadeClothInstalled),
      weatherMode,
      litresSaved: typeof data.litresSaved === 'number' ? Math.max(0, data.litresSaved) : 0,
      foodServings:
        typeof data.foodServings === 'number' ? Math.max(0, Math.round(data.foodServings)) : 0,
    };
    return { profile, isReturning: true };
  }

  const initialRackSize = 2;
  const freshProfile: FarmerProfile = {
    farmerKey,
    farmerName,
    activeZone: 'kitchen',
    kitchenStep: 'GET_SAW',
    rackSize: initialRackSize,
    tiers: sanitizeTiers([], initialRackSize),
    totalHarvestedCount: 0,
    jojoInstalled: false,
    jojoLitres: 18,
    jojoCapacity: 60,
    shadeClothInstalled: false,
    weatherMode: 'normal',
    litresSaved: 0,
    foodServings: 0,
  };

  try {
    await setDoc(ref, {
      ...freshProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  return { profile: freshProfile, isReturning: false };
}

export async function saveFarmerProgress(profile: FarmerProfile): Promise<void> {
  activeFarmerKeyForErrors = profile.farmerKey;
  const path = `farmers/${profile.farmerKey}`;
  const ref = doc(db, 'farmers', profile.farmerKey);

  const rackSize = Math.max(2, Math.min(6, Math.round(profile.rackSize)));
  const cleanTiers = sanitizeTiers(profile.tiers, rackSize);
  const jojoCapacity = Math.max(20, Math.min(500, profile.jojoCapacity || 60));

  try {
    await updateDoc(ref, {
      farmerName: profile.farmerName.trim().slice(0, 40) || 'Farmer',
      activeZone: profile.activeZone,
      kitchenStep: profile.kitchenStep,
      rackSize,
      tiers: cleanTiers,
      totalHarvestedCount: Math.max(0, Math.round(profile.totalHarvestedCount)),
      jojoInstalled: Boolean(profile.jojoInstalled),
      jojoLitres: Math.max(0, Math.min(jojoCapacity, Math.round(profile.jojoLitres * 10) / 10)),
      jojoCapacity,
      shadeClothInstalled: Boolean(profile.shadeClothInstalled),
      weatherMode: VALID_WEATHER_MODES.has(profile.weatherMode) ? profile.weatherMode : 'normal',
      litresSaved: Math.max(0, Math.min(1000000, Math.round(profile.litresSaved * 10) / 10)),
      foodServings: Math.max(0, Math.min(1000000, Math.round(profile.foodServings))),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function resizeTierArray(existing: TierSaveState[], nextSize: number): TierSaveState[] {
  const clamped = Math.max(2, Math.min(6, Math.round(nextSize)));
  const next: TierSaveState[] = [];
  for (let i = 0; i < clamped; i++) {
    next.push(existing[i] ? { ...existing[i], tierIndex: i } : createEmptyTier(i));
  }
  return next;
}
