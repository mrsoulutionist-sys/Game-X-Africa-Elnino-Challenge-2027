import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getCropById, type CropId } from '../workshop/crops';
import {
  computeEffectivePetStats,
  sanitizeAdoptedPets,
  type AdoptedPet,
  type PetId,
} from '../components/petData';
import {
  db,
  handleFirestoreError,
  OperationType,
  SCHOOL_GRADES,
  type FarmerProfile,
  type SupporterRole,
} from './firebaseClient';

export const MIN_KARRI_TOPUP_ZAR = 250;
export const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export type StoreCategory = 'harvest_produce' | 'mulch_compost' | 'pet_care';
export type StoreSourceType = 'student_harvest' | 'care_bundle';
export type StoreListingStatus = 'active' | 'sold_out';
export type PetCareStat = 'hunger' | 'water' | 'energy' | 'play';

export interface PetCareEffect {
  stat: PetCareStat;
  boostAmount: number;
  supplyDays?: number;
}

export interface UserAccount {
  uid: string;
  name: string;
  role: 'student' | SupporterRole;
  schoolId: string;
  schoolName: string;
  grade: string;
  grades?: string[];
  walletBalanceZar: number;
  ownedPetIds: PetId[];
  adoptedPets: AdoptedPet[];
}

export interface StoreListing {
  listingId: string;
  title: string;
  category: StoreCategory;
  sourceType: StoreSourceType;
  quantityAvailable: number;
  priceZar: number;
  schoolId: string;
  schoolName: string;
  grade: string;
  studentUid?: string;
  studentName?: string;
  petCareEffect: PetCareEffect;
  lastHarvestedAtMs: number | null;
  updatedAtMs: number;
  status: StoreListingStatus;
}

export interface StudentGrow {
  growId: string;
  studentUid: string;
  studentName: string;
  schoolId: string;
  schoolName: string;
  grade: string;
  cropId: string;
  itemTitle: string;
  category: 'harvest_produce' | 'mulch_compost';
  plantedAtMs: number;
  harvestReadyAtMs: number;
  harvested: boolean;
  expectedYieldQty: number;
}

export interface HarvestBatch {
  batchId: string;
  studentUid: string;
  studentName: string;
  schoolId: string;
  schoolName: string;
  grade: string;
  itemTitle: string;
  category: 'harvest_produce' | 'mulch_compost';
  quantity: number;
  harvestedAtMs: number;
}

export interface StoreOrderItem {
  listingId: string;
  title: string;
  quantity: number;
  priceZar: number;
  sourceSchoolId: string;
  sourceGrade: string;
  studentName?: string;
  petCareEffect: PetCareEffect;
}

export interface StoreOrder {
  orderId: string;
  buyerUid: string;
  buyerName: string;
  items: StoreOrderItem[];
  totalPaidZar: number;
  walletBeforeZar: number;
  walletAfterZar: number;
  targetPetId: string;
  targetPetName: string;
  paymentChannel: 'Karri Credit Wallet';
  createdAtMs: number;
}

export interface Student14DayScore {
  studentUid: string;
  studentName: string;
  schoolId: string;
  schoolName: string;
  grade: string;
  totalUnits14d: number;
  batchCount14d: number;
  lastHarvestedAtMs: number;
  topItems: string[];
}

export interface BasketLineItem {
  listing: StoreListing;
  quantity: number;
}

export function normalizeSchoolId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100);
}

export function sanitizeDocId(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 110);
  if (cleaned.length >= 2) return cleaned;
  return `id_${cleaned || 'item'}`;
}

function timestampToMs(val: unknown): number | null {
  if (!val) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'object' && val !== null && 'toMillis' in val) {
    const fn = (val as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn.call(val);
  }
  return null;
}

export function getPetCareEffectForItem(
  itemTitle: string,
  category: 'harvest_produce' | 'mulch_compost'
): PetCareEffect {
  if (category === 'mulch_compost') {
    return { stat: 'energy', boostAmount: 28 };
  }
  const lower = itemTitle.toLowerCase();
  if (
    lower.includes('basil') ||
    lower.includes('mint') ||
    lower.includes('parsley') ||
    lower.includes('coriander') ||
    lower.includes('dhania') ||
    lower.includes('herb') ||
    lower.includes('chive') ||
    lower.includes('rosemary')
  ) {
    return { stat: 'play', boostAmount: 26 };
  }
  if (
    lower.includes('lettuce') ||
    lower.includes('butterhead') ||
    lower.includes('cucumber') ||
    lower.includes('celery')
  ) {
    return { stat: 'water', boostAmount: 32, supplyDays: 2 };
  }
  return { stat: 'hunger', boostAmount: 34, supplyDays: 3 };
}

function getHarvestUnitPriceZar(
  itemTitle: string,
  category: 'harvest_produce' | 'mulch_compost'
): number {
  if (category === 'mulch_compost') return 15;
  const lower = itemTitle.toLowerCase();
  if (lower.includes('tomato') || lower.includes('sweet potato') || lower.includes('cabbage')) {
    return 15;
  }
  return 12;
}

interface StarterBundleDef {
  listingId: string;
  title: string;
  category: 'pet_care';
  initialQty: number;
  priceZar: number;
  petCareEffect: PetCareEffect;
}

const STARTER_CARE_BUNDLES: StarterBundleDef[] = [
  {
    listingId: 'care_rabbit_food_3d',
    title: '3-Day Herbivore Greens Supply',
    category: 'pet_care',
    initialQty: 24,
    priceZar: 5,
    petCareEffect: { stat: 'hunger', boostAmount: 36, supplyDays: 3 },
  },
  {
    listingId: 'care_jojo_water_bowl',
    title: 'JoJo Fresh Water Refill (3 Days)',
    category: 'pet_care',
    initialQty: 24,
    priceZar: 5,
    petCareEffect: { stat: 'water', boostAmount: 36, supplyDays: 3 },
  },
  {
    listingId: 'care_fynbos_play_pack',
    title: 'Fynbos Foraging & Play Pack',
    category: 'pet_care',
    initialQty: 18,
    priceZar: 10,
    petCareEffect: { stat: 'play', boostAmount: 32 },
  },
  {
    listingId: 'care_hay_bedding_pack',
    title: 'Warm Karoo Hay & Rest Pack',
    category: 'pet_care',
    initialQty: 16,
    priceZar: 15,
    petCareEffect: { stat: 'energy', boostAmount: 34 },
  },
];

let careBundlesInitialized = false;

/**
 * Seeds only the care_bundle listings if they do not yet exist in Firestore.
 * Does NOT overwrite live stock quantities or create fake student harvests.
 */
export async function ensureStarterCareListings(): Promise<void> {
  if (careBundlesInitialized) return;
  careBundlesInitialized = true;

  for (const bundle of STARTER_CARE_BUNDLES) {
    const ref = doc(db, 'store_listings', bundle.listingId);
    const path = `store_listings/${bundle.listingId}`;
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          listingId: bundle.listingId,
          title: bundle.title,
          category: bundle.category,
          sourceType: 'care_bundle',
          quantityAvailable: bundle.initialQty,
          priceZar: bundle.priceZar,
          schoolId: 'all-sanctuary',
          schoolName: 'Game X Sanctuary Pantry',
          grade: 'All Grades',
          petCareEffect: bundle.petCareEffect,
          lastHarvestedAt: null,
          updatedAt: serverTimestamp(),
          status: 'active',
        });
      }
    } catch (err) {
      careBundlesInitialized = false;
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }
}

export function subscribeToUserAccount(
  uid: string,
  onData: (account: UserAccount | null) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      const adoptedPets = sanitizeAdoptedPets(d.adoptedPets);
      onData({
        uid: String(d.uid || uid),
        name: String(d.name || 'Supporter'),
        role: (d.role as UserAccount['role']) || 'parent',
        schoolId: String(d.schoolId || ''),
        schoolName: String(d.schoolName || ''),
        grade: String(d.grade || 'Grade 4'),
        grades: Array.isArray(d.grades) ? (d.grades as string[]) : undefined,
        walletBalanceZar:
          typeof d.walletBalanceZar === 'number' && Number.isFinite(d.walletBalanceZar)
            ? Math.max(0, Math.round(d.walletBalanceZar * 100) / 100)
            : 0,
        ownedPetIds: adoptedPets.map((p) => p.id),
        adoptedPets,
      });
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export function subscribeToStoreListings(
  onData: (listings: StoreListing[]) => void
): Unsubscribe {
  const path = 'store_listings';
  const q = query(collection(db, 'store_listings'), orderBy('updatedAt', 'desc'), limit(120));
  return onSnapshot(
    q,
    (snap) => {
      const rows: StoreListing[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        const rawQty =
          typeof d.quantityAvailable === 'number' ? Math.max(0, Math.round(d.quantityAvailable)) : 0;
        const effectRaw = (d.petCareEffect || {}) as Record<string, unknown>;
        const stat =
          effectRaw.stat === 'water' ||
          effectRaw.stat === 'energy' ||
          effectRaw.stat === 'play' ||
          effectRaw.stat === 'hunger'
            ? effectRaw.stat
            : 'hunger';
        const effect: PetCareEffect = {
          stat,
          boostAmount:
            typeof effectRaw.boostAmount === 'number' ? Math.max(1, Math.round(effectRaw.boostAmount)) : 25,
          ...(typeof effectRaw.supplyDays === 'number' && effectRaw.supplyDays > 0
            ? { supplyDays: Math.round(effectRaw.supplyDays) }
            : {}),
        };
        rows.push({
          listingId: String(d.listingId || docSnap.id),
          title: String(d.title || 'Garden Produce'),
          category:
            d.category === 'mulch_compost' || d.category === 'pet_care'
              ? d.category
              : 'harvest_produce',
          sourceType: d.sourceType === 'care_bundle' ? 'care_bundle' : 'student_harvest',
          quantityAvailable: rawQty,
          priceZar: typeof d.priceZar === 'number' ? Math.max(1, d.priceZar) : 10,
          schoolId: String(d.schoolId || ''),
          schoolName: String(d.schoolName || ''),
          grade: String(d.grade || 'Grade 4'),
          ...(typeof d.studentUid === 'string' ? { studentUid: d.studentUid } : {}),
          ...(typeof d.studentName === 'string' ? { studentName: d.studentName } : {}),
          petCareEffect: effect,
          lastHarvestedAtMs: timestampToMs(d.lastHarvestedAt),
          updatedAtMs: timestampToMs(d.updatedAt) ?? Date.now(),
          status: rawQty <= 0 ? 'sold_out' : 'active',
        });
      });
      rows.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        if (a.sourceType !== b.sourceType) return a.sourceType === 'student_harvest' ? -1 : 1;
        return (b.lastHarvestedAtMs ?? b.updatedAtMs) - (a.lastHarvestedAtMs ?? a.updatedAtMs);
      });
      onData(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeToStudentGrows(onData: (grows: StudentGrow[]) => void): Unsubscribe {
  const path = 'student_grows';
  const q = query(collection(db, 'student_grows'), orderBy('updatedAt', 'desc'), limit(120));
  return onSnapshot(
    q,
    (snap) => {
      const rows: StudentGrow[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        rows.push({
          growId: String(d.growId || docSnap.id),
          studentUid: String(d.studentUid || ''),
          studentName: String(d.studentName || 'Student'),
          schoolId: String(d.schoolId || ''),
          schoolName: String(d.schoolName || ''),
          grade: String(d.grade || 'Grade 4'),
          cropId: String(d.cropId || 'tomatoes'),
          itemTitle: String(d.itemTitle || 'Garden Produce'),
          category: d.category === 'mulch_compost' ? 'mulch_compost' : 'harvest_produce',
          plantedAtMs: typeof d.plantedAtMs === 'number' ? d.plantedAtMs : Date.now(),
          harvestReadyAtMs: typeof d.harvestReadyAtMs === 'number' ? d.harvestReadyAtMs : Date.now(),
          harvested: Boolean(d.harvested),
          expectedYieldQty:
            typeof d.expectedYieldQty === 'number' ? Math.max(1, Math.round(d.expectedYieldQty)) : 2,
        });
      });
      rows.sort((a, b) => a.harvestReadyAtMs - b.harvestReadyAtMs);
      onData(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeToHarvestBatches(
  onData: (batches: HarvestBatch[]) => void
): Unsubscribe {
  const path = 'harvest_batches';
  const q = query(collection(db, 'harvest_batches'), orderBy('harvestedAtMs', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      const rows: HarvestBatch[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        rows.push({
          batchId: String(d.batchId || docSnap.id),
          studentUid: String(d.studentUid || ''),
          studentName: String(d.studentName || 'Student'),
          schoolId: String(d.schoolId || ''),
          schoolName: String(d.schoolName || ''),
          grade: String(d.grade || 'Grade 4'),
          itemTitle: String(d.itemTitle || 'Garden Harvest'),
          category: d.category === 'mulch_compost' ? 'mulch_compost' : 'harvest_produce',
          quantity: typeof d.quantity === 'number' ? Math.max(1, Math.round(d.quantity)) : 1,
          harvestedAtMs: typeof d.harvestedAtMs === 'number' ? d.harvestedAtMs : Date.now(),
        });
      });
      onData(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeToUserOrders(
  buyerUid: string,
  onData: (orders: StoreOrder[]) => void
): Unsubscribe {
  const path = 'store_orders';
  const q = query(
    collection(db, 'store_orders'),
    where('buyerUid', '==', buyerUid),
    limit(25)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: StoreOrder[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        rows.push({
          orderId: String(d.orderId || docSnap.id),
          buyerUid: String(d.buyerUid || buyerUid),
          buyerName: String(d.buyerName || 'Supporter'),
          items: Array.isArray(d.items) ? (d.items as StoreOrderItem[]) : [],
          totalPaidZar: typeof d.totalPaidZar === 'number' ? d.totalPaidZar : 0,
          walletBeforeZar: typeof d.walletBeforeZar === 'number' ? d.walletBeforeZar : 0,
          walletAfterZar: typeof d.walletAfterZar === 'number' ? d.walletAfterZar : 0,
          targetPetId: String(d.targetPetId || ''),
          targetPetName: String(d.targetPetName || 'Sanctuary'),
          paymentChannel: 'Karri Credit Wallet',
          createdAtMs: timestampToMs(d.createdAt) ?? Date.now(),
        });
      });
      rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

/**
 * Rolling 14-day harvest scores computed directly from harvest_batches.
 */
export function compute14DayStudentScores(
  batches: HarvestBatch[],
  nowMs = Date.now()
): Student14DayScore[] {
  const cutoffMs = nowMs - FOURTEEN_DAYS_MS;
  const byStudent = new Map<
    string,
    {
      studentUid: string;
      studentName: string;
      schoolId: string;
      schoolName: string;
      grade: string;
      totalUnits14d: number;
      batchCount14d: number;
      lastHarvestedAtMs: number;
      itemCounts: Map<string, number>;
    }
  >();

  for (const batch of batches) {
    if (batch.harvestedAtMs < cutoffMs) continue;
    const existing = byStudent.get(batch.studentUid);
    if (!existing) {
      const itemCounts = new Map<string, number>();
      itemCounts.set(batch.itemTitle, batch.quantity);
      byStudent.set(batch.studentUid, {
        studentUid: batch.studentUid,
        studentName: batch.studentName,
        schoolId: batch.schoolId,
        schoolName: batch.schoolName,
        grade: batch.grade,
        totalUnits14d: batch.quantity,
        batchCount14d: 1,
        lastHarvestedAtMs: batch.harvestedAtMs,
        itemCounts,
      });
    } else {
      existing.totalUnits14d += batch.quantity;
      existing.batchCount14d += 1;
      existing.lastHarvestedAtMs = Math.max(existing.lastHarvestedAtMs, batch.harvestedAtMs);
      existing.itemCounts.set(
        batch.itemTitle,
        (existing.itemCounts.get(batch.itemTitle) ?? 0) + batch.quantity
      );
    }
  }

  return Array.from(byStudent.values())
    .map((entry) => ({
      studentUid: entry.studentUid,
      studentName: entry.studentName,
      schoolId: entry.schoolId,
      schoolName: entry.schoolName,
      grade: entry.grade,
      totalUnits14d: entry.totalUnits14d,
      batchCount14d: entry.batchCount14d,
      lastHarvestedAtMs: entry.lastHarvestedAtMs,
      topItems: Array.from(entry.itemCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name),
    }))
    .sort((a, b) => b.totalUnits14d - a.totalUnits14d);
}

/**
 * Syncs the student's currently growing rack crops and in-progress Door 3 stations
 * to `student_grows/{growId}` so parents can see what is "On Its Way".
 */
export async function syncStudentActiveGrows(profile: FarmerProfile): Promise<void> {
  const schoolId = normalizeSchoolId(profile.schoolKey || profile.schoolName || 'community') || 'community';
  const schoolName = (profile.schoolName || 'Community School').trim().slice(0, 100);
  const grade = (profile.grade || 'Grade 4').trim().slice(0, 40);
  const studentName = profile.farmerName.trim().slice(0, 40) || 'Farmer';
  const uidPrefix = profile.farmerKey.slice(0, 24);
  const now = Date.now();

  for (const tier of profile.tiers) {
    const growId = sanitizeDocId(`${uidPrefix}_tier_${tier.tierIndex}`);
    const ref = doc(db, 'student_grows', growId);

    if (tier.pipeInstalled && tier.cropId && tier.plantedAtMs) {
      const crop = getCropById(tier.cropId as CropId);
      if (!crop) continue;
      const plantedAtMs = Math.max(0, Math.round(tier.plantedAtMs));
      const harvestReadyAtMs = Math.round(plantedAtMs + crop.maturityHours * 3600000);
      const expectedYieldQty = Math.max(1, Math.min(50, Math.round(crop.servingsPerHarvest)));

      try {
        await setDoc(ref, {
          growId,
          studentUid: profile.farmerKey,
          studentName,
          schoolId,
          schoolName,
          grade,
          cropId: crop.id.slice(0, 40),
          itemTitle: crop.name.slice(0, 100),
          category: 'harvest_produce',
          plantedAtMs,
          harvestReadyAtMs,
          harvested: Boolean(tier.harvested),
          expectedYieldQty,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `student_grows/${growId}`);
      }
    } else {
      try {
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data()?.harvested === false) {
          await setDoc(
            ref,
            {
              harvested: true,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `student_grows/${growId}`);
      }
    }
  }

  // Door 3 Compost in-progress indicator
  const compostGrowId = sanitizeDocId(`${uidPrefix}_door3_compost`);
  const compostRef = doc(db, 'student_grows', compostGrowId);
  if (profile.door3.compostStep > 0 && profile.door3.compostStep < 6) {
    const remainingHours = Math.max(1, 6 - profile.door3.compostStep);
    try {
      await setDoc(compostRef, {
        growId: compostGrowId,
        studentUid: profile.farmerKey,
        studentName,
        schoolId,
        schoolName,
        grade,
        cropId: 'compost_batch',
        itemTitle: 'Rich School Compost Batch',
        category: 'mulch_compost',
        plantedAtMs: now,
        harvestReadyAtMs: now + remainingHours * 3600000,
        harvested: false,
        expectedYieldQty: 2,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `student_grows/${compostGrowId}`);
    }
  } else if (profile.door3.compostStep >= 6) {
    try {
      const snap = await getDoc(compostRef);
      if (snap.exists() && snap.data()?.harvested === false) {
        await setDoc(compostRef, { harvested: true, updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `student_grows/${compostGrowId}`);
    }
  }

  // Door 3 Mulch Shield in-progress indicator
  const mulchGrowId = sanitizeDocId(`${uidPrefix}_door3_mulch`);
  const mulchRef = doc(db, 'student_grows', mulchGrowId);
  if (profile.door3.mulchStep > 0 && profile.door3.mulchStep < 4) {
    const remainingHours = Math.max(1, 4 - profile.door3.mulchStep);
    try {
      await setDoc(mulchRef, {
        growId: mulchGrowId,
        studentUid: profile.farmerKey,
        studentName,
        schoolId,
        schoolName,
        grade,
        cropId: 'mulch_shield',
        itemTitle: 'Moisture-Shield Mulch Kit',
        category: 'mulch_compost',
        plantedAtMs: now,
        harvestReadyAtMs: now + remainingHours * 3600000,
        harvested: false,
        expectedYieldQty: 2,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `student_grows/${mulchGrowId}`);
    }
  } else if (profile.door3.mulchStep >= 4) {
    try {
      const snap = await getDoc(mulchRef);
      if (snap.exists() && snap.data()?.harvested === false) {
        await setDoc(mulchRef, { harvested: true, updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `student_grows/${mulchGrowId}`);
    }
  }
}

export function buildHarvestListingId(
  schoolId: string,
  grade: string,
  cleanTitle: string
): string {
  const schoolSlug = sanitizeDocId(normalizeSchoolId(schoolId) || 'community').slice(0, 42);
  const gradeSlug = sanitizeDocId(grade || 'grade_4').slice(0, 14);
  const titleSlug = sanitizeDocId(cleanTitle || 'garden_harvest').slice(0, 44);
  return sanitizeDocId(`harvest_${schoolSlug}_${gradeSlug}_${titleSlug}`);
}

/**
 * Atomically records a student harvest batch and increments the matching store listing stock.
 */
export async function recordStudentHarvest(params: {
  profile: FarmerProfile;
  itemTitle: string;
  category: 'harvest_produce' | 'mulch_compost';
  quantity: number;
  growId?: string;
}): Promise<{ listingId: string; batchId: string; quantity: number }> {
  const { profile, itemTitle, category, growId } = params;
  const quantity = Math.max(1, Math.min(50, Math.round(params.quantity)));
  const schoolId = normalizeSchoolId(profile.schoolKey || profile.schoolName || 'community') || 'community';
  const schoolName = (profile.schoolName || 'Community School').trim().slice(0, 100);
  const grade = (profile.grade || 'Grade 4').trim().slice(0, 40);
  const studentName = profile.farmerName.trim().slice(0, 40) || 'Farmer';
  const rawCleanTitle = itemTitle.trim().slice(0, 100);
  const cleanTitle = rawCleanTitle.length >= 2 ? rawCleanTitle : 'Garden Harvest';

  const listingId = buildHarvestListingId(schoolId, grade, cleanTitle);
  const batchId = sanitizeDocId(
    `batch_${profile.farmerKey.slice(0, 12)}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  );

  const listingRef = doc(db, 'store_listings', listingId);
  const batchRef = doc(db, 'harvest_batches', batchId);
  const growRef = growId ? doc(db, 'student_grows', sanitizeDocId(growId)) : null;
  const lbRef = doc(db, 'leaderboard_students', profile.farmerKey);

  const safeSchoolName = schoolName || 'Community School';
  const safeSchoolId = schoolId || 'community';
  const safeGrade = (SCHOOL_GRADES as readonly string[]).includes(grade) ? grade : 'Grade 4';

  const petCareEffect = getPetCareEffectForItem(cleanTitle, category);
  const priceZar = getHarvestUnitPriceZar(cleanTitle, category);
  const nowMs = Date.now();

  try {
    await runTransaction(db, async (tx) => {
      const listingSnap = await tx.get(listingRef);
      const growSnap = growRef ? await tx.get(growRef) : null;
      const lbSnap = await tx.get(lbRef);

      if (listingSnap.exists()) {
        const existingQty =
          typeof listingSnap.data().quantityAvailable === 'number'
            ? Math.max(0, Math.round(listingSnap.data().quantityAvailable))
            : 0;
        const nextQty = Math.min(10000, existingQty + quantity);
        tx.update(listingRef, {
          title: cleanTitle,
          category,
          sourceType: 'student_harvest',
          quantityAvailable: nextQty,
          priceZar,
          schoolId: safeSchoolId,
          schoolName: safeSchoolName,
          grade: safeGrade,
          studentUid: profile.farmerKey,
          studentName,
          petCareEffect,
          lastHarvestedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: 'active',
        });
      } else {
        tx.set(listingRef, {
          listingId,
          title: cleanTitle,
          category,
          sourceType: 'student_harvest',
          quantityAvailable: quantity,
          priceZar,
          schoolId: safeSchoolId,
          schoolName: safeSchoolName,
          grade: safeGrade,
          studentUid: profile.farmerKey,
          studentName,
          petCareEffect,
          lastHarvestedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: 'active',
        });
      }

      tx.set(batchRef, {
        batchId,
        studentUid: profile.farmerKey,
        studentName,
        schoolId: safeSchoolId,
        schoolName: safeSchoolName,
        grade: safeGrade,
        itemTitle: cleanTitle,
        category,
        quantity,
        harvestedAt: serverTimestamp(),
        harvestedAtMs: nowMs,
      });

      if (growRef && growSnap?.exists()) {
        tx.update(growRef, {
          harvested: true,
          updatedAt: serverTimestamp(),
        });
      }

      const prevLbUnits =
        lbSnap.exists() && typeof lbSnap.data().totalHarvestUnits === 'number'
          ? Math.max(0, Math.round(lbSnap.data().totalHarvestUnits))
          : 0;
      const prevLbCount =
        lbSnap.exists() && typeof lbSnap.data().totalHarvestedCount === 'number'
          ? Math.max(0, Math.round(lbSnap.data().totalHarvestedCount))
          : 0;
      const nextLbUnits = Math.min(
        100000,
        Math.max(prevLbUnits + quantity, Math.round(profile.totalHarvestedCount))
      );
      const nextLbCount = Math.min(
        100000,
        Math.max(prevLbCount, Math.round(profile.totalHarvestedCount))
      );
      const safeServings = Math.max(0, Math.min(1000000, Math.round(profile.foodServings)));
      const safeLitres = Math.max(
        0,
        Math.min(1000000, Math.round(profile.litresSaved * 10) / 10)
      );

      if (lbSnap.exists()) {
        tx.update(lbRef, {
          studentName,
          schoolId: safeSchoolId,
          schoolName: safeSchoolName,
          grade: safeGrade,
          totalHarvestUnits: nextLbUnits,
          totalHarvestedCount: nextLbCount,
          foodServings: safeServings,
          litresSaved: safeLitres,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(lbRef, {
          studentUid: profile.farmerKey,
          studentName,
          schoolId: safeSchoolId,
          schoolName: safeSchoolName,
          grade: safeGrade,
          totalHarvestUnits: nextLbUnits,
          totalHarvestedCount: nextLbCount,
          foodServings: safeServings,
          litresSaved: safeLitres,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `store_listings/${listingId}`);
  }

  return { listingId, batchId, quantity };
}

/**
 * Loads Karri Credit Wallet balance with an enforced R250 minimum top-up.
 */
export async function loadWalletCredit(params: {
  uid: string;
  userName: string;
  role: SupporterRole;
  schoolId: string;
  schoolName: string;
  grades: string[];
  amountZar: number;
}): Promise<{ nextBalanceZar: number; topupId: string }> {
  const cleanAmount = Math.round(params.amountZar * 100) / 100;
  if (!Number.isFinite(cleanAmount) || cleanAmount < MIN_KARRI_TOPUP_ZAR) {
    throw new Error(`Minimum Karri wallet top-up is R${MIN_KARRI_TOPUP_ZAR}.`);
  }

  const userRef = doc(db, 'users', params.uid);
  const parentRef = doc(db, 'parents', params.uid);
  const topupId = sanitizeDocId(
    `topup_${params.uid.slice(0, 12)}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  );
  const topupRef = doc(db, 'wallet_topups', topupId);

  let nextBalanceZar = cleanAmount;

  try {
    await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      const parentSnap = await tx.get(parentRef);

      const currentUserBal = userSnap.exists()
        ? Math.max(0, Number(userSnap.data().walletBalanceZar || 0))
        : 0;
      const currentParentBal = parentSnap.exists()
        ? Math.max(0, Number(parentSnap.data().walletBalanceZar || 0))
        : 0;
      const baseBal = Math.max(currentUserBal, currentParentBal);
      nextBalanceZar = Math.min(1000000, Math.round((baseBal + cleanAmount) * 100) / 100);

      if (userSnap.exists()) {
        tx.update(userRef, {
          walletBalanceZar: nextBalanceZar,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(userRef, {
          uid: params.uid,
          name: params.userName.trim().slice(0, 40) || 'Supporter',
          role: params.role,
          schoolId: params.schoolId.slice(0, 100),
          schoolName: params.schoolName.slice(0, 100),
          grade: params.grades.join(', ').slice(0, 120) || 'Grade 4',
          grades: params.grades,
          walletBalanceZar: nextBalanceZar,
          ownedPetIds: [],
          adoptedPets: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (parentSnap.exists()) {
        tx.update(parentRef, {
          walletBalanceZar: nextBalanceZar,
          updatedAt: serverTimestamp(),
        });
      }

      tx.set(topupRef, {
        topupId,
        userId: params.uid,
        amountZar: cleanAmount,
        provider: 'Karri',
        status: 'completed',
        createdAt: serverTimestamp(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `wallet_topups/${topupId}`);
  }

  return { nextBalanceZar, topupId };
}

/**
 * Atomic checkout: verifies live stock & wallet balance inside runTransaction,
 * deducts Karri credit wallet, decrements stock (setting sold_out at 0),
 * records store_orders, and updates target sanctuary pet stats & multi-day supply.
 */
export async function checkoutStoreBasket(params: {
  buyerUid: string;
  buyerName: string;
  basketItems: BasketLineItem[];
  targetPetId: PetId | null;
}): Promise<{
  order: StoreOrder;
  nextWalletBalanceZar: number;
  updatedPets: AdoptedPet[];
}> {
  if (params.basketItems.length === 0) {
    throw new Error('Your basket is empty. Add garden produce or care bundles first.');
  }

  const userRef = doc(db, 'users', params.buyerUid);
  const parentRef = doc(db, 'parents', params.buyerUid);
  const orderId = sanitizeDocId(
    `ord_${params.buyerUid.slice(0, 12)}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  );
  const orderRef = doc(db, 'store_orders', orderId);

  const listingRefs = params.basketItems.map((line) =>
    doc(db, 'store_listings', line.listing.listingId)
  );

  let finalOrder!: StoreOrder;
  let nextWalletBalanceZar = 0;
  let updatedPets: AdoptedPet[] = [];

  try {
    await runTransaction(db, async (tx) => {
      // 1. Perform ALL reads before ANY writes
      const userSnap = await tx.get(userRef);
      const parentSnap = await tx.get(parentRef);
      const listingSnaps = await Promise.all(listingRefs.map((r) => tx.get(r)));

      if (!userSnap.exists()) {
        throw new Error('Account profile not ready yet. Please refresh and try again.');
      }

      const userData = userSnap.data() as Record<string, unknown>;
      const parentData = parentSnap.exists()
        ? (parentSnap.data() as Record<string, unknown>)
        : null;

      const walletBeforeZar = Math.max(
        0,
        Math.round(Number(userData.walletBalanceZar || 0) * 100) / 100
      );

      let totalPaidZar = 0;
      const verifiedItems: StoreOrderItem[] = [];
      const listingUpdates: {
        ref: (typeof listingRefs)[number];
        nextQty: number;
      }[] = [];
      const saleEventPayloads: {
        listingId: string;
        schoolId: string;
        schoolName: string;
        grade: string;
        itemTitle: string;
        sourceType: 'student_harvest' | 'care_bundle';
        unitsSold: number;
        amountZar: number;
      }[] = [];

      for (let i = 0; i < params.basketItems.length; i++) {
        const requested = params.basketItems[i];
        const snap = listingSnaps[i];
        if (!snap.exists()) {
          throw new Error(`"${requested.listing.title}" is no longer on the shelf.`);
        }
        const liveData = snap.data() as Record<string, unknown>;
        const liveQty =
          typeof liveData.quantityAvailable === 'number'
            ? Math.max(0, Math.round(liveData.quantityAvailable))
            : 0;

        if (liveQty < requested.quantity || liveQty === 0) {
          throw new Error(
            liveQty === 0
              ? `"${requested.listing.title}" just sold out — waiting on next student harvest.`
              : `Only ${liveQty} left of "${requested.listing.title}". Adjust your basket quantity.`
          );
        }

        const unitPrice =
          typeof liveData.priceZar === 'number' ? liveData.priceZar : requested.listing.priceZar;
        const lineAmountZar = Math.max(
          0.01,
          Math.round(unitPrice * requested.quantity * 100) / 100
        );
        totalPaidZar = Math.round((totalPaidZar + lineAmountZar) * 100) / 100;

        const nextQty = liveQty - requested.quantity;
        listingUpdates.push({ ref: listingRefs[i], nextQty });

        const resolvedListingId = String(liveData.listingId || requested.listing.listingId);
        const rawTitle = String(liveData.title || requested.listing.title || 'Garden Produce').trim();
        const safeTitle = (rawTitle.length >= 2 ? rawTitle : 'Garden Produce').slice(0, 100);
        const safeSchoolName =
          String(liveData.schoolName || requested.listing.schoolName || 'Community School')
            .trim()
            .slice(0, 100) || 'Community School';
        const safeSchoolId =
          String(
            liveData.schoolId || requested.listing.schoolId || normalizeSchoolId(safeSchoolName)
          )
            .trim()
            .slice(0, 100) || 'community';
        const safeGrade =
          String(liveData.grade || requested.listing.grade || 'Grade 4')
            .trim()
            .slice(0, 40) || 'Grade 4';
        const resolvedSourceType: 'student_harvest' | 'care_bundle' =
          liveData.sourceType === 'care_bundle' || requested.listing.sourceType === 'care_bundle'
            ? 'care_bundle'
            : 'student_harvest';

        verifiedItems.push({
          listingId: resolvedListingId,
          title: safeTitle,
          quantity: requested.quantity,
          priceZar: unitPrice,
          sourceSchoolId: safeSchoolId,
          sourceGrade: safeGrade,
          ...(typeof liveData.studentName === 'string' && liveData.studentName
            ? { studentName: liveData.studentName }
            : {}),
          petCareEffect: requested.listing.petCareEffect,
        });

        saleEventPayloads.push({
          listingId: resolvedListingId,
          schoolId: safeSchoolId,
          schoolName: safeSchoolName,
          grade: safeGrade,
          itemTitle: safeTitle,
          sourceType: resolvedSourceType,
          unitsSold: Math.max(1, Math.min(1000, Math.round(requested.quantity))),
          amountZar: lineAmountZar,
        });
      }

      if (walletBeforeZar < totalPaidZar) {
        throw new Error(
          `Insufficient Karri Credit balance (R${walletBeforeZar.toFixed(2)} available, R${totalPaidZar.toFixed(2)} needed). Please load at least R${MIN_KARRI_TOPUP_ZAR}.`
        );
      }

      nextWalletBalanceZar = Math.round((walletBeforeZar - totalPaidZar) * 100) / 100;

      // Resolve adopted pets from user or parent record
      const rawPets =
        Array.isArray(userData.adoptedPets) && userData.adoptedPets.length > 0
          ? userData.adoptedPets
          : parentData?.adoptedPets;
      const currentPets = sanitizeAdoptedPets(rawPets);

      const nowMs = Date.now();
      let resolvedTargetPetId = 'school-garden';
      let resolvedTargetPetName = 'School Garden Sanctuary';

      if (currentPets.length > 0) {
        const target =
          currentPets.find((p) => p.id === params.targetPetId) ?? currentPets[0];
        resolvedTargetPetId = target.id;
        resolvedTargetPetName = target.name;

        updatedPets = currentPets.map((rawPet) => {
          if (rawPet.id !== target.id) return rawPet;
          const base = computeEffectivePetStats(rawPet, nowMs);
          let hunger = base.hunger;
          let water = base.water;
          let energy = base.energy;
          let play = base.play;
          let happiness = base.happiness;
          let supplyUntilMs = base.supplyUntilMs && base.supplyUntilMs > nowMs
            ? base.supplyUntilMs
            : nowMs;
          let addedSupplyDays = 0;

          for (const item of verifiedItems) {
            const boost = item.petCareEffect.boostAmount * item.quantity;
            if (item.petCareEffect.stat === 'hunger') {
              hunger = Math.min(100, hunger + boost);
            } else if (item.petCareEffect.stat === 'water') {
              water = Math.min(100, water + boost);
            } else if (item.petCareEffect.stat === 'energy') {
              energy = Math.min(100, energy + boost);
            } else if (item.petCareEffect.stat === 'play') {
              play = Math.min(100, play + boost);
            }
            if (item.petCareEffect.supplyDays) {
              addedSupplyDays += item.petCareEffect.supplyDays * item.quantity;
            }
            happiness = Math.min(100, happiness + 4 * item.quantity);
          }

          if (addedSupplyDays > 0) {
            const cappedDays = Math.min(30, addedSupplyDays);
            supplyUntilMs = supplyUntilMs + cappedDays * 86400000;
          }

          const finalSupplyDays =
            supplyUntilMs > nowMs
              ? Math.min(30, Math.max(1, Math.ceil((supplyUntilMs - nowMs) / 86400000)))
              : 0;

          return {
            ...base,
            happiness,
            hunger,
            water,
            energy,
            play,
            supplyDaysRemaining: finalSupplyDays,
            supplyUntilMs: finalSupplyDays > 0 ? supplyUntilMs : 0,
            lastCareAtMs: nowMs,
          };
        });
      }

      // 2. Perform ALL writes atomically
      for (const upd of listingUpdates) {
        tx.update(upd.ref, {
          quantityAvailable: upd.nextQty,
          status: upd.nextQty <= 0 ? 'sold_out' : 'active',
          updatedAt: serverTimestamp(),
        });
      }

      const cleanUpdatedPets = sanitizeAdoptedPets(updatedPets);

      tx.update(userRef, {
        walletBalanceZar: nextWalletBalanceZar,
        adoptedPets: cleanUpdatedPets,
        ownedPetIds: cleanUpdatedPets.map((p) => p.id),
        updatedAt: serverTimestamp(),
      });

      if (parentSnap.exists()) {
        tx.update(parentRef, {
          walletBalanceZar: nextWalletBalanceZar,
          adoptedPets: cleanUpdatedPets,
          updatedAt: serverTimestamp(),
        });
      }

      tx.set(orderRef, {
        orderId,
        buyerUid: params.buyerUid,
        buyerName: params.buyerName.trim().slice(0, 40) || 'Supporter',
        items: verifiedItems,
        totalPaidZar,
        walletBeforeZar,
        walletAfterZar: nextWalletBalanceZar,
        targetPetId: resolvedTargetPetId,
        targetPetName: resolvedTargetPetName,
        paymentChannel: 'Karri Credit Wallet',
        createdAt: serverTimestamp(),
      });

      for (let idx = 0; idx < saleEventPayloads.length; idx++) {
        const ev = saleEventPayloads[idx];
        const saleId = sanitizeDocId(`sale_${orderId}_${idx}`);
        tx.set(doc(db, 'grade_sale_events', saleId), {
          saleId,
          orderId,
          listingId: ev.listingId,
          schoolId: ev.schoolId,
          schoolName: ev.schoolName,
          grade: ev.grade,
          itemTitle: ev.itemTitle,
          sourceType: ev.sourceType,
          unitsSold: ev.unitsSold,
          amountZar: ev.amountZar,
          soldAt: serverTimestamp(),
          soldAtMs: nowMs,
        });
      }

      finalOrder = {
        orderId,
        buyerUid: params.buyerUid,
        buyerName: params.buyerName.trim().slice(0, 40) || 'Supporter',
        items: verifiedItems,
        totalPaidZar,
        walletBeforeZar,
        walletAfterZar: nextWalletBalanceZar,
        targetPetId: resolvedTargetPetId,
        targetPetName: resolvedTargetPetName,
        paymentChannel: 'Karri Credit Wallet',
        createdAtMs: nowMs,
      };
    });
  } catch (err) {
    if (err instanceof Error && !err.message.startsWith('{')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `store_orders/${orderId}`);
  }

  return {
    order: finalOrder,
    nextWalletBalanceZar,
    updatedPets,
  };
}
