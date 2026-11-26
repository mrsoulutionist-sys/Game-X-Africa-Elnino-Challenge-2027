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
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  deriveAdminKey,
  handleFirestoreError,
  OperationType,
  type FarmerProfile,
} from './firebaseClient';

export interface AdminProfile {
  adminKey: string;
  adminName: string;
  role: 'admin';
  isFirstClaim: boolean;
}

export interface AdminClaimStatus {
  claimed: boolean;
  primaryAdminName: string | null;
}

export type BannerStyle = 'scroll' | 'flash';
export type BannerStage =
  | 'all'
  | 'kitchen'
  | 'garden'
  | 'compost'
  | 'solar'
  | 'harvest_ready'
  | 'compost_needed'
  | 'solar_maintenance';

export interface ChallengeBannerItem {
  id: string;
  text: string;
  style: BannerStyle;
  stage: BannerStage;
  active: boolean;
}

export const BANNER_STAGE_OPTIONS: Array<{ id: BannerStage; label: string }> = [
  { id: 'all', label: 'All Game Stages' },
  { id: 'kitchen', label: 'Door 1 · Kitchen PVC Lab' },
  { id: 'garden', label: 'Door 2 · Garden Yard & El Niño' },
  { id: 'compost', label: 'Door 3 · Compost & Mulch' },
  { id: 'solar', label: 'Room 4 · Solar & PVC Workshop' },
  { id: 'harvest_ready', label: 'Milestone · Crop Harvest Ready' },
  { id: 'compost_needed', label: 'Alert · Compost Refresh Needed' },
  { id: 'solar_maintenance', label: 'Alert · Solar Dust Clean Needed' },
];

export const MAX_ADMIN_BANNERS = 12;
export const BANNER_INTERVAL_MS = 120_000;
export const BANNER_DISPLAY_DURATION_MS = 60_000;

export interface SystemConfigState {
  competitionTimerEnabled: boolean;
  compostYieldCycleLimit: number;
  solarDustYieldTriggerLimit: number;
  maxHarvestHoursCap: number;
  challengeBannerText: string;
  banners: ChallengeBannerItem[];
  updatedByAdminName: string;
  updatedAtMs: number | null;
}

export type AdminDocCategory = 'guide' | 'rules' | 'curriculum' | 'notice';

export interface AdminDocumentRecord {
  docId: string;
  title: string;
  description: string;
  category: AdminDocCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64: string;
  active: boolean;
  uploadedByAdminName: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CompetitionRunRecord {
  runId: string;
  farmerKey: string;
  farmerName: string;
  schoolId: string;
  grade: string;
  elapsedMs: number;
  compostCycleCount: number;
  milestoneLabel: string;
  createdAtMs: number;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfigState = {
  competitionTimerEnabled: false,
  compostYieldCycleLimit: 3,
  solarDustYieldTriggerLimit: 3,
  maxHarvestHoursCap: 24,
  challengeBannerText: '',
  banners: [],
  updatedByAdminName: 'System Default',
  updatedAtMs: null,
};

export const MAX_ADMIN_DOC_BYTES = 400_000;

export const ALLOWED_DOC_MIME_PREFIXES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/webp',
];

const ALLOWED_EXTENSIONS = /\.(pdf|txt|md|csv|json|png|jpg|jpeg|webp)$/i;

function makeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`.slice(0, 110);
}

function toMs(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function getAdminClaimStatus(): Promise<AdminClaimStatus> {
  const path = 'admin_meta/status';
  try {
    const snap = await getDoc(doc(db, 'admin_meta', 'status'));
    if (!snap.exists()) {
      return { claimed: false, primaryAdminName: null };
    }
    const data = snap.data() as Record<string, unknown>;
    return {
      claimed: Boolean(data.claimed),
      primaryAdminName:
        typeof data.primaryAdminName === 'string' ? data.primaryAdminName : null,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function claimOrLoginAdmin(
  rawAdminName: string,
  passcode: string
): Promise<AdminProfile> {
  const adminName = rawAdminName.trim().slice(0, 40);
  if (!adminName) {
    throw new Error('Please enter an Admin Name.');
  }
  if (!passcode || passcode.length < 4) {
    throw new Error('Admin passcode must be at least 4 characters.');
  }

  const adminKey = await deriveAdminKey(adminName, passcode);
  const metaRef = doc(db, 'admin_meta', 'status');
  const adminRef = doc(db, 'admins', adminKey);

  let metaSnap;
  try {
    metaSnap = await getDoc(metaRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'admin_meta/status');
  }

  if (!metaSnap.exists()) {
    try {
      await runTransaction(db, async (tx) => {
        const freshMeta = await tx.get(metaRef);
        if (freshMeta.exists()) {
          throw new Error('Primary admin account was already claimed.');
        }
        tx.set(adminRef, {
          adminKey,
          adminName,
          role: 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.set(metaRef, {
          docId: 'status',
          claimed: true,
          primaryAdminName: adminName,
          claimedAt: serverTimestamp(),
        });
      });
      return { adminKey, adminName, role: 'admin', isFirstClaim: true };
    } catch (err) {
      if (err instanceof Error && err.message.includes('already claimed')) {
        throw err;
      }
      handleFirestoreError(err, OperationType.WRITE, 'admins/' + adminKey);
    }
  }

  let adminSnap;
  try {
    adminSnap = await getDoc(adminRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `admins/${adminKey}`);
  }

  if (!adminSnap.exists()) {
    throw new Error('Invalid Admin Name or passcode.');
  }

  const data = adminSnap.data() as Record<string, unknown>;
  return {
    adminKey,
    adminName: typeof data.adminName === 'string' ? data.adminName : adminName,
    role: 'admin',
    isFirstClaim: false,
  };
}

function sanitizeBannerStage(raw: unknown): BannerStage {
  return raw === 'kitchen' ||
    raw === 'garden' ||
    raw === 'compost' ||
    raw === 'solar' ||
    raw === 'harvest_ready' ||
    raw === 'compost_needed' ||
    raw === 'solar_maintenance'
    ? raw
    : 'all';
}

export function sanitizeBannerList(rawList: unknown): ChallengeBannerItem[] {
  if (!Array.isArray(rawList)) return [];
  const out: ChallengeBannerItem[] = [];
  for (let i = 0; i < rawList.length && out.length < MAX_ADMIN_BANNERS; i++) {
    const item = rawList[i] as Record<string, unknown> | null;
    if (!item || typeof item !== 'object') continue;
    const text = typeof item.text === 'string' ? item.text.trim().slice(0, 180) : '';
    if (text.length < 2) continue;
    const rawId = typeof item.id === 'string' ? item.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) : '';
    const id = rawId || `bnr_${i + 1}`;
    const style: BannerStyle = item.style === 'flash' ? 'flash' : 'scroll';
    const stage = sanitizeBannerStage(item.stage);
    const active = item.active !== false;
    out.push({ id, text, style, stage, active });
  }
  return out;
}

export function subscribeToSystemConfig(
  onUpdate: (config: SystemConfigState) => void
): Unsubscribe {
  const path = 'system_config/global';
  const ref = doc(db, 'system_config', 'global');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate({ ...DEFAULT_SYSTEM_CONFIG });
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      const rawLimit =
        typeof d.compostYieldCycleLimit === 'number'
          ? Math.round(d.compostYieldCycleLimit)
          : 3;
      const rawSolarTrigger =
        typeof d.solarDustYieldTriggerLimit === 'number'
          ? Math.round(d.solarDustYieldTriggerLimit)
          : 3;
      const rawMaxCap =
        typeof d.maxHarvestHoursCap === 'number'
          ? Math.round(d.maxHarvestHoursCap)
          : 24;
      const legacyText =
        typeof d.challengeBannerText === 'string'
          ? d.challengeBannerText.trim().slice(0, 180)
          : '';
      let parsedBanners = sanitizeBannerList(d.banners);
      if (parsedBanners.length === 0 && !Array.isArray(d.banners) && legacyText.length >= 2) {
        parsedBanners = [
          {
            id: 'legacy_banner',
            text: legacyText,
            style: 'scroll',
            stage: 'all',
            active: true,
          },
        ];
      }
      onUpdate({
        competitionTimerEnabled: Boolean(d.competitionTimerEnabled),
        compostYieldCycleLimit: Math.max(1, Math.min(10, rawLimit)),
        solarDustYieldTriggerLimit: Math.max(1, Math.min(10, rawSolarTrigger)),
        maxHarvestHoursCap: Math.max(12, Math.min(24, rawMaxCap)),
        challengeBannerText: legacyText,
        banners: parsedBanners,
        updatedByAdminName:
          typeof d.updatedByAdminName === 'string' ? d.updatedByAdminName : 'Admin',
        updatedAtMs: d.updatedAt ? toMs(d.updatedAt) : null,
      });
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export async function updateSystemConfigAsAdmin(params: {
  admin: AdminProfile;
  competitionTimerEnabled: boolean;
  compostYieldCycleLimit: number;
  solarDustYieldTriggerLimit?: number;
  maxHarvestHoursCap?: number;
  challengeBannerText?: string;
  banners?: ChallengeBannerItem[];
}): Promise<void> {
  const tokenId = makeId('admtok');
  const cleanLimit = Math.max(1, Math.min(10, Math.round(params.compostYieldCycleLimit || 3)));
  const cleanSolarTrigger = Math.max(
    1,
    Math.min(10, Math.round(params.solarDustYieldTriggerLimit ?? 3))
  );
  const cleanMaxHarvestCap = Math.max(
    12,
    Math.min(24, Math.round(params.maxHarvestHoursCap ?? 24))
  );
  const cleanBanners = sanitizeBannerList(params.banners ?? []);
  const firstActive = cleanBanners.find((b) => b.active);
  const cleanBanner = (
    params.challengeBannerText ??
    firstActive?.text ??
    ''
  )
    .trim()
    .slice(0, 180);

  const batch = writeBatch(db);
  batch.set(doc(db, 'admin_write_tokens', tokenId), {
    tokenId,
    adminKey: params.admin.adminKey,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'system_config', 'global'), {
    configId: 'global',
    competitionTimerEnabled: Boolean(params.competitionTimerEnabled),
    compostYieldCycleLimit: cleanLimit,
    solarDustYieldTriggerLimit: cleanSolarTrigger,
    maxHarvestHoursCap: cleanMaxHarvestCap,
    challengeBannerText: cleanBanner,
    banners: cleanBanners,
    actionTokenId: tokenId,
    updatedByAdminName: params.admin.adminName.slice(0, 40),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'system_config/global');
  }
}

export function subscribeToAdminDocuments(
  onUpdate: (docs: AdminDocumentRecord[]) => void,
  includeArchived = false
): Unsubscribe {
  const q = query(collection(db, 'admin_documents'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const rows: AdminDocumentRecord[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        const active = d.active !== false;
        if (!includeArchived && !active) return;
        const cat = String(d.category || 'guide') as AdminDocCategory;
        const validCat: AdminDocCategory =
          cat === 'rules' || cat === 'curriculum' || cat === 'notice' ? cat : 'guide';
        rows.push({
          docId: String(d.docId || docSnap.id),
          title: String(d.title || 'Untitled Guide'),
          description: typeof d.description === 'string' ? d.description : '',
          category: validCat,
          fileName: String(d.fileName || 'document.txt'),
          mimeType: String(d.mimeType || 'application/octet-stream'),
          sizeBytes: typeof d.sizeBytes === 'number' ? d.sizeBytes : 0,
          contentBase64: typeof d.contentBase64 === 'string' ? d.contentBase64 : '',
          active,
          uploadedByAdminName: String(d.uploadedByAdminName || 'Admin'),
          createdAtMs: toMs(d.createdAt),
          updatedAtMs: toMs(d.updatedAt),
        });
      });
      rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onUpdate(rows);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'admin_documents');
    }
  );
}

export async function readFileAsValidatedBase64(file: File): Promise<{
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64: string;
}> {
  if (!ALLOWED_EXTENSIONS.test(file.name)) {
    throw new Error(
      'Unsupported file type. Allowed formats: PDF, TXT, MD, CSV, JSON, PNG, JPG, WEBP.'
    );
  }
  if (file.size <= 0) {
    throw new Error('Selected file is empty.');
  }
  if (file.size > MAX_ADMIN_DOC_BYTES) {
    throw new Error(
      `File is too large (${Math.round(file.size / 1024)} KB). Maximum allowed size is 400 KB.`
    );
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'guide.pdf';
  const resolvedMime =
    file.type && ALLOWED_DOC_MIME_PREFIXES.includes(file.type)
      ? file.type
      : safeFileName.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : safeFileName.toLowerCase().endsWith('.csv')
          ? 'text/csv'
          : safeFileName.toLowerCase().endsWith('.json')
            ? 'application/json'
            : safeFileName.toLowerCase().endsWith('.png')
              ? 'image/png'
              : safeFileName.toLowerCase().endsWith('.webp')
                ? 'image/webp'
                : safeFileName.toLowerCase().match(/\.jpe?g$/)
                  ? 'image/jpeg'
                  : 'text/plain';

  const contentBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = res.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Failed to encode file.'));
        return;
      }
      resolve(res.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });

  if (contentBase64.length > 620_000) {
    throw new Error('Encoded file exceeds storage limit (400 KB max).');
  }

  return {
    fileName: safeFileName,
    mimeType: resolvedMime,
    sizeBytes: file.size,
    contentBase64,
  };
}

export async function uploadAdminDocument(params: {
  admin: AdminProfile;
  title: string;
  description: string;
  category: AdminDocCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64: string;
}): Promise<string> {
  const cleanTitle = params.title.trim().slice(0, 120);
  if (cleanTitle.length < 2) {
    throw new Error('Document title must be at least 2 characters.');
  }
  const cleanDesc = params.description.trim().slice(0, 300);
  const docId = makeId('doc');
  const tokenId = makeId('admtok');

  const batch = writeBatch(db);
  batch.set(doc(db, 'admin_write_tokens', tokenId), {
    tokenId,
    adminKey: params.admin.adminKey,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'admin_documents', docId), {
    docId,
    title: cleanTitle,
    description: cleanDesc,
    category: params.category,
    fileName: params.fileName.slice(0, 120),
    mimeType: params.mimeType.slice(0, 80),
    sizeBytes: Math.max(1, Math.min(450000, Math.round(params.sizeBytes))),
    contentBase64: params.contentBase64,
    active: true,
    actionTokenId: tokenId,
    uploadedByAdminName: params.admin.adminName.slice(0, 40),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `admin_documents/${docId}`);
  }
  return docId;
}

export async function archiveAdminDocument(params: {
  admin: AdminProfile;
  docItem: AdminDocumentRecord;
}): Promise<void> {
  const tokenId = makeId('admtok');
  const batch = writeBatch(db);
  batch.set(doc(db, 'admin_write_tokens', tokenId), {
    tokenId,
    adminKey: params.admin.adminKey,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, 'admin_documents', params.docItem.docId), {
    active: false,
    actionTokenId: tokenId,
    uploadedByAdminName: params.admin.adminName.slice(0, 40),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `admin_documents/${params.docItem.docId}`
    );
  }
}

export function triggerSafeDocumentDownload(docItem: AdminDocumentRecord): void {
  const binary = window.atob(docItem.contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: docItem.mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = docItem.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export async function recordCompetitionRun(params: {
  profile: FarmerProfile;
  elapsedMs: number;
  milestoneLabel: string;
}): Promise<void> {
  const runId = makeId('run');
  const safeElapsed = Math.max(500, Math.min(86400000, Math.round(params.elapsedMs)));
  const safeLabel = params.milestoneLabel.trim().slice(0, 80) || 'Garden Speed Run';

  try {
    await setDoc(doc(db, 'competition_runs', runId), {
      runId,
      farmerKey: params.profile.farmerKey,
      farmerName: params.profile.farmerName.slice(0, 40),
      schoolId: (params.profile.schoolKey || 'community').slice(0, 100),
      grade: (params.profile.grade || 'Grade 4').slice(0, 40),
      elapsedMs: safeElapsed,
      compostCycleCount: Math.max(0, Math.round(params.profile.compostCycleCount || 0)),
      milestoneLabel: safeLabel,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `competition_runs/${runId}`);
  }
}

export function subscribeToCompetitionRuns(
  onUpdate: (runs: CompetitionRunRecord[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'competition_runs'),
    orderBy('elapsedMs', 'asc'),
    limit(25)
  );
  return onSnapshot(
    q,
    (snap) => {
      const runs: CompetitionRunRecord[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        runs.push({
          runId: String(d.runId || docSnap.id),
          farmerKey: String(d.farmerKey || ''),
          farmerName: String(d.farmerName || 'Farmer'),
          schoolId: String(d.schoolId || 'community'),
          grade: String(d.grade || 'Grade 4'),
          elapsedMs: typeof d.elapsedMs === 'number' ? d.elapsedMs : 0,
          compostCycleCount:
            typeof d.compostCycleCount === 'number' ? d.compostCycleCount : 0,
          milestoneLabel: String(d.milestoneLabel || 'Garden Run'),
          createdAtMs: toMs(d.createdAt),
        });
      });
      onUpdate(runs);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'competition_runs');
    }
  );
}

export function formatStopwatchMs(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const tenths = Math.floor((clamped % 1000) / 100);
  const totalSec = Math.floor(clamped / 1000);
  const secs = totalSec % 60;
  const mins = Math.floor(totalSec / 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}
