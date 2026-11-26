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
import fallbackFirebaseConfig from '../../firebase-applet-config.json';
import {
  DEFAULT_DOOR3_PROGRESS,
  type CompostContainerType,
  type Door3ProgressState,
  type DripBottleType,
  type MulchMaterialType,
} from '../workshop/compostData';
import {
  createEmptyTier,
  type CropId,
  type TierSaveState,
  type WeatherMode,
} from '../workshop/crops';
import type { BuildStepId } from '../workshop/steps';
import {
  calculateEcoBuilderPoints,
  sanitizeBuiltRacks,
  type BuiltRackRecord,
} from '../workshop/rackMaterials';
import {
  DEFAULT_SOLAR_PROGRESS,
  type SolarProgressState,
  type SolarStepNumber,
  type SolarWiringMode,
} from '../workshop/solarData';
import { syncLeaderboardStudent } from './leaderboardService';

export type ActiveZone = 'kitchen' | 'garden' | 'compost' | 'solar';

export const SCHOOL_GRADES = [
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
] as const;

export type SchoolGrade = (typeof SCHOOL_GRADES)[number];

export const SUPPORTER_ROLES = [
  { id: 'parent', label: 'Parent / Guardian' },
  { id: 'sponsor', label: 'Community Sponsor' },
  { id: 'teacher', label: 'Teacher / Educator' },
  { id: 'family', label: 'Friends & Family' },
] as const;

export type SupporterRole = (typeof SUPPORTER_ROLES)[number]['id'];

export interface StudentLoginMetadata {
  schoolName: string;
  grade: SchoolGrade;
  teacherName?: string;
}

export interface ParentProfile {
  parentKey: string;
  role: SupporterRole;
  pseudonym: string;
  schoolName: string;
  schoolKey: string;
  grades: SchoolGrade[];
  walletBalanceZar?: number;
}

export interface ParentLoginPayload {
  role?: SupporterRole;
  pseudonym: string;
  passcode: string;
  schoolName: string;
  grades: SchoolGrade[];
}

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
  windbreakInstalled: boolean;
  stormBraceInstalled: boolean;
  weatherMode: WeatherMode;
  litresSaved: number;
  foodServings: number;
  door3: Door3ProgressState;
  compostYieldsSinceRefresh: number;
  compostCycleCount: number;
  bestCompetitionMs?: number | null;
  builtRacks: BuiltRackRecord[];
  ecoBuilderPoints: number;
  solar: SolarProgressState;
  role?: 'student';
  schoolName?: string;
  schoolKey?: string;
  grade?: SchoolGrade;
  teacherName?: string;
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

const envMeta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const firebaseConfig = {
  apiKey: envMeta.VITE_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
  authDomain: envMeta.VITE_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
  projectId: envMeta.VITE_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
  storageBucket: envMeta.VITE_FIREBASE_STORAGE_BUCKET || fallbackFirebaseConfig.storageBucket,
  messagingSenderId:
    envMeta.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackFirebaseConfig.messagingSenderId,
  appId: envMeta.VITE_FIREBASE_APP_ID || fallbackFirebaseConfig.appId,
  firestoreDatabaseId:
    envMeta.VITE_FIREBASE_DATABASE_ID || fallbackFirebaseConfig.firestoreDatabaseId,
};

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

async function sha256Material(material: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(material);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return fallbackSha256Hex(material);
}

export async function deriveFarmerKey(farmerName: string, passcode: string): Promise<string> {
  const normalizedName = farmerName.trim().toLowerCase();
  return sha256Material(`gamex-elnino-farmer:${normalizedName}\0${passcode}`);
}

export async function deriveParentKey(pseudonym: string, passcode: string): Promise<string> {
  const normalizedName = pseudonym.trim().toLowerCase();
  return sha256Material(`gamex-elnino-parent:${normalizedName}\0${passcode}`);
}

export async function deriveAdminKey(adminName: string, passcode: string): Promise<string> {
  const normalizedName = adminName.trim().toLowerCase();
  return sha256Material(`gamex-elnino-admin:${normalizedName}\0${passcode}`);
}

export function normalizeSchoolKey(schoolName: string): string {
  return schoolName.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100);
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

const VALID_WEATHER_MODES: Set<WeatherMode> = new Set([
  'normal',
  'rain_storm',
  'windy',
  'elnino_watch',
  'heatwave',
]);
const VALID_DRIP_BOTTLES: Set<DripBottleType> = new Set([
  'clear_soda',
  'green_sparkling',
  'clear_water',
]);
const VALID_COMPOST_CONTAINERS: Set<CompostContainerType> = new Set(['bucket', 'crate', 'pallet']);
const VALID_MULCH_MATERIALS: Set<MulchMaterialType> = new Set(['cardboard', 'newspaper']);

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}

function sanitizeDoor3(data: Record<string, unknown>): Door3ProgressState {
  const rawBottle = data.door3DripBottleType;
  const dripBottleType =
    typeof rawBottle === 'string' && VALID_DRIP_BOTTLES.has(rawBottle as DripBottleType)
      ? (rawBottle as DripBottleType)
      : null;

  const rawContainer = data.door3CompostContainer;
  const compostContainer =
    typeof rawContainer === 'string' && VALID_COMPOST_CONTAINERS.has(rawContainer as CompostContainerType)
      ? (rawContainer as CompostContainerType)
      : null;

  const rawMulch = data.door3MulchMaterial;
  const mulchMaterial =
    typeof rawMulch === 'string' && VALID_MULCH_MATERIALS.has(rawMulch as MulchMaterialType)
      ? (rawMulch as MulchMaterialType)
      : null;

  return {
    dripBottleType,
    dripStep: clampInt(data.door3DripStep, 0, 4, 0),
    compostContainer,
    compostStep: clampInt(data.door3CompostStep, 0, 6, 0),
    compostRejectTested: clampInt(data.door3CompostRejectTested, 0, 4, 0),
    mulchMaterial,
    mulchStep: clampInt(data.door3MulchStep, 0, 4, 0),
  };
}

function serializeDoor3(door3: Door3ProgressState) {
  return {
    door3DripBottleType:
      door3.dripBottleType && VALID_DRIP_BOTTLES.has(door3.dripBottleType)
        ? door3.dripBottleType
        : null,
    door3DripStep: clampInt(door3.dripStep, 0, 4, 0),
    door3CompostContainer:
      door3.compostContainer && VALID_COMPOST_CONTAINERS.has(door3.compostContainer)
        ? door3.compostContainer
        : null,
    door3CompostStep: clampInt(door3.compostStep, 0, 6, 0),
    door3CompostRejectTested: clampInt(door3.compostRejectTested, 0, 4, 0),
    door3MulchMaterial:
      door3.mulchMaterial && VALID_MULCH_MATERIALS.has(door3.mulchMaterial)
        ? door3.mulchMaterial
        : null,
    door3MulchStep: clampInt(door3.mulchStep, 0, 4, 0),
  };
}

function sanitizeSolar(data: Record<string, unknown>): SolarProgressState {
  const wiringMode: SolarWiringMode = data.solarWiringMode === 'parallel' ? 'parallel' : 'series';
  return {
    step: clampInt(data.solarStep, 1, 5, 1) as SolarStepNumber,
    framePartsDone: clampInt(data.solarFrameParts, 0, 4, 0),
    panelPartsDone: clampInt(data.solarPanelParts, 0, 3, 0),
    wiringMode,
    wiredStage: clampInt(data.solarWiredStage, 0, 4, 0),
    tiltDeg: clampInt(data.solarTiltDeg, 0, 75, DEFAULT_SOLAR_PROGRESS.tiltDeg),
    azimuthDeg: clampInt(data.solarAzimuthDeg, -90, 90, DEFAULT_SOLAR_PROGRESS.azimuthDeg),
    dustLevel: clampInt(data.solarDustLevel, 0, 100, 0),
    yieldsSinceClean: clampInt(data.yieldsSinceSolarClean, 0, 50, 0),
    cleanCount: clampInt(data.solarCleanCount, 0, 10000, 0),
  };
}

function hasNonDefaultSolar(solar: SolarProgressState): boolean {
  return (
    solar.step !== DEFAULT_SOLAR_PROGRESS.step ||
    solar.framePartsDone !== DEFAULT_SOLAR_PROGRESS.framePartsDone ||
    solar.panelPartsDone !== DEFAULT_SOLAR_PROGRESS.panelPartsDone ||
    solar.wiringMode !== DEFAULT_SOLAR_PROGRESS.wiringMode ||
    solar.wiredStage !== DEFAULT_SOLAR_PROGRESS.wiredStage ||
    solar.tiltDeg !== DEFAULT_SOLAR_PROGRESS.tiltDeg ||
    solar.azimuthDeg !== DEFAULT_SOLAR_PROGRESS.azimuthDeg ||
    solar.dustLevel !== DEFAULT_SOLAR_PROGRESS.dustLevel ||
    solar.yieldsSinceClean !== DEFAULT_SOLAR_PROGRESS.yieldsSinceClean ||
    solar.cleanCount !== DEFAULT_SOLAR_PROGRESS.cleanCount
  );
}

function serializeSolar(solar: SolarProgressState) {
  return {
    solarStep: clampInt(solar.step, 1, 5, 1),
    solarFrameParts: clampInt(solar.framePartsDone, 0, 4, 0),
    solarPanelParts: clampInt(solar.panelPartsDone, 0, 3, 0),
    solarWiringMode: solar.wiringMode === 'parallel' ? 'parallel' : 'series',
    solarWiredStage: clampInt(solar.wiredStage, 0, 4, 0),
    solarTiltDeg: clampInt(solar.tiltDeg, 0, 75, DEFAULT_SOLAR_PROGRESS.tiltDeg),
    solarAzimuthDeg: clampInt(solar.azimuthDeg, -90, 90, DEFAULT_SOLAR_PROGRESS.azimuthDeg),
    solarDustLevel: clampInt(solar.dustLevel, 0, 100, 0),
    yieldsSinceSolarClean: clampInt(solar.yieldsSinceClean, 0, 50, 0),
    solarCleanCount: clampInt(solar.cleanCount, 0, 10000, 0),
  };
}

function sanitizeTiers(rawTiers: unknown, rackSize: number): TierSaveState[] {
  const clampedSize = Math.max(1, Math.min(6, Math.round(rackSize || 2)));
  const arr = Array.isArray(rawTiers) ? rawTiers : [];
  const result: TierSaveState[] = [];
  for (let i = 0; i < clampedSize; i++) {
    const src = arr[i] as Partial<TierSaveState> | undefined;
    result.push({
      tierIndex: i,
      pipeInstalled: Boolean(src?.pipeInstalled),
      cropId: typeof src?.cropId === 'string' ? (src.cropId as CropId) : null,
      plantedAtMs:
        typeof src?.plantedAtMs === 'number' && Number.isFinite(src.plantedAtMs)
          ? Math.round(src.plantedAtMs)
          : null,
      wateredAtMs:
        typeof src?.wateredAtMs === 'number' && Number.isFinite(src.wateredAtMs)
          ? Math.round(src.wateredAtMs)
          : null,
      waterDurationHours:
        typeof src?.waterDurationHours === 'number' &&
        Number.isFinite(src.waterDurationHours) &&
        src.waterDurationHours > 0
          ? src.waterDurationHours
          : 84,
      harvested: Boolean(src?.harvested),
    });
  }
  return result;
}

const VALID_SCHOOL_GRADES: Set<SchoolGrade> = new Set(SCHOOL_GRADES);
const VALID_SUPPORTER_ROLES: Set<SupporterRole> = new Set([
  'parent',
  'sponsor',
  'teacher',
  'family',
]);

async function syncUnifiedUserAccount(params: {
  uid: string;
  name: string;
  role: 'student' | SupporterRole;
  schoolId: string;
  schoolName: string;
  grade: string;
  grades?: SchoolGrade[];
  initialWalletBalanceZar?: number;
  initialAdoptedPets?: unknown[];
}): Promise<{ walletBalanceZar: number }> {
  const path = `users/${params.uid}`;
  const ref = doc(db, 'users', params.uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  const safeName = params.name.trim().slice(0, 40) || 'Farmer';
  const safeSchoolName = params.schoolName.trim().slice(0, 100);
  const safeSchoolId = params.schoolId.trim().slice(0, 100);
  const safeGrade = params.grade.trim().slice(0, 120) || 'Grade 4';

  if (snap.exists()) {
    const existing = snap.data() as Record<string, unknown>;
    const existingWallet =
      typeof existing.walletBalanceZar === 'number' && Number.isFinite(existing.walletBalanceZar)
        ? Math.max(0, existing.walletBalanceZar)
        : 0;
    const resolvedWallet = Math.max(existingWallet, params.initialWalletBalanceZar ?? 0);

    const updatePayload: Record<string, unknown> = {
      name: safeName,
      role: params.role,
      schoolId: safeSchoolId,
      schoolName: safeSchoolName,
      grade: safeGrade,
      updatedAt: serverTimestamp(),
    };
    if (params.grades && params.grades.length > 0) {
      updatePayload.grades = params.grades;
    }
    if (resolvedWallet !== existingWallet) {
      updatePayload.walletBalanceZar = resolvedWallet;
    }
    if (
      Array.isArray(params.initialAdoptedPets) &&
      params.initialAdoptedPets.length > 0 &&
      (!Array.isArray(existing.adoptedPets) || existing.adoptedPets.length === 0)
    ) {
      updatePayload.adoptedPets = params.initialAdoptedPets;
      updatePayload.ownedPetIds = params.initialAdoptedPets
        .map((p) => (p && typeof p === 'object' ? (p as { id?: string }).id : null))
        .filter((id): id is string => typeof id === 'string');
    }

    try {
      await updateDoc(ref, updatePayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
    return { walletBalanceZar: resolvedWallet };
  }

  const walletBalanceZar = Math.max(0, params.initialWalletBalanceZar ?? 0);
  const freshDoc: Record<string, unknown> = {
    uid: params.uid,
    name: safeName,
    role: params.role,
    schoolId: safeSchoolId,
    schoolName: safeSchoolName,
    grade: safeGrade,
    walletBalanceZar,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.grades && params.grades.length > 0) {
    freshDoc.grades = params.grades;
  }
  if (Array.isArray(params.initialAdoptedPets) && params.initialAdoptedPets.length > 0) {
    freshDoc.adoptedPets = params.initialAdoptedPets;
    freshDoc.ownedPetIds = params.initialAdoptedPets
      .map((p) => (p && typeof p === 'object' ? (p as { id?: string }).id : null))
      .filter((id): id is string => typeof id === 'string');
  } else {
    freshDoc.adoptedPets = [];
    freshDoc.ownedPetIds = [];
  }

  try {
    await setDoc(ref, freshDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  return { walletBalanceZar };
}

export async function loginOrCreateFarmer(
  rawName: string,
  passcode: string,
  meta?: StudentLoginMetadata
): Promise<{ profile: FarmerProfile; isReturning: boolean }> {
  const farmerName = rawName.trim().slice(0, 40) || 'Farmer';
  const farmerKey = await deriveFarmerKey(farmerName, passcode);
  activeFarmerKeyForErrors = farmerKey;

  const cleanSchoolName = meta ? meta.schoolName.trim().slice(0, 100) : '';
  const schoolKey = cleanSchoolName ? normalizeSchoolKey(cleanSchoolName) : '';
  const cleanGrade = meta && VALID_SCHOOL_GRADES.has(meta.grade) ? meta.grade : undefined;
  const cleanTeacherName = meta?.teacherName ? meta.teacherName.trim().slice(0, 60) : '';

  const path = `farmers/${farmerKey}`;
  const ref = doc(db, 'farmers', farmerKey);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>;
    const rackSize =
      typeof data.rackSize === 'number' ? Math.max(1, Math.min(6, Math.round(data.rackSize))) : 2;
    const rawStep = String(data.kitchenStep || 'GET_SAW') as BuildStepId;
    const kitchenStep: BuildStepId = VALID_KITCHEN_STEPS.has(rawStep) ? rawStep : 'GET_SAW';
    const activeZone: ActiveZone =
      data.activeZone === 'garden'
        ? 'garden'
        : data.activeZone === 'compost'
          ? 'compost'
          : data.activeZone === 'solar'
            ? 'solar'
            : 'kitchen';
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

    if (cleanSchoolName && cleanGrade) {
      const metadataChanged =
        data.role !== 'student' ||
        data.schoolName !== cleanSchoolName ||
        data.schoolKey !== schoolKey ||
        data.grade !== cleanGrade ||
        (Boolean(cleanTeacherName) && data.teacherName !== cleanTeacherName);
      if (metadataChanged) {
        const studentMetaMerge: Record<string, unknown> = {
          role: 'student',
          schoolName: cleanSchoolName,
          schoolKey,
          grade: cleanGrade,
          updatedAt: serverTimestamp(),
        };
        if (cleanTeacherName) {
          studentMetaMerge.teacherName = cleanTeacherName;
        }
        try {
          await setDoc(ref, studentMetaMerge, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    }

    const resolvedSchoolName =
      cleanSchoolName || (typeof data.schoolName === 'string' ? data.schoolName : undefined);
    const resolvedSchoolKey =
      schoolKey || (typeof data.schoolKey === 'string' ? data.schoolKey : undefined);
    const resolvedGrade =
      cleanGrade ||
      (typeof data.grade === 'string' && VALID_SCHOOL_GRADES.has(data.grade as SchoolGrade)
        ? (data.grade as SchoolGrade)
        : undefined);
    const resolvedTeacher =
      cleanTeacherName || (typeof data.teacherName === 'string' ? data.teacherName : undefined);

    const resolvedFarmerName = String(data.farmerName || farmerName).slice(0, 40);
    const sanitizedTiers = sanitizeTiers(data.tiers, rackSize);
    const sanitizedBuiltRacks = sanitizeBuiltRacks(
      data.builtRacks,
      sanitizedTiers,
      rackSize,
      resolvedFarmerName
    );
    const resolvedEcoPoints = calculateEcoBuilderPoints(
      sanitizedBuiltRacks,
      data.ecoBuilderPoints
    );

    const profile: FarmerProfile = {
      farmerKey,
      farmerName: resolvedFarmerName,
      activeZone,
      kitchenStep,
      rackSize,
      tiers: sanitizedTiers,
      totalHarvestedCount:
        typeof data.totalHarvestedCount === 'number' ? Math.max(0, data.totalHarvestedCount) : 0,
      jojoInstalled: Boolean(data.jojoInstalled),
      jojoLitres,
      jojoCapacity,
      shadeClothInstalled: Boolean(data.shadeClothInstalled),
      windbreakInstalled: Boolean(data.windbreakInstalled),
      stormBraceInstalled: Boolean(data.stormBraceInstalled),
      weatherMode,
      litresSaved: typeof data.litresSaved === 'number' ? Math.max(0, data.litresSaved) : 0,
      foodServings:
        typeof data.foodServings === 'number' ? Math.max(0, Math.round(data.foodServings)) : 0,
      door3: sanitizeDoor3(data),
      compostYieldsSinceRefresh: clampInt(data.compostYieldsSinceRefresh, 0, 50, 0),
      compostCycleCount: clampInt(data.compostCycleCount, 0, 10000, 0),
      bestCompetitionMs:
        typeof data.bestCompetitionMs === 'number' && data.bestCompetitionMs >= 0
          ? Math.min(86400000, Math.round(data.bestCompetitionMs))
          : null,
      builtRacks: sanitizedBuiltRacks,
      ecoBuilderPoints: resolvedEcoPoints,
      solar: sanitizeSolar(data),
      role: 'student',
      ...(resolvedSchoolName ? { schoolName: resolvedSchoolName } : {}),
      ...(resolvedSchoolKey ? { schoolKey: resolvedSchoolKey } : {}),
      ...(resolvedGrade ? { grade: resolvedGrade } : {}),
      ...(resolvedTeacher ? { teacherName: resolvedTeacher } : {}),
    };

    await syncUnifiedUserAccount({
      uid: farmerKey,
      name: profile.farmerName,
      role: 'student',
      schoolId: resolvedSchoolKey ?? 'community',
      schoolName: resolvedSchoolName ?? 'Community School',
      grade: resolvedGrade ?? 'Grade 4',
    });

    void syncLeaderboardStudent(profile).catch((err) => {
      console.error('Failed to sync returning student to leaderboard:', err);
    });

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
    windbreakInstalled: false,
    stormBraceInstalled: false,
    weatherMode: 'normal',
    litresSaved: 0,
    foodServings: 0,
    door3: { ...DEFAULT_DOOR3_PROGRESS },
    compostYieldsSinceRefresh: 0,
    compostCycleCount: 0,
    bestCompetitionMs: null,
    builtRacks: [],
    ecoBuilderPoints: 0,
    solar: { ...DEFAULT_SOLAR_PROGRESS },
    role: 'student',
    ...(cleanSchoolName ? { schoolName: cleanSchoolName, schoolKey } : {}),
    ...(cleanGrade ? { grade: cleanGrade } : {}),
    ...(cleanTeacherName ? { teacherName: cleanTeacherName } : {}),
  };

  try {
    const { door3, solar, ...baseFields } = freshProfile;
    await setDoc(
      ref,
      {
        ...baseFields,
        ...serializeDoor3(door3),
        ...(hasNonDefaultSolar(solar) ? serializeSolar(solar) : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  await syncUnifiedUserAccount({
    uid: farmerKey,
    name: freshProfile.farmerName,
    role: 'student',
    schoolId: schoolKey || 'community',
    schoolName: cleanSchoolName || 'Community School',
    grade: cleanGrade ?? 'Grade 4',
  });

  void syncLeaderboardStudent(freshProfile).catch((err) => {
    console.error('Failed to sync new student to leaderboard:', err);
  });

  return { profile: freshProfile, isReturning: false };
}

export async function loginOrCreateParent(
  payload: ParentLoginPayload
): Promise<{ profile: ParentProfile; isReturning: boolean }> {
  const pseudonym = payload.pseudonym.trim().slice(0, 40) || 'Parent';
  const schoolName = payload.schoolName.trim().slice(0, 100);
  const schoolKey = normalizeSchoolKey(schoolName);
  const cleanRole: SupporterRole =
    payload.role && VALID_SUPPORTER_ROLES.has(payload.role) ? payload.role : 'parent';

  const cleanGrades: SchoolGrade[] = [];
  for (const g of payload.grades) {
    if (VALID_SCHOOL_GRADES.has(g) && !cleanGrades.includes(g)) {
      cleanGrades.push(g);
    }
  }
  if (cleanGrades.length === 0) {
    cleanGrades.push('Grade 4');
  }

  const parentKey = await deriveParentKey(pseudonym, payload.passcode);
  activeFarmerKeyForErrors = parentKey;

  const path = `parents/${parentKey}`;
  const ref = doc(db, 'parents', parentKey);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (snap.exists()) {
    const existingData = snap.data() as Record<string, unknown>;
    const existingWallet =
      typeof existingData.walletBalanceZar === 'number' &&
      Number.isFinite(existingData.walletBalanceZar)
        ? Math.max(0, existingData.walletBalanceZar)
        : 0;
    const existingPets = Array.isArray(existingData.adoptedPets)
      ? (existingData.adoptedPets as unknown[])
      : [];

    try {
      await setDoc(
        ref,
        {
          role: cleanRole,
          pseudonym,
          schoolName,
          schoolKey,
          grades: cleanGrades,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }

    const synced = await syncUnifiedUserAccount({
      uid: parentKey,
      name: pseudonym,
      role: cleanRole,
      schoolId: schoolKey,
      schoolName,
      grade: cleanGrades.join(', '),
      grades: cleanGrades,
      initialWalletBalanceZar: existingWallet,
      initialAdoptedPets: existingPets,
    });

    const profile: ParentProfile = {
      parentKey,
      role: cleanRole,
      pseudonym,
      schoolName,
      schoolKey,
      grades: cleanGrades,
      walletBalanceZar: synced.walletBalanceZar,
    };
    return { profile, isReturning: true };
  }

  const profile: ParentProfile = {
    parentKey,
    role: cleanRole,
    pseudonym,
    schoolName,
    schoolKey,
    grades: cleanGrades,
    walletBalanceZar: 0,
  };

  try {
    await setDoc(
      ref,
      {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  await syncUnifiedUserAccount({
    uid: parentKey,
    name: pseudonym,
    role: cleanRole,
    schoolId: schoolKey,
    schoolName,
    grade: cleanGrades.join(', '),
    grades: cleanGrades,
    initialWalletBalanceZar: 0,
    initialAdoptedPets: [],
  });

  return { profile, isReturning: false };
}

export async function saveFarmerProgress(profile: FarmerProfile): Promise<void> {
  activeFarmerKeyForErrors = profile.farmerKey;
  const path = `farmers/${profile.farmerKey}`;
  const ref = doc(db, 'farmers', profile.farmerKey);

  const rackSize = clampInt(profile.rackSize, 1, 6, 2);
  const cleanTiers = sanitizeTiers(profile.tiers, rackSize);
  const cleanBuiltRacks = sanitizeBuiltRacks(
    profile.builtRacks,
    cleanTiers,
    rackSize,
    profile.farmerName
  );
  const cleanEcoBuilderPoints = calculateEcoBuilderPoints(
    cleanBuiltRacks,
    profile.ecoBuilderPoints
  );
  const jojoCapacity =
    typeof profile.jojoCapacity === 'number' && Number.isFinite(profile.jojoCapacity)
      ? Math.max(20, Math.min(500, Math.round(profile.jojoCapacity * 10) / 10))
      : 60;
  const jojoLitres =
    typeof profile.jojoLitres === 'number' && Number.isFinite(profile.jojoLitres)
      ? Math.max(0, Math.min(jojoCapacity, Math.round(profile.jojoLitres * 10) / 10))
      : 0;
  const litresSaved =
    typeof profile.litresSaved === 'number' && Number.isFinite(profile.litresSaved)
      ? Math.max(0, Math.min(1000000, Math.round(profile.litresSaved * 10) / 10))
      : 0;
  const activeZone: ActiveZone =
    profile.activeZone === 'garden' ||
    profile.activeZone === 'compost' ||
    profile.activeZone === 'solar'
      ? profile.activeZone
      : 'kitchen';
  const kitchenStep: BuildStepId = VALID_KITCHEN_STEPS.has(profile.kitchenStep)
    ? profile.kitchenStep
    : 'GET_SAW';

  try {
    await updateDoc(ref, {
      farmerName: profile.farmerName.trim().slice(0, 40) || 'Farmer',
      activeZone,
      kitchenStep,
      rackSize,
      tiers: cleanTiers,
      builtRacks: cleanBuiltRacks,
      ecoBuilderPoints: cleanEcoBuilderPoints,
      totalHarvestedCount: clampInt(profile.totalHarvestedCount, 0, 100000, 0),
      jojoInstalled: Boolean(profile.jojoInstalled),
      jojoLitres,
      jojoCapacity,
      shadeClothInstalled: Boolean(profile.shadeClothInstalled),
      windbreakInstalled: Boolean(profile.windbreakInstalled),
      stormBraceInstalled: Boolean(profile.stormBraceInstalled),
      weatherMode: VALID_WEATHER_MODES.has(profile.weatherMode) ? profile.weatherMode : 'normal',
      litresSaved,
      foodServings: clampInt(profile.foodServings, 0, 1000000, 0),
      ...serializeDoor3(profile.door3 ?? DEFAULT_DOOR3_PROGRESS),
      ...(activeZone === 'solar' || hasNonDefaultSolar(profile.solar ?? DEFAULT_SOLAR_PROGRESS)
        ? serializeSolar(profile.solar ?? DEFAULT_SOLAR_PROGRESS)
        : {}),
      compostYieldsSinceRefresh: clampInt(profile.compostYieldsSinceRefresh, 0, 50, 0),
      compostCycleCount: clampInt(profile.compostCycleCount, 0, 10000, 0),
      bestCompetitionMs:
        typeof profile.bestCompetitionMs === 'number' &&
        Number.isFinite(profile.bestCompetitionMs) &&
        profile.bestCompetitionMs >= 0
          ? Math.min(86400000, Math.round(profile.bestCompetitionMs))
          : null,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  void syncLeaderboardStudent(profile).catch((err) => {
    console.error('Failed to sync student progress to leaderboard:', err);
  });
}

export function resizeTierArray(existing: TierSaveState[], nextSize: number): TierSaveState[] {
  const clamped = Math.max(1, Math.min(6, Math.round(nextSize)));
  const next: TierSaveState[] = [];
  for (let i = 0; i < clamped; i++) {
    next.push(existing[i] ? { ...existing[i], tierIndex: i } : createEmptyTier(i));
  }
  return next;
}
