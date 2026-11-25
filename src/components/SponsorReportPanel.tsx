import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Users,
} from 'lucide-react';
import {
  subscribeToCompetitionRuns,
  type CompetitionRunRecord,
} from '../firebase/adminService';
import {
  buildLeaderboardSnapshot,
  KG_PER_HARVEST_UNIT,
  subscribeToGradeSaleEvents,
  subscribeToLeaderboardStudents,
  type GradeSaleEventRecord,
  type LeaderboardStudentRecord,
} from '../firebase/leaderboardService';
import {
  SPONSOR_REPORT_DEFINITIONS,
  buildSponsorCsvContent,
  triggerCsvDownload,
  type SponsorCsvReportKind,
} from '../firebase/sponsorReportService';
import {
  SPONSOR_SLOT_CATALOG,
  type SponsorSlotAssignment,
} from '../firebase/sponsorService';
import {
  subscribeToHarvestBatches,
  subscribeToStoreListings,
  type HarvestBatch,
  type StoreListing,
} from '../firebase/storeService';

interface SponsorReportPanelProps {
  sponsorSlots: Record<string, SponsorSlotAssignment>;
  viewerRole: 'parent' | 'sponsor' | 'admin' | 'teacher' | 'family';
  harvestBatches?: HarvestBatch[];
  storeListings?: StoreListing[];
  competitionRuns?: CompetitionRunRecord[];
}

export const SponsorReportPanel: React.FC<SponsorReportPanelProps> = ({
  sponsorSlots,
  viewerRole,
  harvestBatches: providedBatches,
  storeListings: providedListings,
  competitionRuns: providedRuns,
}) => {
  const [selectedKind, setSelectedKind] =
    useState<SponsorCsvReportKind>('school_grade_impact');
  const [downloadedNotice, setDownloadedNotice] = useState<string | null>(null);

  const [students, setStudents] = useState<LeaderboardStudentRecord[]>([]);
  const [saleEvents, setSaleEvents] = useState<GradeSaleEventRecord[]>([]);
  const [fetchedBatches, setFetchedBatches] = useState<HarvestBatch[]>([]);
  const [fetchedListings, setFetchedListings] = useState<StoreListing[]>([]);
  const [fetchedRuns, setFetchedRuns] = useState<CompetitionRunRecord[]>([]);

  useEffect(() => {
    const unsubStudents = subscribeToLeaderboardStudents((rows) => setStudents(rows));
    const unsubSales = subscribeToGradeSaleEvents((rows) => setSaleEvents(rows));
    const unsubBatches = providedBatches
      ? null
      : subscribeToHarvestBatches((rows) => setFetchedBatches(rows));
    const unsubListings = providedListings
      ? null
      : subscribeToStoreListings((rows) => setFetchedListings(rows));
    const unsubRuns = providedRuns
      ? null
      : subscribeToCompetitionRuns((rows) => setFetchedRuns(rows));

    return () => {
      unsubStudents();
      unsubSales();
      unsubBatches?.();
      unsubListings?.();
      unsubRuns?.();
    };
  }, [Boolean(providedBatches), Boolean(providedListings), Boolean(providedRuns)]);

  const activeBatches = providedBatches ?? fetchedBatches;
  const activeListings = providedListings ?? fetchedListings;
  const activeRuns = providedRuns ?? fetchedRuns;

  const snapshot = useMemo(
    () =>
      buildLeaderboardSnapshot({
        students,
        batches: activeBatches,
        saleEvents,
        storeListings: activeListings,
      }),
    [students, activeBatches, saleEvents, activeListings]
  );

  const activeDef =
    SPONSOR_REPORT_DEFINITIONS.find((d) => d.id === selectedKind) ??
    SPONSOR_REPORT_DEFINITIONS[0];

  const occupiedSlotCount = useMemo(
    () =>
      SPONSOR_SLOT_CATALOG.filter((item) => Boolean(sponsorSlots[item.slotId]?.active)).length,
    [sponsorSlots]
  );

  const handleDownloadCsv = (kind: SponsorCsvReportKind) => {
    const { filename, csv, rowCount } = buildSponsorCsvContent({
      kind,
      snapshot,
      batches: activeBatches,
      saleEvents,
      storeListings: activeListings,
      competitionRuns: activeRuns,
      sponsorSlots,
    });
    triggerCsvDownload(filename, csv);
    setDownloadedNotice(
      `Downloaded ${filename} (${rowCount} data row${rowCount === 1 ? '' : 's'}, UTF-8 Excel ready).`
    );
  };

  return (
    <div className="space-y-5">
      {/* Intro & In-Game Impact Model Explanation */}
      <section className="rounded-2xl border border-slate-700/70 bg-slate-900 p-5 text-slate-100 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider font-bold text-amber-300">
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {viewerRole === 'sponsor'
                  ? 'Corporate Sponsor ESG & ROI Portal'
                  : viewerRole === 'admin'
                    ? 'Admin Sponsor Export Center'
                    : 'Community Sponsor & Impact CSV Center'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white mt-1">
              Live Impact Telemetry &amp; Downloadable CSV Reports
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Download verified spreadsheet exports connecting student in-game hydroponic builds, crop yields, Parent/Sponsor Karri produce purchases, and active 3D brand placements — 100% POPIA compliant with zero pupil surnames or personal emails.
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3 py-1.5 text-xs font-bold text-emerald-300 shrink-0">
            <ShieldCheck className="w-4 h-4" />
            <span>POPIA Safe Exports</span>
          </span>
        </div>

        {/* Live Telemetry Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Grouped Schools</span>
            </div>
            <div className="mt-1 text-xl font-extrabold font-mono text-white tabular-nums">
              {snapshot.groupedSchools.length}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Learners</span>
            </div>
            <div className="mt-1 text-xl font-extrabold font-mono text-white tabular-nums">
              {snapshot.rankedStudents.length}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span>Combined Yield</span>
            </div>
            <div className="mt-1 text-lg sm:text-xl font-extrabold font-mono text-emerald-300 tabular-nums truncate">
              {snapshot.totalMassAllLabel}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400">
              <ShoppingBag className="w-3.5 h-3.5 text-sky-400" />
              <span>Store Sales · Slots</span>
            </div>
            <div className="mt-1 text-lg sm:text-xl font-extrabold font-mono text-sky-300 tabular-nums">
              R{snapshot.totalProduceSalesZar.toFixed(0)} · {occupiedSlotCount}/
              {SPONSOR_SLOT_CATALOG.length}
            </div>
          </div>
        </div>
      </section>

      {downloadedNotice && (
        <div className="rounded-xl border border-emerald-500/45 bg-emerald-950/90 px-4 py-3 text-xs font-semibold text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{downloadedNotice}</span>
        </div>
      )}

      {/* 3 Selectable CSV Report Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {SPONSOR_REPORT_DEFINITIONS.map((def) => {
          const isSelected = def.id === selectedKind;
          return (
            <div
              key={def.id}
              className={`rounded-2xl border p-4 flex flex-col justify-between gap-4 transition-colors ${
                isSelected
                  ? 'bg-slate-900 border-emerald-400 text-white shadow-md'
                  : 'bg-slate-900/85 border-slate-800 text-slate-200 hover:border-slate-600'
              }`}
            >
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                  {def.audience}
                </div>
                <h3 className="text-base font-extrabold text-white mt-1">{def.title}</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{def.summary}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleDownloadCsv(def.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKind(def.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  {isSelected ? 'Guide Open' : 'View Guide'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview Table + Walkthrough Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Understand Your CSV Report Guide */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-100 space-y-4">
          <div className="flex items-center gap-2 text-sky-300 text-xs font-mono uppercase tracking-wider font-bold">
            <BookOpen className="w-4 h-4" />
            <span>Understand Your CSV Report</span>
          </div>
          <h3 className="text-base font-extrabold text-white">{activeDef.title}</h3>

          <div className="space-y-2.5">
            {activeDef.columnsGuide.map((col) => (
              <div
                key={col.columnName}
                className="rounded-xl bg-slate-950 border border-slate-800 p-3"
              >
                <div className="text-xs font-mono font-bold text-emerald-300">
                  {col.columnName}
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{col.meaning}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-amber-500/35 bg-amber-950/30 p-3.5 text-xs text-amber-100 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Info className="w-4 h-4 shrink-0" />
              <span>How In-Game Activity Translates To Sponsor Proof</span>
            </div>
            <p className="leading-relaxed text-amber-100/90">
              Because real seedlings take ~90 days in soil, learners keep daily momentum by growing 10 hydroponic crops, defending racks against El Niño heat/storms, and feeding Sanctuary Pets. Every in-game harvest ({KG_PER_HARVEST_UNIT} kg impact unit) immediately stocks the Parent Store — creating auditable participation &amp; school-by-grade CSV metrics without needing children to log physical tasks manually.
            </p>
          </div>
        </section>

        {/* RIGHT: Live Preview Rows + Harvest-to-Store Pipeline Blueprint */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-100 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-white">
                Live Preview: {activeDef.title}
              </h3>
              <p className="text-xs text-slate-400">
                Real-time Firestore records included when you click Download CSV
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDownloadCsv(selectedKind)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Now</span>
            </button>
          </div>

          {selectedKind === 'school_grade_impact' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                    <th className="py-2.5 px-3">School (Grouped)</th>
                    <th className="py-2.5 px-3">Grade / Rollup</th>
                    <th className="py-2.5 px-3 text-right">Learners</th>
                    <th className="py-2.5 px-3">Produce Grown</th>
                    <th className="py-2.5 px-3 text-right">Harvest Mass</th>
                    <th className="py-2.5 px-3 text-right">Sales (ZAR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {snapshot.groupedSchools.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 px-3 text-center text-slate-500">
                        Waiting for first school harvest or learner session.
                      </td>
                    </tr>
                  ) : (
                    snapshot.groupedSchools.slice(0, 5).flatMap((sch) => [
                      ...sch.grades.slice(0, 3).map((g) => (
                        <tr key={`${sch.canonicalSchoolId}_${g.grade}`}>
                          <td className="py-2 px-3 font-semibold text-white">
                            {sch.canonicalSchoolName}
                          </td>
                          <td className="py-2 px-3 text-slate-200">{g.grade}</td>
                          <td className="py-2 px-3 text-right font-mono">{g.studentCount}</td>
                          <td className="py-2 px-3 text-slate-300">
                            {g.producedItems.length > 0
                              ? g.producedItems
                                  .slice(0, 3)
                                  .map((p) => `${p.title} (${p.units})`)
                                  .join(', ')
                              : 'Growing'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-300">
                            {g.harvestMassLabel}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-sky-300">
                            R{g.salesZar.toFixed(2)}
                          </td>
                        </tr>
                      )),
                      <tr
                        key={`${sch.canonicalSchoolId}_total`}
                        className="bg-slate-900/70 font-bold"
                      >
                        <td className="py-2 px-3 text-amber-300">{sch.canonicalSchoolName}</td>
                        <td className="py-2 px-3 text-amber-200">
                          School Total ({sch.grades.length} gr)
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{sch.studentCount}</td>
                        <td className="py-2 px-3 text-slate-400">Combined</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-300">
                          {sch.massLabel}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-sky-300">
                          R{sch.totalSalesZar.toFixed(2)}
                        </td>
                      </tr>,
                    ])
                  )}
                </tbody>
              </table>
            </div>
          )}

          {selectedKind === 'harvest_batches_ledger' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                    <th className="py-2.5 px-3">Learner Alias</th>
                    <th className="py-2.5 px-3">School · Grade</th>
                    <th className="py-2.5 px-3">Crop / Compost Item</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {activeBatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 px-3 text-center text-slate-500">
                        No harvest batches logged yet.
                      </td>
                    </tr>
                  ) : (
                    activeBatches.slice(0, 8).map((b) => (
                      <tr key={b.batchId}>
                        <td className="py-2 px-3 font-semibold text-white">{b.studentName}</td>
                        <td className="py-2 px-3 text-slate-300">
                          {b.schoolName} · {b.grade}
                        </td>
                        <td className="py-2 px-3 text-emerald-300">{b.itemTitle}</td>
                        <td className="py-2 px-3 text-right font-mono">{b.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-400">
                          {new Date(b.harvestedAtMs).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {selectedKind === 'sponsor_roi_inventory' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                    <th className="py-2.5 px-3">Room</th>
                    <th className="py-2.5 px-3">Placement Slot</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Assigned Brand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {SPONSOR_SLOT_CATALOG.slice(0, 12).map((item) => {
                    const assigned = sponsorSlots[item.slotId];
                    const isLive = Boolean(assigned?.active);
                    return (
                      <tr key={item.slotId}>
                        <td className="py-2 px-3 font-mono text-slate-400 uppercase">
                          {item.room}
                        </td>
                        <td className="py-2 px-3 font-semibold text-white">{item.label}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                              isLive
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isLive ? 'SPONSORED' : 'OPEN'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-amber-300">
                          {isLive
                            ? `${assigned?.partnerName || 'Logo Only'} (${assigned?.displayMode})`
                            : item.defaultPartnerName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Blueprint: Harvest -> Shop Availability Flow */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
            <div className="text-[11px] font-mono uppercase tracking-wider font-bold text-emerald-400 mb-2">
              Harvest-to-Shop Availability Blueprint
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 font-semibold text-white">
                1. Student Harvests Tier / Compost
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 font-semibold text-sky-300">
                2. Atomic Stock Added (store_listings)
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 font-semibold text-amber-300">
                3. Parent Feeds Pet · ZAR Credited to Grade
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
