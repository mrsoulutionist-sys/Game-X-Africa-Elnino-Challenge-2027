import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  LogOut,
  Megaphone,
  Plus,
  Recycle,
  Save,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import {
  archiveAdminDocument,
  BANNER_STAGE_OPTIONS,
  formatStopwatchMs,
  MAX_ADMIN_BANNERS,
  readFileAsValidatedBase64,
  subscribeToAdminDocuments,
  subscribeToCompetitionRuns,
  triggerSafeDocumentDownload,
  updateSystemConfigAsAdmin,
  uploadAdminDocument,
  type AdminDocCategory,
  type AdminDocumentRecord,
  type AdminProfile,
  type BannerStage,
  type BannerStyle,
  type ChallengeBannerItem,
  type CompetitionRunRecord,
  type SystemConfigState,
} from '../firebase/adminService';
import {
  SPONSOR_SLOT_CATALOG,
  type SponsorSlotAssignment,
} from '../firebase/sponsorService';
import { SponsorReportPanel } from './SponsorReportPanel';
import { SponsorSlotManagerPanel } from './SponsorSlotManagerPanel';

interface AdminPortalProps {
  admin: AdminProfile;
  systemConfig: SystemConfigState;
  sponsorSlots: Record<string, SponsorSlotAssignment>;
  onLogout: () => void;
}

type AdminSectionTab = 'system' | 'sponsors' | 'reports';

const DOC_CATEGORIES: Array<{ id: AdminDocCategory; label: string }> = [
  { id: 'guide', label: 'Garden & El Niño Guide' },
  { id: 'rules', label: 'Competition Rules' },
  { id: 'curriculum', label: 'School Curriculum' },
  { id: 'notice', label: 'Admin Notice' },
];

export const AdminPortal: React.FC<AdminPortalProps> = ({
  admin,
  systemConfig,
  sponsorSlots,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<AdminSectionTab>('system');
  const [timerEnabled, setTimerEnabled] = useState(systemConfig.competitionTimerEnabled);
  const [compostLimit, setCompostLimit] = useState(systemConfig.compostYieldCycleLimit);
  const [solarDustLimit, setSolarDustLimit] = useState(systemConfig.solarDustYieldTriggerLimit);
  const [maxHarvestCap, setMaxHarvestCap] = useState(systemConfig.maxHarvestHoursCap);
  const [banners, setBanners] = useState<ChallengeBannerItem[]>(systemConfig.banners);
  const [newBannerText, setNewBannerText] = useState('');
  const [newBannerStyle, setNewBannerStyle] = useState<BannerStyle>('scroll');
  const [newBannerStage, setNewBannerStage] = useState<BannerStage>('all');
  const [previewBannerId, setPreviewBannerId] = useState<string | null>(null);

  const [savingConfig, setSavingConfig] = useState(false);
  const [configSavedNotice, setConfigSavedNotice] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [docs, setDocs] = useState<AdminDocumentRecord[]>([]);
  const [runs, setRuns] = useState<CompetitionRunRecord[]>([]);

  // Document upload form state
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<AdminDocCategory>('guide');
  const [docDesc, setDocDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docStatusMsg, setDocStatusMsg] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  useEffect(() => {
    setTimerEnabled(systemConfig.competitionTimerEnabled);
    setCompostLimit(systemConfig.compostYieldCycleLimit);
    setSolarDustLimit(systemConfig.solarDustYieldTriggerLimit);
    setMaxHarvestCap(systemConfig.maxHarvestHoursCap);
    setBanners(systemConfig.banners);
  }, [
    systemConfig.competitionTimerEnabled,
    systemConfig.compostYieldCycleLimit,
    systemConfig.solarDustYieldTriggerLimit,
    systemConfig.maxHarvestHoursCap,
    systemConfig.banners,
  ]);

  useEffect(() => {
    const unsubDocs = subscribeToAdminDocuments((items) => setDocs(items), false);
    const unsubRuns = subscribeToCompetitionRuns((items) => setRuns(items));
    return () => {
      unsubDocs();
      unsubRuns();
    };
  }, []);

  const persistConfig = async (
    nextTimer: boolean,
    nextLimit: number,
    nextBanners: ChallengeBannerItem[],
    successText: string,
    nextSolarLimit = solarDustLimit,
    nextMaxCap = maxHarvestCap
  ): Promise<boolean> => {
    setSavingConfig(true);
    setConfigError(null);
    setConfigSavedNotice(null);
    try {
      await updateSystemConfigAsAdmin({
        admin,
        competitionTimerEnabled: nextTimer,
        compostYieldCycleLimit: nextLimit,
        solarDustYieldTriggerLimit: nextSolarLimit,
        maxHarvestHoursCap: nextMaxCap,
        banners: nextBanners,
      });
      setConfigSavedNotice(successText);
      return true;
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save configuration.');
      return false;
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleTimerImmediate = async () => {
    const nextEnabled = !timerEnabled;
    setTimerEnabled(nextEnabled);
    const ok = await persistConfig(
      nextEnabled,
      compostLimit,
      banners,
      nextEnabled
        ? 'Competition Speed Timer ENABLED globally for all workshops.'
        : 'Competition Speed Timer PAUSED (grayed-out lock remains for students).'
    );
    if (!ok) {
      setTimerEnabled(!nextEnabled);
    }
  };

  const handleSaveAllConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistConfig(
      timerEnabled,
      compostLimit,
      banners,
      'Global challenge rules, solar dust trigger & harvest cycle settings synced live.',
      solarDustLimit,
      maxHarvestCap
    );
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = newBannerText.trim().slice(0, 180);
    if (cleanText.length < 2) {
      setConfigError('Please enter at least 2 characters for the banner blurb.');
      return;
    }
    if (banners.length >= MAX_ADMIN_BANNERS) {
      setConfigError(`Maximum ${MAX_ADMIN_BANNERS} banners allowed. Remove an old banner first.`);
      return;
    }
    const id = `bnr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const nextBanners: ChallengeBannerItem[] = [
      ...banners,
      {
        id,
        text: cleanText,
        style: newBannerStyle,
        stage: newBannerStage,
        active: true,
      },
    ];
    setBanners(nextBanners);
    setNewBannerText('');
    const ok = await persistConfig(
      timerEnabled,
      compostLimit,
      nextBanners,
      `Added banner (${newBannerStyle === 'scroll' ? 'Scroll Across' : 'Flash'}) — pops up 1 min every 2 min.`
    );
    if (!ok) {
      setBanners(banners);
    }
  };

  const handleToggleBannerActive = async (id: string) => {
    const nextBanners = banners.map((b) => (b.id === id ? { ...b, active: !b.active } : b));
    setBanners(nextBanners);
    const ok = await persistConfig(timerEnabled, compostLimit, nextBanners, 'Updated banner visibility.');
    if (!ok) setBanners(banners);
  };

  const handleToggleBannerStyle = async (id: string) => {
    const nextBanners: ChallengeBannerItem[] = banners.map((b) =>
      b.id === id ? { ...b, style: b.style === 'scroll' ? 'flash' : 'scroll' } : b
    );
    setBanners(nextBanners);
    const ok = await persistConfig(timerEnabled, compostLimit, nextBanners, 'Switched banner animation mode.');
    if (!ok) setBanners(banners);
  };

  const handleRemoveBanner = async (id: string) => {
    const nextBanners = banners.filter((b) => b.id !== id);
    setBanners(nextBanners);
    if (previewBannerId === id) setPreviewBannerId(null);
    const ok = await persistConfig(timerEnabled, compostLimit, nextBanners, 'Banner deleted.');
    if (!ok) setBanners(banners);
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setDocError('Please choose a file to upload (PDF, TXT, MD, CSV, JSON, PNG, JPG, WEBP up to 400 KB).');
      return;
    }
    setUploadingDoc(true);
    setDocError(null);
    setDocStatusMsg(null);
    try {
      const encoded = await readFileAsValidatedBase64(selectedFile);
      await uploadAdminDocument({
        admin,
        title: docTitle || encoded.fileName,
        description: docDesc,
        category: docCategory,
        ...encoded,
      });
      setDocTitle('');
      setDocDesc('');
      setSelectedFile(null);
      setDocStatusMsg(`Uploaded "${encoded.fileName}" — now live for Students & Parents.`);
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleArchiveDoc = async (item: AdminDocumentRecord) => {
    setDocError(null);
    try {
      await archiveAdminDocument({ admin, docItem: item });
      setDocStatusMsg(`Removed "${item.title}" from student & parent view.`);
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Unable to remove document.');
    }
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950 text-slate-100">
      {/* Top South African Palette Accent Bar */}
      <div className="h-2 w-full flex" aria-hidden="true">
        <div className="flex-1 bg-[#E03C31]" />
        <div className="flex-1 bg-[#FFB81C]" />
        <div className="flex-1 bg-[#007749]" />
        <div className="flex-1 bg-[#001489]" />
      </div>

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-extrabold text-white">
                Game X Africa · Admin Control Center
              </p>
              <p className="text-xs text-emerald-400 font-mono">
                Signed in as {admin.adminName}
                {admin.isFirstClaim ? ' (Primary Admin Claimed)' : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:border-rose-500/60 hover:text-rose-200 px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Admin Sub-Navigation Bar */}
        <div className="border-t border-slate-800/90 bg-slate-950/75">
          <div className="mx-auto max-w-6xl px-4 sm:px-8 py-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>System, Banners &amp; Docs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sponsors')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'sponsors'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-amber-200 border border-amber-500/35 hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>
                Sponsor Slot Manager (
                {SPONSOR_SLOT_CATALOG.filter((s) => sponsorSlots[s.slotId]?.active).length}/
                {SPONSOR_SLOT_CATALOG.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-900 text-sky-200 border border-sky-500/35 hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Sponsor CSV Reports</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-8 py-6 space-y-6">
        {activeTab === 'sponsors' ? (
          <SponsorSlotManagerPanel admin={admin} sponsorSlots={sponsorSlots} />
        ) : activeTab === 'reports' ? (
          <SponsorReportPanel
            sponsorSlots={sponsorSlots}
            viewerRole="admin"
            competitionRuns={runs}
          />
        ) : (
        <>
        {/* Top Row: Competition Timer Switch + Compost & Banner Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Competition Speed Timer Control (Unlocked ONLY for Admin) */}
          <section className="rounded-2xl bg-slate-900/90 border border-emerald-500/35 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-amber-300 text-xs font-mono uppercase tracking-wider font-bold">
                  <Timer className="w-4 h-4" />
                  <span>Admin-Only Control</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">
                  Competition Speed Timer
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Students see this toggle grayed out &amp; locked. Only Admin can turn live speed-run timing ON or OFF across all connected classrooms.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={timerEnabled}
                disabled={savingConfig}
                onClick={handleToggleTimerImmediate}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                  timerEnabled
                    ? 'bg-emerald-600 border-emerald-400'
                    : 'bg-slate-800 border-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                    timerEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between ${
                timerEnabled
                  ? 'bg-emerald-950/60 border-emerald-500/45 text-emerald-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <span>
                Status: {timerEnabled ? 'LIVE COMPETITION ACTIVE' : 'LOCKED / STANDARD PRACTICE'}
              </span>
              <span className="font-mono text-[11px]">
                {runs.length} recorded run{runs.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Fastest Competition Runs */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Fastest Student Completion Leaderboard</span>
              </div>
              {runs.length === 0 ? (
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-500">
                  No competition speed runs recorded yet. Toggle Competition Timer ON when ready to start timing students.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {runs.map((run, idx) => (
                    <div
                      key={run.runId}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-amber-300 mr-2">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-white">{run.farmerName}</span>
                        <span className="text-slate-400 ml-1.5">
                          ({run.grade} · {run.milestoneLabel})
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-300 tabular-nums shrink-0">
                        {formatStopwatchMs(run.elapsedMs)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Garden Rules & Compost Refresh Cycle Configuration */}
          <form
            onSubmit={handleSaveAllConfig}
            className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-wider font-bold">
              <Recycle className="w-4 h-4" />
              <span>Compost Lifecycle &amp; Global Rules</span>
            </div>

            <div>
              <label
                htmlFor="compost-yield-limit"
                className="block text-xs font-semibold text-slate-200 mb-1"
              >
                Yields Before Fresh Compost Required:{' '}
                <span className="text-amber-300 font-mono font-bold">
                  Every {compostLimit} Yield{compostLimit === 1 ? '' : 's'}
                </span>
              </label>
              <input
                id="compost-yield-limit"
                type="range"
                min={1}
                max={10}
                value={compostLimit}
                onChange={(e) => setCompostLimit(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <label
                htmlFor="solar-dust-limit"
                className="block text-xs font-semibold text-slate-200 mb-1"
              >
                Yields Before Room 4 Solar Dust Maintenance:{' '}
                <span className="text-amber-300 font-mono font-bold">
                  Every {solarDustLimit} Yield{solarDustLimit === 1 ? '' : 's'}
                </span>
              </label>
              <input
                id="solar-dust-limit"
                type="range"
                min={1}
                max={10}
                value={solarDustLimit}
                onChange={(e) => setSolarDustLimit(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <label
                htmlFor="max-harvest-cap"
                className="block text-xs font-semibold text-slate-200 mb-1"
              >
                Max Harvest Cycle Cap:{' '}
                <span className="text-sky-300 font-mono font-bold">
                  {maxHarvestCap}h (24h Standard Max)
                </span>
              </label>
              <input
                id="max-harvest-cap"
                type="range"
                min={12}
                max={24}
                value={maxHarvestCap}
                onChange={(e) => setMaxHarvestCap(Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>

            <p className="text-[11px] text-slate-400">
              After {compostLimit} yield{compostLimit === 1 ? '' : 's'}, learners refresh compost in Door 3. After {solarDustLimit} yield{solarDustLimit === 1 ? '' : 's'}, El Niño dust triggers Room 4 solar cleaning &amp; tilt calibration.
            </p>

            {configSavedNotice && (
              <div className="rounded-xl bg-emerald-950/60 border border-emerald-500/45 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{configSavedNotice}</span>
              </div>
            )}

            {configError && (
              <p className="text-xs text-rose-400 font-medium">{configError}</p>
            )}

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2.5 px-4 text-sm font-semibold cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{savingConfig ? 'Saving Changes...' : 'Save Global Rules & Thresholds'}</span>
            </button>
          </form>
        </div>

        {/* Middle Row: Multi-Banner Stage Scheduler (1-min blurb every 2 min, Scroll or Flash) */}
        <section className="rounded-2xl bg-slate-900/90 border border-amber-500/35 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-amber-300 text-xs font-mono uppercase tracking-wider font-bold">
                <Megaphone className="w-4 h-4" />
                <span>Intermittent Stage Banners · 1-Min Blurb Every 2 Min</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                Broadcast Banners Across Game Stages ({banners.length}/{MAX_ADMIN_BANNERS})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Add different banners for Kitchen, Garden, Compost, Harvest Ready, or Compost Refresh alerts. Active banners pop up for 1 minute every 2 minutes as learners play.
              </p>
            </div>
          </div>

          {/* Live Admin Preview Strip */}
          {previewBannerId && (() => {
            const preview = banners.find((b) => b.id === previewBannerId);
            if (!preview) return null;
            return (
              <div className="rounded-xl border border-amber-400/50 bg-slate-950 p-3 overflow-hidden space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-amber-300">
                  <span>PREVIEW ({preview.style === 'scroll' ? 'RUN ACROSS SCREEN' : 'FLASH SPOTLIGHT'})</span>
                  <button
                    type="button"
                    onClick={() => setPreviewBannerId(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>
                {preview.style === 'scroll' ? (
                  <div className="overflow-hidden rounded-lg bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950 border border-amber-400/40 py-2">
                    <div className="animate-banner-marquee text-xs font-bold text-amber-200 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span>{preview.text}</span>
                    </div>
                  </div>
                ) : (
                  <div className="animate-banner-flash rounded-lg bg-slate-900 border-2 border-amber-400 px-4 py-2 text-center text-xs font-bold text-amber-200">
                    {preview.text}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Add Banner Form */}
            <form onSubmit={handleAddBanner} className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3">
              <div>
                <label htmlFor="new-banner-text" className="block text-xs font-medium text-slate-300 mb-1">
                  Banner Blurb Message
                </label>
                <input
                  id="new-banner-text"
                  type="text"
                  maxLength={180}
                  value={newBannerText}
                  onChange={(e) => setNewBannerText(e.target.value)}
                  placeholder="e.g. Tip: Check your JoJo tank before the 38°C Heatwave hits!"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-banner-stage" className="block text-xs font-medium text-slate-300 mb-1">
                    Target Game Stage
                  </label>
                  <select
                    id="new-banner-stage"
                    value={newBannerStage}
                    onChange={(e) => setNewBannerStage(e.target.value as BannerStage)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {BANNER_STAGE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Animation Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewBannerStyle('scroll')}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                        newBannerStyle === 'scroll'
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      Run Across
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBannerStyle('flash')}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                        newBannerStyle === 'flash'
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      Flash
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingConfig || newBannerText.trim().length < 2 || banners.length >= MAX_ADMIN_BANNERS}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 py-2.5 px-4 text-sm font-bold cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Banner to Rotation</span>
              </button>
            </form>

            {/* Configured Banners List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Active &amp; Scheduled Banners ({banners.length})
              </h3>
              {banners.length === 0 ? (
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 text-xs text-slate-500">
                  No banners added yet. Add one or more banners on the left—each will display for 1 minute every 2 minutes during matching gameplay stages.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {banners.map((b) => {
                    const stageLabel =
                      BANNER_STAGE_OPTIONS.find((s) => s.id === b.stage)?.label ?? b.stage;
                    return (
                      <div
                        key={b.id}
                        className={`rounded-xl border p-3 flex flex-col gap-2 ${
                          b.active
                            ? 'bg-slate-950 border-amber-500/35'
                            : 'bg-slate-950/60 border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-white leading-snug">
                            {b.text}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewBannerId(b.id)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-sky-300 cursor-pointer"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              disabled={savingConfig}
                              onClick={() => handleRemoveBanner(b.id)}
                              title="Delete banner"
                              className="p-1.5 rounded bg-slate-900 hover:bg-rose-700 text-rose-300 border border-slate-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            {stageLabel}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={savingConfig}
                              onClick={() => handleToggleBannerStyle(b.id)}
                              className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer"
                            >
                              Mode: {b.style === 'scroll' ? 'Run Across' : 'Flash'}
                            </button>
                            <button
                              type="button"
                              disabled={savingConfig}
                              onClick={() => handleToggleBannerActive(b.id)}
                              className={`px-2 py-0.5 rounded border cursor-pointer ${
                                b.active
                                  ? 'bg-emerald-600/25 text-emerald-200 border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {b.active ? 'ON' : 'PAUSED'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Bottom Row: Upload & Manage Challenge Documents */}
        <section className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-sky-400 text-xs font-mono uppercase tracking-wider font-bold">
              <FileText className="w-4 h-4" />
              <span>Curriculum, Rules &amp; Resource Documents</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Upload Documents for Students &amp; Parents
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload PDFs, text guides, CSV sheets, or diagrams (up to 400 KB each). Published files appear immediately under Guides &amp; Docs.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Form */}
            <form onSubmit={handleUploadDoc} className="space-y-3 rounded-xl bg-slate-950 border border-slate-800 p-4">
              <div>
                <label htmlFor="doc-title-input" className="block text-xs font-medium text-slate-300 mb-1">
                  Document Title
                </label>
                <input
                  id="doc-title-input"
                  type="text"
                  maxLength={120}
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Grade 7 El Niño Compost Worksheet"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label htmlFor="doc-category-select" className="block text-xs font-medium text-slate-300 mb-1">
                  Category
                </label>
                <select
                  id="doc-category-select"
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as AdminDocCategory)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  {DOC_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="doc-desc-input" className="block text-xs font-medium text-slate-300 mb-1">
                  Summary Note (Optional)
                </label>
                <input
                  id="doc-desc-input"
                  type="text"
                  maxLength={300}
                  value={docDesc}
                  onChange={(e) => setDocDesc(e.target.value)}
                  placeholder="Short instructions for learners or teachers"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label htmlFor="doc-file-input" className="block text-xs font-medium text-slate-300 mb-1">
                  Choose File (PDF, TXT, MD, CSV, JSON, PNG, JPG, WEBP · Max 400 KB)
                </label>
                <input
                  id="doc-file-input"
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-sky-500 cursor-pointer"
                />
                {selectedFile && (
                  <p className="mt-1 text-[11px] font-mono text-sky-300">
                    Selected: {selectedFile.name} ({Math.max(1, Math.round(selectedFile.size / 1024))} KB)
                  </p>
                )}
              </div>

              {docStatusMsg && (
                <p className="text-xs text-emerald-300 font-medium">{docStatusMsg}</p>
              )}
              {docError && (
                <p className="text-xs text-rose-400 font-medium">{docError}</p>
              )}

              <button
                type="submit"
                disabled={uploadingDoc || !selectedFile}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2.5 px-4 text-sm font-semibold cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>{uploadingDoc ? 'Uploading...' : 'Publish Document'}</span>
              </button>
            </form>

            {/* Published Documents List */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Published Documents ({docs.length})
              </h3>
              {docs.length === 0 ? (
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 text-xs text-slate-500">
                  No documents published yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {docs.map((item) => (
                    <div
                      key={item.docId}
                      className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            {item.category}
                          </span>
                          <span className="text-xs font-bold text-white truncate">
                            {item.title}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-slate-400 mt-1">{item.description}</p>
                        )}
                        <p className="text-[10px] font-mono text-slate-500 mt-1">
                          {item.fileName} · {Math.max(1, Math.round(item.sizeBytes / 1024))} KB
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => triggerSafeDocumentDownload(item)}
                          title="Download document"
                          className="p-2 rounded-lg bg-slate-900 hover:bg-sky-700 text-sky-300 border border-slate-700 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchiveDoc(item)}
                          title="Remove document"
                          className="p-2 rounded-lg bg-slate-900 hover:bg-rose-700 text-rose-300 border border-slate-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
        </>
        )}
      </main>
    </div>
  );
};
