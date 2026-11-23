import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Building2,
  GraduationCap,
  Layers,
  Scale,
  Search,
  ShoppingBag,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { SCHOOL_GRADES } from '../firebase/firebaseClient';
import {
  buildLeaderboardSnapshot,
  KG_PER_HARVEST_UNIT,
  subscribeToGradeSaleEvents,
  subscribeToLeaderboardStudents,
  type GradeSaleEventRecord,
  type LeaderboardStudentRecord,
} from '../firebase/leaderboardService';
import {
  subscribeToHarvestBatches,
  subscribeToStoreListings,
  type HarvestBatch,
  type StoreListing,
} from '../firebase/storeService';

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
  viewerRole: 'student' | 'parent';
  currentStudentUid?: string;
  currentSchoolName?: string;
  currentGrade?: string;
  currentGrades?: string[];
  harvestBatches?: HarvestBatch[];
  storeListings?: StoreListing[];
}

type LeaderboardTab = 'students' | 'schools';

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  open,
  onClose,
  viewerRole,
  currentStudentUid,
  currentSchoolName,
  currentGrade,
  currentGrades,
  harvestBatches: providedBatches,
  storeListings: providedListings,
}) => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('students');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');

  const [students, setStudents] = useState<LeaderboardStudentRecord[]>([]);
  const [saleEvents, setSaleEvents] = useState<GradeSaleEventRecord[]>([]);
  const [fetchedBatches, setFetchedBatches] = useState<HarvestBatch[]>([]);
  const [fetchedListings, setFetchedListings] = useState<StoreListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    let settledStudents = false;
    let settledSales = false;

    const markReady = () => {
      if (active && settledStudents && settledSales) {
        setLoading(false);
      }
    };

    const unsubStudents = subscribeToLeaderboardStudents((rows) => {
      if (!active) return;
      setStudents(rows);
      settledStudents = true;
      markReady();
    });

    const unsubSales = subscribeToGradeSaleEvents((rows) => {
      if (!active) return;
      setSaleEvents(rows);
      settledSales = true;
      markReady();
    });

    const unsubBatches = providedBatches
      ? null
      : subscribeToHarvestBatches((rows) => {
          if (active) setFetchedBatches(rows);
        });

    const unsubListings = providedListings
      ? null
      : subscribeToStoreListings((rows) => {
          if (active) setFetchedListings(rows);
        });

    return () => {
      active = false;
      unsubStudents();
      unsubSales();
      unsubBatches?.();
      unsubListings?.();
    };
  }, [open, Boolean(providedBatches), Boolean(providedListings)]);

  const activeBatches = providedBatches ?? fetchedBatches;
  const activeListings = providedListings ?? fetchedListings;

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

  const viewerCluster = useMemo(() => {
    if (!currentSchoolName) return null;
    return snapshot.resolveSchoolCluster(currentSchoolName);
  }, [snapshot, currentSchoolName]);

  const currentStudentEntry = useMemo(() => {
    if (!currentStudentUid) return null;
    return (
      snapshot.rankedStudents.find((entry) => entry.studentUid === currentStudentUid) ?? null
    );
  }, [snapshot.rankedStudents, currentStudentUid]);

  const viewerSchoolSummary = useMemo(() => {
    if (!viewerCluster) return null;
    return (
      snapshot.groupedSchools.find(
        (sch) => sch.canonicalSchoolId === viewerCluster.clusterId
      ) ?? null
    );
  }, [snapshot.groupedSchools, viewerCluster]);

  const normalizedQuery = searchTerm.trim().toLowerCase();

  const filteredStudents = useMemo(() => {
    return snapshot.rankedStudents.filter((row) => {
      if (selectedSchoolId !== 'all' && row.canonicalSchoolId !== selectedSchoolId) {
        return false;
      }
      if (selectedGrade !== 'all' && row.grade !== selectedGrade) {
        return false;
      }
      if (normalizedQuery) {
        const hay =
          `${row.studentName} ${row.canonicalSchoolName} ${row.rawSchoolName} ${row.grade}`.toLowerCase();
        if (!hay.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [snapshot.rankedStudents, selectedSchoolId, selectedGrade, normalizedQuery]);

  const filteredSchools = useMemo(() => {
    return snapshot.groupedSchools.filter((sch) => {
      if (selectedSchoolId !== 'all' && sch.canonicalSchoolId !== selectedSchoolId) {
        return false;
      }
      if (selectedGrade !== 'all') {
        const hasGrade = sch.grades.some((g) => g.grade === selectedGrade);
        if (!hasGrade) return false;
      }
      if (normalizedQuery) {
        const hay =
          `${sch.canonicalSchoolName} ${sch.matchedVariants.join(' ')}`.toLowerCase();
        if (!hay.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [snapshot.groupedSchools, selectedSchoolId, selectedGrade, normalizedQuery]);

  useEffect(() => {
    if (!open) return;
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore if pointer lock exit fails
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const formatZar = (val: number) =>
    `R${val.toLocaleString('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game X Africa Live Harvest and Grade Sales Leaderboard"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') e.stopPropagation();
      }}
      onKeyUp={(e) => {
        if (e.key !== 'Escape') e.stopPropagation();
      }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-hidden"
    >
      {/* Top South African Flag-Inspired Accent Bar */}
      <div className="h-1.5 w-full flex shrink-0" aria-hidden="true">
        <div className="flex-1 bg-[#E03C31]" />
        <div className="flex-1 bg-[#FFB81C]" />
        <div className="flex-1 bg-[#007749]" />
        <div className="flex-1 bg-[#001489]" />
      </div>

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-3 sm:px-6 shrink-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
                Game X Africa · Harvest &amp; Grade Sales Leaderboard
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Live rankings, smart school grouping ({KG_PER_HARVEST_UNIT} kg produce equiv. per unit), and store sales per grade
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              role="tablist"
              aria-label="Leaderboard View Mode"
              className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'students'}
                onClick={() => setActiveTab('students')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'students'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Award className="h-3.5 w-3.5" />
                <span>Student Rankings</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'schools'}
                onClick={() => setActiveTab('schools')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'schools'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Schools &amp; Grade Sales</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Leaderboard"
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs sm:text-sm font-bold text-white hover:bg-slate-700 cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-7xl space-y-4">
          {/* Global Totals Band */}
          <section
            aria-label="Leaderboard Overview Totals"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                <span>Ranked Students</span>
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-extrabold text-white font-mono tabular-nums">
                {snapshot.rankedStudents.length}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <Building2 className="h-3.5 w-3.5 text-amber-300" />
                <span>Grouped Schools</span>
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-extrabold text-white font-mono tabular-nums">
                {snapshot.groupedSchools.length}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <Scale className="h-3.5 w-3.5 text-emerald-400" />
                <span>Combined Harvest</span>
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-extrabold text-emerald-300 font-mono tabular-nums">
                {snapshot.totalMassAllLabel}
              </div>
              <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                {snapshot.totalHarvestUnitsAll.toLocaleString('en-ZA')} harvest units
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <ShoppingBag className="h-3.5 w-3.5 text-sky-400" />
                <span>Grade Produce Sales</span>
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-extrabold text-sky-300 font-mono tabular-nums">
                {formatZar(snapshot.totalProduceSalesZar)}
              </div>
              {snapshot.careBundleSalesZar > 0 && (
                <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                  + {formatZar(snapshot.careBundleSalesZar)} Sanctuary Pantry
                </div>
              )}
            </div>
          </section>

          {/* Personalized Spotlight Banner (Student or Parent) */}
          {viewerRole === 'student' && currentStudentEntry && (
            <section
              aria-label="Your Leaderboard Standing"
              className="rounded-xl border border-emerald-500/45 bg-slate-900 px-4 py-3.5 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Your Live Position
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl font-extrabold font-mono text-amber-300 tabular-nums">
                    #{currentStudentEntry.position}
                  </span>
                  <span className="text-base font-bold text-white">
                    {currentStudentEntry.studentName}
                  </span>
                  <span className="text-xs font-mono text-slate-300">
                    {currentStudentEntry.grade} · {currentStudentEntry.canonicalSchoolName}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 text-right">
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Your Harvest
                  </div>
                  <div className="text-sm font-bold font-mono text-emerald-300 tabular-nums">
                    {currentStudentEntry.totalHarvestUnits} units · {currentStudentEntry.massLabel}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    School Combined
                  </div>
                  <div className="text-sm font-bold font-mono text-white tabular-nums">
                    {currentStudentEntry.schoolMassLabel}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    {currentStudentEntry.grade} Sales
                  </div>
                  <div className="text-sm font-bold font-mono text-sky-300 tabular-nums">
                    {formatZar(currentStudentEntry.gradeSalesZar)}
                  </div>
                </div>
              </div>
            </section>
          )}

          {viewerRole === 'parent' && viewerSchoolSummary && (
            <section
              aria-label="Your Linked School Standing"
              className="rounded-xl border border-sky-500/45 bg-slate-900 px-4 py-3.5 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                  Your Linked School Group
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-base font-extrabold text-white">
                    {viewerSchoolSummary.canonicalSchoolName}
                  </span>
                  <span className="text-xs font-mono text-slate-300 tabular-nums">
                    {viewerSchoolSummary.studentCount} student
                    {viewerSchoolSummary.studentCount === 1 ? '' : 's'}
                    {currentGrades && currentGrades.length > 0
                      ? ` · Watching ${currentGrades.join(', ')}`
                      : currentGrade
                        ? ` · ${currentGrade}`
                        : ''}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 text-right">
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    School Total Harvest
                  </div>
                  <div className="text-sm font-bold font-mono text-emerald-300 tabular-nums">
                    {viewerSchoolSummary.totalHarvestUnits} units · {viewerSchoolSummary.massLabel}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Total School Sales
                  </div>
                  <div className="text-sm font-bold font-mono text-sky-300 tabular-nums">
                    {formatZar(viewerSchoolSummary.totalSalesZar)}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search child name or school..."
                aria-label="Search child name or school"
                className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              aria-label="Filter by School"
              className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Grouped Schools ({snapshot.groupedSchools.length})</option>
              {snapshot.groupedSchools.map((sch) => (
                <option key={sch.canonicalSchoolId} value={sch.canonicalSchoolId}>
                  {sch.canonicalSchoolName} ({sch.studentCount})
                </option>
              ))}
            </select>

            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              aria-label="Filter by Grade"
              className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Grades</option>
              {SCHOOL_GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            {(searchTerm || selectedSchoolId !== 'all' || selectedGrade !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSchoolId('all');
                  setSelectedGrade('all');
                }}
                className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-400">
              Loading live harvest rankings and grade sales...
            </div>
          ) : activeTab === 'students' ? (
            /* STUDENT RANKINGS VIEW */
            <section aria-label="Ranked Student Farmers" className="space-y-3">
              {filteredStudents.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
                  <p className="text-sm font-semibold text-slate-300">
                    No student farmers match the active filter yet.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Students appear automatically as soon as they log in or harvest produce from their 3D garden racks.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-4 w-20">Position</th>
                          <th className="py-3 px-4">Child</th>
                          <th className="py-3 px-4">Grade</th>
                          <th className="py-3 px-4">School (Grouped)</th>
                          <th className="py-3 px-4 text-right">Harvested</th>
                          <th className="py-3 px-4 text-right">Grade Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-sm">
                        {filteredStudents.map((row) => {
                          const isCurrent = row.studentUid === currentStudentUid;
                          return (
                            <tr
                              key={row.studentUid}
                              className={
                                isCurrent
                                  ? 'bg-emerald-950/50'
                                  : 'hover:bg-slate-800/40 transition-colors'
                              }
                            >
                              <td className="py-3 px-4 font-mono font-extrabold tabular-nums">
                                <span
                                  className={
                                    row.position === 1
                                      ? 'text-amber-300'
                                      : row.position === 2
                                        ? 'text-slate-200'
                                        : row.position === 3
                                          ? 'text-amber-500'
                                          : 'text-slate-400'
                                  }
                                >
                                  #{row.position}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold text-white">
                                <div className="flex items-center gap-2">
                                  <span>{row.studentName}</span>
                                  {isCurrent && (
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                                      (You)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-200 font-medium">
                                {row.grade}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-white">
                                  {row.canonicalSchoolName}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                                  School total: {row.schoolMassLabel}
                                  {row.schoolAliasCount > 1
                                    ? ` · ${row.schoolAliasCount} spellings grouped`
                                    : ''}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">
                                <div className="font-bold text-emerald-300">
                                  {row.totalHarvestUnits.toLocaleString('en-ZA')} units
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {row.massLabel}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums">
                                <div className="font-bold text-sky-300">
                                  {formatZar(row.gradeSalesZar)}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {row.gradeUnitsSold.toLocaleString('en-ZA')} sold ({row.grade})
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List */}
                  <div className="md:hidden space-y-2.5">
                    {filteredStudents.map((row) => {
                      const isCurrent = row.studentUid === currentStudentUid;
                      return (
                        <div
                          key={row.studentUid}
                          className={`rounded-xl border p-3.5 space-y-2 ${
                            isCurrent
                              ? 'border-emerald-500/60 bg-emerald-950/40'
                              : 'border-slate-800 bg-slate-900'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-baseline gap-2.5 min-w-0">
                              <span
                                className={`text-base font-extrabold font-mono tabular-nums ${
                                  row.position === 1
                                    ? 'text-amber-300'
                                    : row.position === 2
                                      ? 'text-slate-200'
                                      : row.position === 3
                                        ? 'text-amber-500'
                                        : 'text-slate-400'
                                }`}
                              >
                                #{row.position}
                              </span>
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate">
                                  {row.studentName}{' '}
                                  {isCurrent && (
                                    <span className="text-[10px] font-mono text-emerald-400">
                                      (You)
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-300 truncate">
                                  {row.grade} · {row.canonicalSchoolName}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-2 text-xs font-mono tabular-nums">
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase">
                                Harvested
                              </div>
                              <div className="font-bold text-emerald-300">
                                {row.totalHarvestUnits} units · {row.massLabel}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-400 uppercase">
                                {row.grade} Sales
                              </div>
                              <div className="font-bold text-sky-300">
                                {formatZar(row.gradeSalesZar)} ({row.gradeUnitsSold} sold)
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          ) : (
            /* GROUPED SCHOOLS & GRADE SALES VIEW */
            <section aria-label="Grouped Schools and Sales Per Grade" className="space-y-4">
              {filteredSchools.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-400">
                  No schools match the current filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSchools.map((sch, idx) => (
                    <article
                      key={sch.canonicalSchoolId}
                      className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-3.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm font-extrabold font-mono text-amber-300 tabular-nums">
                              #{idx + 1}
                            </span>
                            <h3 className="text-base font-extrabold text-white truncate">
                              {sch.canonicalSchoolName}
                            </h3>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400 font-mono tabular-nums">
                            {sch.studentCount} student{sch.studentCount === 1 ? '' : 's'} ·{' '}
                            {sch.grades.length} active grade{sch.grades.length === 1 ? '' : 's'}
                            {sch.matchedVariants.length > 1 && (
                              <span className="block sm:inline sm:ml-2 text-emerald-400/90">
                                · Recognized &amp; grouped spellings: {sch.matchedVariants.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-5 text-right font-mono tabular-nums">
                          <div>
                            <div className="text-[10px] uppercase text-slate-400">
                              Combined School Harvest
                            </div>
                            <div className="text-base font-extrabold text-emerald-300">
                              {sch.massLabel}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {sch.totalHarvestUnits.toLocaleString('en-ZA')} units
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-slate-400">
                              Total School Sales
                            </div>
                            <div className="text-base font-extrabold text-sky-300">
                              {formatZar(sch.totalSalesZar)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {sch.totalUnitsSold.toLocaleString('en-ZA')} sold
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Grade-by-Grade Breakdown Table */}
                      {sch.grades.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs sm:text-sm">
                            <thead>
                              <tr className="border-b border-slate-800/80 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                                <th className="py-2.5 px-4">Grade</th>
                                <th className="py-2.5 px-4 text-right">Students</th>
                                <th className="py-2.5 px-4 text-right">Harvested</th>
                                <th className="py-2.5 px-4 text-right">Units Sold</th>
                                <th className="py-2.5 px-4 text-right">Grade Sales (ZAR)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                              {sch.grades.map((g) => (
                                <tr key={g.grade} className="hover:bg-slate-800/30">
                                  <td className="py-2.5 px-4 font-sans font-bold text-slate-100">
                                    <div className="flex items-center gap-2">
                                      <GraduationCap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                      <span>{g.grade}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-slate-300">
                                    {g.studentCount}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-emerald-300 font-semibold">
                                    {g.harvestUnits.toLocaleString('en-ZA')} ({g.harvestMassLabel})
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-slate-300">
                                    {g.unitsSold.toLocaleString('en-ZA')}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-bold text-sky-300">
                                    {formatZar(g.salesZar)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {/* Cross-School Grade Sales Comparison */}
              {snapshot.gradeTotals.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                  <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-sky-400" />
                    <h3 className="text-sm font-extrabold text-white">
                      Total Sales &amp; Harvest per Grade (All Schools Combined)
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                    {snapshot.gradeTotals.map((gt) => (
                      <div
                        key={gt.grade}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">{gt.grade}</div>
                          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                            {gt.studentCount} student{gt.studentCount === 1 ? '' : 's'} ·{' '}
                            {gt.schoolCount} school{gt.schoolCount === 1 ? '' : 's'}
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-sm font-extrabold text-sky-300">
                            {formatZar(gt.salesZar)}
                          </div>
                          <div className="text-[11px] text-emerald-300">
                            {gt.harvestUnits} units · {gt.harvestMassLabel}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
