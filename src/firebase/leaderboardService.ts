import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  SCHOOL_GRADES,
  type FarmerProfile,
} from './firebaseClient';
import type { HarvestBatch, StoreListing } from './storeService';

export const KG_PER_HARVEST_UNIT = 10;

export interface LeaderboardStudentRecord {
  studentUid: string;
  studentName: string;
  schoolId: string;
  schoolName: string;
  grade: string;
  totalHarvestUnits: number;
  totalHarvestedCount: number;
  foodServings: number;
  litresSaved: number;
  updatedAtMs: number;
}

export interface GradeSaleEventRecord {
  saleId: string;
  orderId: string;
  listingId: string;
  schoolId: string;
  schoolName: string;
  grade: string;
  itemTitle: string;
  sourceType: 'student_harvest' | 'care_bundle';
  unitsSold: number;
  amountZar: number;
  soldAtMs: number;
}

export interface SchoolCluster {
  clusterId: string;
  canonicalName: string;
  matchedVariants: string[];
  tierToken: string | null;
  coreStem: string;
}

export interface GroupedGradeSalesSummary {
  grade: string;
  studentCount: number;
  harvestUnits: number;
  harvestKg: number;
  harvestMassLabel: string;
  unitsSold: number;
  salesZar: number;
  topItems: string[];
}

export interface GroupedSchoolSummary {
  canonicalSchoolId: string;
  canonicalSchoolName: string;
  matchedVariants: string[];
  studentCount: number;
  totalHarvestUnits: number;
  totalKg: number;
  massLabel: string;
  totalFoodServings: number;
  totalUnitsSold: number;
  totalSalesZar: number;
  grades: GroupedGradeSalesSummary[];
}

export interface RankedStudentEntry {
  position: number;
  studentUid: string;
  studentName: string;
  grade: string;
  rawSchoolName: string;
  canonicalSchoolId: string;
  canonicalSchoolName: string;
  schoolAliasCount: number;
  totalHarvestUnits: number;
  totalHarvestedCount: number;
  foodServings: number;
  litresSaved: number;
  totalKg: number;
  massLabel: string;
  gradeSalesZar: number;
  gradeUnitsSold: number;
  schoolTotalHarvestUnits: number;
  schoolMassLabel: string;
}

export interface GlobalGradeSalesRow {
  grade: string;
  studentCount: number;
  schoolCount: number;
  harvestUnits: number;
  harvestMassLabel: string;
  unitsSold: number;
  salesZar: number;
}

export interface LeaderboardSnapshot {
  rankedStudents: RankedStudentEntry[];
  groupedSchools: GroupedSchoolSummary[];
  gradeTotals: GlobalGradeSalesRow[];
  totalHarvestUnitsAll: number;
  totalMassAllLabel: string;
  totalProduceSalesZar: number;
  careBundleSalesZar: number;
  careBundleUnitsSold: number;
  resolveSchoolCluster: (rawSchoolName: string) => SchoolCluster;
}

const SCHOOL_TIER_TOKENS = new Set([
  'primary',
  'high',
  'secondary',
  'preparatory',
  'college',
  'academy',
  'combined',
  'laerskool',
  'hoerskool',
  'technical',
  'independent',
]);

const ABBREVIATION_MAP: Record<string, string> = {
  prim: 'primary',
  prm: 'primary',
  ps: 'primary',
  ls: 'laerskool',
  laer: 'laerskool',
  hoer: 'hoerskool',
  hs: 'high',
  sec: 'secondary',
  prep: 'preparatory',
  coll: 'college',
  acad: 'academy',
  jnr: 'junior',
  jr: 'junior',
  snr: 'senior',
  sr: 'senior',
  st: 'saint',
};

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toCleanTitleCase(input: string): string {
  const minor = new Set(['of', 'and', 'the', 'van', 'de', 'der', 'du']);
  return input
    .trim()
    .split(/\s+/)
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && minor.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function normalizeSchoolIdSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100) || 'community';
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

export function formatHarvestMass(units: number): {
  kg: number;
  tonnes: number;
  label: string;
} {
  const safeUnits = Math.max(0, Math.round(units));
  const kg = safeUnits * KG_PER_HARVEST_UNIT;
  const tonnes = kg / 1000;
  if (kg >= 1000) {
    return {
      kg,
      tonnes,
      label: `${tonnes.toFixed(2)} t (${kg.toLocaleString('en-ZA')} kg)`,
    };
  }
  return {
    kg,
    tonnes,
    label: `${kg.toLocaleString('en-ZA')} kg`,
  };
}

export function canonicalizeSchoolName(raw: string): {
  normalizedFull: string;
  coreStem: string;
  tierToken: string | null;
  cleanDisplay: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      normalizedFull: 'community',
      coreStem: 'community',
      tierToken: null,
      cleanDisplay: 'Community School',
    };
  }

  const ascii = stripDiacritics(trimmed)
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !ascii ||
    ascii === 'community' ||
    ascii === 'community school' ||
    ascii === 'all sanctuary'
  ) {
    return {
      normalizedFull: ascii === 'all sanctuary' ? 'all-sanctuary' : 'community',
      coreStem: ascii === 'all sanctuary' ? 'all sanctuary' : 'community',
      tierToken: null,
      cleanDisplay:
        ascii === 'all sanctuary' ? 'Game X Sanctuary Pantry' : 'Community School',
    };
  }

  let tokens = ascii.split(' ').filter(Boolean);
  if (tokens.length > 1 && tokens[0] === 'the') {
    tokens = tokens.slice(1);
  }

  // Merge adjacent "high school" -> "high" before abbreviation expansion cleanup
  const expanded: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'highschool') {
      expanded.push('high');
      continue;
    }
    const mapped = ABBREVIATION_MAP[t] ?? t;
    expanded.push(mapped);
  }

  // Drop trailing generic "school" or "skool" when at least 2 tokens exist
  while (
    expanded.length > 1 &&
    (expanded[expanded.length - 1] === 'school' ||
      expanded[expanded.length - 1] === 'skool')
  ) {
    expanded.pop();
  }

  let tierToken: string | null = null;
  const stemTokens: string[] = [];
  for (const tok of expanded) {
    if (!tierToken && SCHOOL_TIER_TOKENS.has(tok)) {
      tierToken = tok;
    } else if (tok !== 'school' && tok !== 'skool') {
      stemTokens.push(tok);
    }
  }

  const normalizedFull = expanded.join(' ');
  const coreStem = stemTokens.join(' ') || normalizedFull;
  const cleanDisplay = toCleanTitleCase(
    stemTokens.length > 0 && tierToken
      ? normalizedFull
      : trimmed.replace(/\s+/g, ' ')
  );

  return {
    normalizedFull,
    coreStem,
    tierToken,
    cleanDisplay,
  };
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function scoreDisplayCandidate(rawVariant: string, frequency: number): number {
  const trimmed = rawVariant.trim();
  const hasMixedCase = /[A-Z]/.test(trimmed) && /[a-z]/.test(trimmed);
  const hasAbbrev = /\b(prim|prm|hs|sec|prep)\b\.?/i.test(trimmed);
  let score = frequency * 10;
  if (hasMixedCase) score += 25;
  if (!hasAbbrev) score += 15;
  if (!trimmed.toLowerCase().endsWith(' school')) score += 4;
  return score;
}

interface InternalCluster {
  clusterId: string;
  tierToken: string | null;
  coreStem: string;
  normalizedAnchor: string;
  rawCounts: Map<string, number>;
  normKeys: Set<string>;
}

/**
 * Groups manually typed school names (case, whitespace, abbreviations like "Prim.",
 * trailing "School", and minor typos like "Pineland Primary" vs "Pinelands Primary")
 * under one canonical school entity while keeping distinct school tiers ("Primary" vs "High") apart.
 */
export function clusterSchoolNames(
  inputs: Array<{ rawName: string; weight?: number }>
): {
  clusters: SchoolCluster[];
  resolve: (rawName: string) => SchoolCluster;
} {
  const variantStats = new Map<
    string,
    {
      normalizedFull: string;
      coreStem: string;
      tierToken: string | null;
      cleanDisplay: string;
      rawCounts: Map<string, number>;
      totalWeight: number;
    }
  >();

  for (const item of inputs) {
    const raw = (item.rawName || '').trim() || 'Community School';
    const parsed = canonicalizeSchoolName(raw);
    const w = Math.max(1, item.weight ?? 1);
    const existing = variantStats.get(parsed.normalizedFull);
    if (!existing) {
      const rawCounts = new Map<string, number>();
      rawCounts.set(raw, w);
      variantStats.set(parsed.normalizedFull, {
        normalizedFull: parsed.normalizedFull,
        coreStem: parsed.coreStem,
        tierToken: parsed.tierToken,
        cleanDisplay: parsed.cleanDisplay,
        rawCounts,
        totalWeight: w,
      });
    } else {
      existing.totalWeight += w;
      existing.rawCounts.set(raw, (existing.rawCounts.get(raw) ?? 0) + w);
    }
  }

  // Sort most frequent / longest variants first so clean anchors form before typos
  const sortedEntries = Array.from(variantStats.values()).sort((a, b) => {
    if (b.totalWeight !== a.totalWeight) return b.totalWeight - a.totalWeight;
    return b.coreStem.length - a.coreStem.length;
  });

  const internalClusters: InternalCluster[] = [];

  for (const entry of sortedEntries) {
    const compactStem = entry.coreStem.replace(/\s+/g, '');
    let matched: InternalCluster | null = null;

    for (const cluster of internalClusters) {
      if (cluster.normKeys.has(entry.normalizedFull)) {
        matched = cluster;
        break;
      }
      // Never merge conflicting school tiers (e.g. Primary vs High)
      if (cluster.tierToken !== entry.tierToken) {
        continue;
      }

      const clusterCompact = cluster.coreStem.replace(/\s+/g, '');
      if (compactStem === clusterCompact) {
        matched = cluster;
        break;
      }

      // Fuzzy typo match only on meaningful stems sharing opening prefix
      if (
        compactStem.length >= 4 &&
        clusterCompact.length >= 4 &&
        compactStem.slice(0, 3) === clusterCompact.slice(0, 3)
      ) {
        const maxDist = Math.min(compactStem.length, clusterCompact.length) >= 7 ? 2 : 1;
        if (levenshteinDistance(compactStem, clusterCompact) <= maxDist) {
          matched = cluster;
          break;
        }
      }
    }

    if (matched) {
      matched.normKeys.add(entry.normalizedFull);
      for (const [rawStr, count] of entry.rawCounts.entries()) {
        matched.rawCounts.set(rawStr, (matched.rawCounts.get(rawStr) ?? 0) + count);
      }
    } else {
      const slug = entry.normalizedFull
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 64);
      internalClusters.push({
        clusterId: `school_${slug || 'community'}`,
        tierToken: entry.tierToken,
        coreStem: entry.coreStem,
        normalizedAnchor: entry.normalizedFull,
        rawCounts: new Map(entry.rawCounts),
        normKeys: new Set([entry.normalizedFull]),
      });
    }
  }

  // Pass 2: If a tierless cluster (e.g. "Pinelands") matches the exact coreStem of a SINGLE
  // tiered cluster (e.g. "Pinelands Primary" when no "Pinelands High" exists), merge them safely.
  const absorbedIds = new Set<string>();
  for (const tierless of internalClusters) {
    if (tierless.tierToken !== null || tierless.coreStem === 'community' || tierless.coreStem === 'all sanctuary') {
      continue;
    }
    const tierlessCompact = tierless.coreStem.replace(/\s+/g, '');
    const candidates = internalClusters.filter(
      (c) =>
        c.clusterId !== tierless.clusterId &&
        !absorbedIds.has(c.clusterId) &&
        c.tierToken !== null &&
        c.coreStem.replace(/\s+/g, '') === tierlessCompact
    );
    if (candidates.length === 1) {
      const target = candidates[0];
      for (const k of tierless.normKeys) target.normKeys.add(k);
      for (const [rawStr, count] of tierless.rawCounts.entries()) {
        target.rawCounts.set(rawStr, (target.rawCounts.get(rawStr) ?? 0) + count);
      }
      absorbedIds.add(tierless.clusterId);
    }
  }

  const finalClusters: SchoolCluster[] = [];
  const normKeyToCluster = new Map<string, SchoolCluster>();

  for (const ic of internalClusters) {
    if (absorbedIds.has(ic.clusterId)) continue;

    let bestVariant = '';
    let bestScore = -1;
    const matchedVariants: string[] = [];

    for (const [rawStr, count] of ic.rawCounts.entries()) {
      matchedVariants.push(rawStr);
      const s = scoreDisplayCandidate(rawStr, count);
      if (s > bestScore) {
        bestScore = s;
        bestVariant = rawStr;
      }
    }

    const parsedBest = canonicalizeSchoolName(bestVariant || ic.normalizedAnchor);
    const canonicalName =
      ic.normalizedAnchor === 'all-sanctuary'
        ? 'Game X Sanctuary Pantry'
        : ic.normalizedAnchor === 'community'
          ? 'Community School'
          : /\b(prim|prm|hs|sec|prep)\b\.?/i.test(bestVariant) ||
              bestVariant === bestVariant.toLowerCase() ||
              bestVariant === bestVariant.toUpperCase()
            ? parsedBest.cleanDisplay
            : bestVariant.trim().replace(/\s+/g, ' ');

    const clusterObj: SchoolCluster = {
      clusterId: ic.clusterId,
      canonicalName,
      matchedVariants: matchedVariants.sort((a, b) => a.localeCompare(b)),
      tierToken: ic.tierToken,
      coreStem: ic.coreStem,
    };

    finalClusters.push(clusterObj);
    for (const k of ic.normKeys) {
      normKeyToCluster.set(k, clusterObj);
    }
  }

  const fallbackCommunity: SchoolCluster = {
    clusterId: 'school_community',
    canonicalName: 'Community School',
    matchedVariants: ['Community School'],
    tierToken: null,
    coreStem: 'community',
  };

  const resolve = (rawName: string): SchoolCluster => {
    const parsed = canonicalizeSchoolName(rawName);
    const found = normKeyToCluster.get(parsed.normalizedFull);
    if (found) return found;
    return {
      ...fallbackCommunity,
      canonicalName: parsed.cleanDisplay,
      matchedVariants: [rawName.trim() || 'Community School'],
    };
  };

  return { clusters: finalClusters, resolve };
}

function sanitizeGrade(rawGrade?: string): string {
  if (rawGrade && (SCHOOL_GRADES as readonly string[]).includes(rawGrade)) {
    return rawGrade;
  }
  return 'Grade 4';
}

/**
 * Keeps `/leaderboard_students/{studentUid}` synchronized without exposing `/farmers`.
 */
export async function syncLeaderboardStudent(
  profile: FarmerProfile,
  options?: { harvestUnitsFloor?: number }
): Promise<void> {
  const studentUid = profile.farmerKey;
  if (!/^[a-f0-9]{64}$/.test(studentUid)) return;

  const path = `leaderboard_students/${studentUid}`;
  const ref = doc(db, 'leaderboard_students', studentUid);

  const studentName = profile.farmerName.trim().slice(0, 40) || 'Farmer';
  const schoolName = (profile.schoolName || 'Community School').trim().slice(0, 100) || 'Community School';
  const schoolId = normalizeSchoolIdSlug(profile.schoolKey || schoolName);
  const grade = sanitizeGrade(profile.grade);
  const safeCount = Math.max(0, Math.min(100000, Math.round(profile.totalHarvestedCount)));
  const safeServings = Math.max(0, Math.min(1000000, Math.round(profile.foodServings)));
  const safeLitres = Math.max(0, Math.min(1000000, Math.round(profile.litresSaved * 10) / 10));

  let existingUnits = 0;
  let existingCount = 0;
  let exists = false;

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      exists = true;
      const d = snap.data() as Record<string, unknown>;
      existingUnits =
        typeof d.totalHarvestUnits === 'number' ? Math.max(0, Math.round(d.totalHarvestUnits)) : 0;
      existingCount =
        typeof d.totalHarvestedCount === 'number'
          ? Math.max(0, Math.round(d.totalHarvestedCount))
          : 0;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  const targetUnits = Math.max(
    existingUnits,
    safeCount,
    Math.round(options?.harvestUnitsFloor ?? 0)
  );
  const targetCount = Math.max(existingCount, safeCount);

  if (exists) {
    try {
      await updateDoc(ref, {
        studentName,
        schoolId,
        schoolName,
        grade,
        totalHarvestUnits: Math.min(100000, targetUnits),
        totalHarvestedCount: Math.min(100000, targetCount),
        foodServings: safeServings,
        litresSaved: safeLitres,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
    return;
  }

  try {
    await setDoc(ref, {
      studentUid,
      studentName,
      schoolId,
      schoolName,
      grade,
      totalHarvestUnits: Math.min(100000, targetUnits),
      totalHarvestedCount: Math.min(100000, targetCount),
      foodServings: safeServings,
      litresSaved: safeLitres,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeToLeaderboardStudents(
  onData: (rows: LeaderboardStudentRecord[]) => void
): Unsubscribe {
  const path = 'leaderboard_students';
  const q = query(
    collection(db, 'leaderboard_students'),
    orderBy('totalHarvestUnits', 'desc'),
    limit(250)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: LeaderboardStudentRecord[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        rows.push({
          studentUid: String(d.studentUid || docSnap.id),
          studentName: String(d.studentName || 'Farmer'),
          schoolId: String(d.schoolId || 'community'),
          schoolName: String(d.schoolName || 'Community School'),
          grade: String(d.grade || 'Grade 4'),
          totalHarvestUnits:
            typeof d.totalHarvestUnits === 'number'
              ? Math.max(0, Math.round(d.totalHarvestUnits))
              : 0,
          totalHarvestedCount:
            typeof d.totalHarvestedCount === 'number'
              ? Math.max(0, Math.round(d.totalHarvestedCount))
              : 0,
          foodServings:
            typeof d.foodServings === 'number' ? Math.max(0, Math.round(d.foodServings)) : 0,
          litresSaved: typeof d.litresSaved === 'number' ? Math.max(0, d.litresSaved) : 0,
          updatedAtMs: timestampToMs(d.updatedAt) ?? Date.now(),
        });
      });
      onData(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeToGradeSaleEvents(
  onData: (rows: GradeSaleEventRecord[]) => void
): Unsubscribe {
  const path = 'grade_sale_events';
  const q = query(
    collection(db, 'grade_sale_events'),
    orderBy('soldAtMs', 'desc'),
    limit(400)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: GradeSaleEventRecord[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        rows.push({
          saleId: String(d.saleId || docSnap.id),
          orderId: String(d.orderId || ''),
          listingId: String(d.listingId || ''),
          schoolId: String(d.schoolId || 'community'),
          schoolName: String(d.schoolName || 'Community School'),
          grade: String(d.grade || 'Grade 4'),
          itemTitle: String(d.itemTitle || 'Garden Produce'),
          sourceType: d.sourceType === 'care_bundle' ? 'care_bundle' : 'student_harvest',
          unitsSold: typeof d.unitsSold === 'number' ? Math.max(1, Math.round(d.unitsSold)) : 1,
          amountZar: typeof d.amountZar === 'number' ? Math.max(0, d.amountZar) : 0,
          soldAtMs: typeof d.soldAtMs === 'number' ? d.soldAtMs : Date.now(),
        });
      });
      onData(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

/**
 * Merges public student projections, raw harvest batches, and per-grade sale telemetry
 * with smart school name clustering.
 */
export function buildLeaderboardSnapshot(params: {
  students: LeaderboardStudentRecord[];
  batches: HarvestBatch[];
  saleEvents: GradeSaleEventRecord[];
  storeListings?: StoreListing[];
}): LeaderboardSnapshot {
  const { students, batches, saleEvents, storeListings = [] } = params;

  // 1. Collect all school name samples weighted by activity so canonical names prefer clean dominant spellings
  const schoolInputs: Array<{ rawName: string; weight?: number }> = [];
  for (const s of students) {
    schoolInputs.push({ rawName: s.schoolName || s.schoolId, weight: 3 });
  }
  for (const b of batches) {
    schoolInputs.push({ rawName: b.schoolName || b.schoolId, weight: 2 });
  }
  for (const ev of saleEvents) {
    if (ev.sourceType === 'student_harvest' && ev.schoolId !== 'all-sanctuary') {
      schoolInputs.push({ rawName: ev.schoolName || ev.schoolId, weight: 2 });
    }
  }
  for (const l of storeListings) {
    if (l.sourceType === 'student_harvest' && l.schoolId !== 'all-sanctuary') {
      schoolInputs.push({ rawName: l.schoolName || l.schoolId, weight: 1 });
    }
  }

  const { resolve } = clusterSchoolNames(schoolInputs);

  // 2. Merge per-student records across leaderboard_students + harvest_batches
  const studentMap = new Map<
    string,
    {
      studentUid: string;
      studentName: string;
      rawSchoolName: string;
      grade: string;
      projectionUnits: number;
      batchUnits: number;
      totalHarvestedCount: number;
      foodServings: number;
      litresSaved: number;
      updatedAtMs: number;
    }
  >();

  for (const s of students) {
    studentMap.set(s.studentUid, {
      studentUid: s.studentUid,
      studentName: s.studentName,
      rawSchoolName: s.schoolName || s.schoolId || 'Community School',
      grade: sanitizeGrade(s.grade),
      projectionUnits: s.totalHarvestUnits,
      batchUnits: 0,
      totalHarvestedCount: s.totalHarvestedCount,
      foodServings: s.foodServings,
      litresSaved: s.litresSaved,
      updatedAtMs: s.updatedAtMs,
    });
  }

  for (const b of batches) {
    const existing = studentMap.get(b.studentUid);
    if (!existing) {
      studentMap.set(b.studentUid, {
        studentUid: b.studentUid,
        studentName: b.studentName,
        rawSchoolName: b.schoolName || b.schoolId || 'Community School',
        grade: sanitizeGrade(b.grade),
        projectionUnits: 0,
        batchUnits: b.quantity,
        totalHarvestedCount: 1,
        foodServings: b.quantity * 2,
        litresSaved: 0,
        updatedAtMs: b.harvestedAtMs,
      });
    } else {
      existing.batchUnits += b.quantity;
      if (b.harvestedAtMs > existing.updatedAtMs) {
        existing.updatedAtMs = b.harvestedAtMs;
        if (b.schoolName) existing.rawSchoolName = b.schoolName;
        if (b.grade) existing.grade = sanitizeGrade(b.grade);
        if (b.studentName) existing.studentName = b.studentName;
      }
    }
  }

  // 3. Aggregate Schools and School+Grade buckets
  interface SchoolBucket {
    cluster: SchoolCluster;
    studentCount: number;
    totalHarvestUnits: number;
    totalFoodServings: number;
    totalUnitsSold: number;
    totalSalesZar: number;
    grades: Map<
      string,
      {
        grade: string;
        studentCount: number;
        harvestUnits: number;
        unitsSold: number;
        salesZar: number;
        itemSales: Map<string, number>;
      }
    >;
  }

  const schoolBuckets = new Map<string, SchoolBucket>();

  const ensureSchoolBucket = (rawSchoolName: string): SchoolBucket => {
    const cluster = resolve(rawSchoolName);
    let bucket = schoolBuckets.get(cluster.clusterId);
    if (!bucket) {
      bucket = {
        cluster,
        studentCount: 0,
        totalHarvestUnits: 0,
        totalFoodServings: 0,
        totalUnitsSold: 0,
        totalSalesZar: 0,
        grades: new Map(),
      };
      schoolBuckets.set(cluster.clusterId, bucket);
    }
    return bucket;
  };

  const ensureGradeBucket = (bucket: SchoolBucket, grade: string) => {
    const cleanGrade = sanitizeGrade(grade);
    let gb = bucket.grades.get(cleanGrade);
    if (!gb) {
      gb = {
        grade: cleanGrade,
        studentCount: 0,
        harvestUnits: 0,
        unitsSold: 0,
        salesZar: 0,
        itemSales: new Map(),
      };
      bucket.grades.set(cleanGrade, gb);
    }
    return gb;
  };

  const normalizedStudents = Array.from(studentMap.values()).map((s) => {
    const totalHarvestUnits = Math.max(
      s.projectionUnits,
      s.batchUnits,
      s.totalHarvestedCount
    );
    const bucket = ensureSchoolBucket(s.rawSchoolName);
    const gb = ensureGradeBucket(bucket, s.grade);

    bucket.studentCount += 1;
    bucket.totalHarvestUnits += totalHarvestUnits;
    bucket.totalFoodServings += Math.max(s.foodServings, totalHarvestUnits * 2);

    gb.studentCount += 1;
    gb.harvestUnits += totalHarvestUnits;

    return {
      ...s,
      totalHarvestUnits,
      cluster: bucket.cluster,
    };
  });

  // 4. Accumulate grade_sale_events cleanly
  let totalProduceSalesZar = 0;
  let careBundleSalesZar = 0;
  let careBundleUnitsSold = 0;

  for (const ev of saleEvents) {
    if (ev.sourceType === 'care_bundle' || ev.schoolId === 'all-sanctuary') {
      careBundleSalesZar = Math.round((careBundleSalesZar + ev.amountZar) * 100) / 100;
      careBundleUnitsSold += ev.unitsSold;
      continue;
    }
    totalProduceSalesZar = Math.round((totalProduceSalesZar + ev.amountZar) * 100) / 100;
    const bucket = ensureSchoolBucket(ev.schoolName || ev.schoolId);
    const gb = ensureGradeBucket(bucket, ev.grade);

    bucket.totalUnitsSold += ev.unitsSold;
    bucket.totalSalesZar = Math.round((bucket.totalSalesZar + ev.amountZar) * 100) / 100;

    gb.unitsSold += ev.unitsSold;
    gb.salesZar = Math.round((gb.salesZar + ev.amountZar) * 100) / 100;
    gb.itemSales.set(ev.itemTitle, (gb.itemSales.get(ev.itemTitle) ?? 0) + ev.unitsSold);
  }

  // 5. Build groupedSchools + cross-school gradeTotals
  const gradeIndex = (g: string) => {
    const idx = (SCHOOL_GRADES as readonly string[]).indexOf(g);
    return idx >= 0 ? idx : 99;
  };

  const groupedSchools: GroupedSchoolSummary[] = Array.from(schoolBuckets.values())
    .filter((b) => b.cluster.clusterId !== 'school_all_sanctuary')
    .map((b) => {
      const mass = formatHarvestMass(b.totalHarvestUnits);
      const grades: GroupedGradeSalesSummary[] = Array.from(b.grades.values())
        .sort((a, z) => gradeIndex(a.grade) - gradeIndex(z.grade))
        .map((gb) => {
          const gMass = formatHarvestMass(gb.harvestUnits);
          return {
            grade: gb.grade,
            studentCount: gb.studentCount,
            harvestUnits: gb.harvestUnits,
            harvestKg: gMass.kg,
            harvestMassLabel: gMass.label,
            unitsSold: gb.unitsSold,
            salesZar: gb.salesZar,
            topItems: Array.from(gb.itemSales.entries())
              .sort((a, z) => z[1] - a[1])
              .slice(0, 3)
              .map(([name]) => name),
          };
        });

      return {
        canonicalSchoolId: b.cluster.clusterId,
        canonicalSchoolName: b.cluster.canonicalName,
        matchedVariants: b.cluster.matchedVariants,
        studentCount: b.studentCount,
        totalHarvestUnits: b.totalHarvestUnits,
        totalKg: mass.kg,
        massLabel: mass.label,
        totalFoodServings: b.totalFoodServings,
        totalUnitsSold: b.totalUnitsSold,
        totalSalesZar: b.totalSalesZar,
        grades,
      };
    })
    .sort((a, b) => {
      if (b.totalHarvestUnits !== a.totalHarvestUnits) {
        return b.totalHarvestUnits - a.totalHarvestUnits;
      }
      if (b.totalSalesZar !== a.totalSalesZar) {
        return b.totalSalesZar - a.totalSalesZar;
      }
      return a.canonicalSchoolName.localeCompare(b.canonicalSchoolName);
    });

  const globalGradeMap = new Map<
    string,
    {
      grade: string;
      studentCount: number;
      schools: Set<string>;
      harvestUnits: number;
      unitsSold: number;
      salesZar: number;
    }
  >();

  for (const sch of groupedSchools) {
    for (const g of sch.grades) {
      let row = globalGradeMap.get(g.grade);
      if (!row) {
        row = {
          grade: g.grade,
          studentCount: 0,
          schools: new Set(),
          harvestUnits: 0,
          unitsSold: 0,
          salesZar: 0,
        };
        globalGradeMap.set(g.grade, row);
      }
      row.studentCount += g.studentCount;
      row.schools.add(sch.canonicalSchoolId);
      row.harvestUnits += g.harvestUnits;
      row.unitsSold += g.unitsSold;
      row.salesZar = Math.round((row.salesZar + g.salesZar) * 100) / 100;
    }
  }

  const gradeTotals: GlobalGradeSalesRow[] = Array.from(globalGradeMap.values())
    .sort((a, b) => gradeIndex(a.grade) - gradeIndex(b.grade))
    .map((row) => ({
      grade: row.grade,
      studentCount: row.studentCount,
      schoolCount: row.schools.size,
      harvestUnits: row.harvestUnits,
      harvestMassLabel: formatHarvestMass(row.harvestUnits).label,
      unitsSold: row.unitsSold,
      salesZar: row.salesZar,
    }));

  // 6. Rank Students by totalHarvestUnits DESC -> foodServings DESC -> studentName ASC
  const sortedStudents = [...normalizedStudents].sort((a, b) => {
    if (b.totalHarvestUnits !== a.totalHarvestUnits) {
      return b.totalHarvestUnits - a.totalHarvestUnits;
    }
    if (b.foodServings !== a.foodServings) {
      return b.foodServings - a.foodServings;
    }
    return a.studentName.localeCompare(b.studentName);
  });

  const rankedStudents: RankedStudentEntry[] = [];
  let prevUnits = -1;
  let currentRank = 0;

  for (let i = 0; i < sortedStudents.length; i++) {
    const s = sortedStudents[i];
    if (s.totalHarvestUnits !== prevUnits) {
      currentRank = i + 1;
      prevUnits = s.totalHarvestUnits;
    }
    const bucket = schoolBuckets.get(s.cluster.clusterId);
    const gb = bucket?.grades.get(s.grade);
    const studentMass = formatHarvestMass(s.totalHarvestUnits);
    const schoolUnits = bucket?.totalHarvestUnits ?? s.totalHarvestUnits;
    const schoolMass = formatHarvestMass(schoolUnits);

    rankedStudents.push({
      position: currentRank,
      studentUid: s.studentUid,
      studentName: s.studentName,
      grade: s.grade,
      rawSchoolName: s.rawSchoolName,
      canonicalSchoolId: s.cluster.clusterId,
      canonicalSchoolName: s.cluster.canonicalName,
      schoolAliasCount: s.cluster.matchedVariants.length,
      totalHarvestUnits: s.totalHarvestUnits,
      totalHarvestedCount: s.totalHarvestedCount,
      foodServings: s.foodServings,
      litresSaved: s.litresSaved,
      totalKg: studentMass.kg,
      massLabel: studentMass.label,
      gradeSalesZar: gb?.salesZar ?? 0,
      gradeUnitsSold: gb?.unitsSold ?? 0,
      schoolTotalHarvestUnits: schoolUnits,
      schoolMassLabel: schoolMass.label,
    });
  }

  const totalHarvestUnitsAll = groupedSchools.reduce((sum, s) => sum + s.totalHarvestUnits, 0);

  return {
    rankedStudents,
    groupedSchools,
    gradeTotals,
    totalHarvestUnitsAll,
    totalMassAllLabel: formatHarvestMass(totalHarvestUnitsAll).label,
    totalProduceSalesZar,
    careBundleSalesZar,
    careBundleUnitsSold,
    resolveSchoolCluster: resolve,
  };
}
