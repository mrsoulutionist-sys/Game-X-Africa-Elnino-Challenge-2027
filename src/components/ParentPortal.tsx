import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  GraduationCap,
  Lock,
  LogOut,
  PawPrint,
  School,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react';
import {
  subscribeToAdminDocuments,
  type AdminDocumentRecord,
} from '../firebase/adminService';
import { SUPPORTER_ROLES, type ParentProfile } from '../firebase/firebaseClient';
import {
  compute14DayStudentScores,
  ensureStarterCareListings,
  subscribeToHarvestBatches,
  subscribeToStoreListings,
  subscribeToStudentGrows,
  subscribeToUserAccount,
  subscribeToUserOrders,
  type HarvestBatch,
  type StoreListing,
  type StoreOrder,
  type StudentGrow,
} from '../firebase/storeService';
import { AdminDocumentsModal } from './AdminDocumentsModal';
import { GradeProduceStore } from './GradeProduceStore';
import { computePetAlerts, loadParentAdoptedPets, type AdoptedPet } from './petData';
import { PetSanctuary } from './PetSanctuary';

interface ParentPortalProps {
  profile: ParentProfile;
  onLogout: () => void;
}

type PortalView = 'sanctuary' | 'store';

export const ParentPortal: React.FC<ParentPortalProps> = ({ profile, onLogout }) => {
  const [activeView, setActiveView] = useState<PortalView>('sanctuary');
  const [adoptedPets, setAdoptedPets] = useState<AdoptedPet[]>([]);
  const [loadingPets, setLoadingPets] = useState(true);
  const [walletBalanceZar, setWalletBalanceZar] = useState<number>(
    profile.walletBalanceZar ?? 0
  );

  const [listings, setListings] = useState<StoreListing[]>([]);
  const [studentGrows, setStudentGrows] = useState<StudentGrow[]>([]);
  const [harvestBatches, setHarvestBatches] = useState<HarvestBatch[]>([]);
  const [recentOrders, setRecentOrders] = useState<StoreOrder[]>([]);
  const [adminDocs, setAdminDocs] = useState<AdminDocumentRecord[]>([]);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inlineStoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingPets(true);
    void loadParentAdoptedPets(profile.parentKey)
      .then((pets) => {
        if (!active) return;
        setAdoptedPets(pets);
      })
      .catch((err) => {
        console.error('Failed to load parent adopted pets:', err);
        if (!active) return;
        setAdoptedPets([]);
      })
      .finally(() => {
        if (active) setLoadingPets(false);
      });

    void ensureStarterCareListings().catch((err) => {
      console.error('Starter care bundle check failed:', err);
    });

    const unsubUser = subscribeToUserAccount(profile.parentKey, (account) => {
      if (!active || !account) return;
      setWalletBalanceZar(account.walletBalanceZar);
      if (account.adoptedPets.length > 0) {
        setAdoptedPets(account.adoptedPets);
      }
    });
    const unsubListings = subscribeToStoreListings((rows) => {
      if (active) setListings(rows);
    });
    const unsubGrows = subscribeToStudentGrows((rows) => {
      if (active) setStudentGrows(rows);
    });
    const unsubBatches = subscribeToHarvestBatches((rows) => {
      if (active) setHarvestBatches(rows);
    });
    const unsubOrders = subscribeToUserOrders(profile.parentKey, (rows) => {
      if (active) setRecentOrders(rows);
    });
    const unsubAdminDocs = subscribeToAdminDocuments((rows) => {
      if (active) setAdminDocs(rows);
    });

    return () => {
      active = false;
      unsubUser();
      unsubListings();
      unsubGrows();
      unsubBatches();
      unsubOrders();
      unsubAdminDocs();
    };
  }, [profile.parentKey]);

  const scores14d = useMemo(
    () => compute14DayStudentScores(harvestBatches, nowMs),
    [harvestBatches, nowMs]
  );

  const petAlerts = useMemo(
    () => computePetAlerts(adoptedPets, nowMs),
    [adoptedPets, nowMs]
  );

  const inStockCount = useMemo(
    () => listings.filter((l) => l.quantityAvailable > 0).length,
    [listings]
  );

  const activeGrowsCount = useMemo(
    () => studentGrows.filter((g) => !g.harvested).length,
    [studentGrows]
  );

  const total14dUnits = useMemo(
    () => scores14d.reduce((sum, entry) => sum + entry.totalUnits14d, 0),
    [scores14d]
  );

  const storeUnlocked = adoptedPets.length > 0;

  const openOrFocusStore = () => {
    if (!storeUnlocked) {
      setActiveView('store');
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (activeView === 'sanctuary' && inlineStoreRef.current) {
      inlineStoreRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setActiveView('store');
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const roleLabel =
    SUPPORTER_ROLES.find((r) => r.id === profile.role)?.label ?? 'Parent / Sponsor';
  const petCountLabel = adoptedPets.length === 1 ? '1 Pet' : `${adoptedPets.length} Pets`;

  return (
    <div
      ref={scrollContainerRef}
      className="fixed inset-0 z-40 overflow-y-auto touch-pan-y bg-[#FBF8F1] text-[#1E293B]"
    >
      {/* Top South African Flag-Inspired Color Bar */}
      <div className="h-2 w-full flex" aria-hidden="true">
        <div className="flex-1 bg-[#E03C31]" />
        <div className="flex-1 bg-[#FFB81C]" />
        <div className="flex-1 bg-[#007749]" />
        <div className="flex-1 bg-[#001489]" />
      </div>

      {/* Prominent Game X Africa Header Banner */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            {/* Game X Africa Geometric Emblem */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#007749] text-white shadow-sm">
              <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
                <path d="M4 6 L16 16 L4 26 Z" fill="#FFB81C" />
                <path d="M8 6 L18 16 L8 26" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle cx="23" cy="16" r="5" fill="#E03C31" />
              </svg>
            </div>
            <div>
              <p className="text-base font-extrabold tracking-tight text-[#1E293B]">
                Game X Africa
              </p>
              <p className="text-xs font-medium text-[#007749]">
                El Niño {roleLabel} Portal
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Karri Wallet Badge */}
            <button
              type="button"
              onClick={openOrFocusStore}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#001489]/25 bg-[#001489]/5 px-3 py-1.5 text-sm font-bold text-[#001489] hover:bg-[#001489]/10 cursor-pointer tabular-nums transition-colors"
            >
              <Wallet className="h-4 w-4 text-[#007749]" />
              <span>Karri: R{walletBalanceZar.toFixed(2)}</span>
            </button>

            {/* Live Sanctuary Counter Badge */}
            <button
              type="button"
              onClick={() => setActiveView('sanctuary')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#FFB81C] bg-[#FFB81C]/20 px-3 py-1.5 text-sm font-bold text-[#1E293B] hover:bg-[#FFB81C]/35 cursor-pointer tabular-nums transition-colors"
            >
              <PawPrint className="h-4 w-4 text-[#007749]" />
              <span>My Sanctuary: {petCountLabel}</span>
            </button>

            {adminDocs.length > 0 && (
              <button
                type="button"
                onClick={() => setDocsModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#001489]/25 bg-white px-3 py-1.5 text-sm font-semibold text-[#001489] hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span>Docs ({adminDocs.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-[#1E293B] transition-colors hover:border-[#E03C31] hover:bg-[#E03C31]/10 hover:text-[#991B1B] cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Linked Supporter, School & Grade(s) Strip */}
        <div className="border-t border-slate-100 bg-[#F5EFE0]/60">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-2 px-4 py-2 sm:grid-cols-3 sm:px-8">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="h-4 w-4 shrink-0 text-[#001489]" />
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-500">{roleLabel}: </span>
                <span className="truncate text-sm font-bold text-[#1E293B]">
                  {profile.pseudonym}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <School className="h-4 w-4 shrink-0 text-[#007749]" />
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-500">School: </span>
                <span className="truncate text-sm font-bold text-[#1E293B]">
                  {profile.schoolName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <GraduationCap className="h-4 w-4 shrink-0 text-[#E03C31]" />
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-500">
                  Grade{profile.grades.length > 1 ? 's' : ''}:{' '}
                </span>
                <span className="truncate text-sm font-bold text-[#1E293B]">
                  {profile.grades.join(' · ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top-Level Portal Navigation Tabs */}
        <div className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-8">
            <div role="tablist" aria-label="Parent Portal Sections" className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'sanctuary'}
                onClick={() => setActiveView('sanctuary')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors cursor-pointer ${
                  activeView === 'sanctuary'
                    ? 'bg-[#007749] text-white shadow-sm'
                    : 'bg-[#FBF8F1] text-[#1E293B] border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <PawPrint className="h-4 w-4" />
                <span>Pet Sanctuary ({adoptedPets.length})</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'store'}
                onClick={() => setActiveView('store')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors cursor-pointer ${
                  activeView === 'store'
                    ? 'bg-[#001489] text-white shadow-sm'
                    : storeUnlocked
                      ? 'bg-[#FBF8F1] text-[#1E293B] border border-[#007749]/40 hover:bg-emerald-50'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                {storeUnlocked || loadingPets ? (
                  <ShoppingBasket className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4 text-[#B45309]" />
                )}
                <span>
                  {loadingPets
                    ? 'Grade Produce Store'
                    : storeUnlocked
                      ? `Grade Produce Store (${inStockCount} Live)`
                      : 'Grade Produce Store (Adopt Pet to Unlock)'}
                </span>
              </button>
            </div>

            {petAlerts.length > 0 && activeView === 'sanctuary' && (
              <button
                type="button"
                onClick={openOrFocusStore}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFB81C] bg-[#FFB81C]/20 px-3 py-1.5 text-xs font-bold text-[#92400E] hover:bg-[#FFB81C]/35 cursor-pointer transition-colors"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-[#D97706]" />
                <span>
                  {petAlerts.length} Pet Alert{petAlerts.length > 1 ? 's' : ''} — Open Produce Store
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-4 sm:px-8 sm:py-5">
        {activeView === 'sanctuary' ? (
          <>
            {/* Segment 1: Interactive South African Herbivore Pet Sanctuary */}
            <PetSanctuary
              profile={profile}
              adoptedPets={adoptedPets}
              loadingPets={loadingPets}
              onPetsUpdated={setAdoptedPets}
              onOpenProduceStore={openOrFocusStore}
            />

            {/* Quick Bridge Cards to Live Store & Grade Impact */}
            <section
              aria-label="Portal Highlights"
              className="grid grid-cols-1 gap-5 md:grid-cols-2"
            >
              <div className="flex flex-col justify-between rounded-2xl border border-[#007749]/25 bg-white p-6 shadow-sm">
                <div>
                  <div className="inline-flex rounded-xl bg-[#007749]/10 p-3 text-[#007749]">
                    {storeUnlocked || loadingPets ? (
                      <ShoppingBasket className="h-6 w-6" />
                    ) : (
                      <Lock className="h-6 w-6 text-[#B45309]" />
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-[#1E293B]">
                    {storeUnlocked
                      ? 'Grade Produce & Pet Care Store (Unlocked)'
                      : 'Grade Produce & Pet Care Store'}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {storeUnlocked
                      ? `Shop real harvests picked by students (${inStockCount} items available now), track ${activeGrowsCount} crops growing on their way, load your R250+ Karri wallet, and feed your sanctuary companion.`
                      : `Adopt any of the 4 indigenous South African companions above (R50) to unlock ${profile.schoolName}'s live Grade Produce & Pet Care Shop.`}
                  </p>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-3.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#007749]">
                    {storeUnlocked
                      ? 'Real-Time Firestore Inventory'
                      : 'Step 2 · Unlocks Upon R50 Adoption'}
                  </span>
                  {storeUnlocked ? (
                    <button
                      type="button"
                      onClick={() => setActiveView('store')}
                      className="rounded-xl bg-[#007749] px-4 py-2 text-xs font-bold text-white hover:bg-[#065F46] cursor-pointer whitespace-nowrap"
                    >
                      Focus Store View
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                      }
                      className="rounded-xl bg-[#FFB81C] px-4 py-2 text-xs font-bold text-[#1E293B] hover:bg-[#eab308] cursor-pointer whitespace-nowrap"
                    >
                      Choose Pet Above (R50)
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-[#001489]/25 bg-white p-6 shadow-sm">
                <div>
                  <div className="inline-flex rounded-xl bg-[#001489]/10 p-3 text-[#001489]">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-[#1E293B]">
                    Grade Impact (Live 14-Day Harvest Tracker)
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {scores14d.length > 0
                      ? `${scores14d.length} active student farmer${scores14d.length === 1 ? '' : 's'} harvested ${total14dUnits} food & mulch units over the last 14 days (${activeGrowsCount} currently growing in PVC racks).`
                      : `Tracking student harvests from PVC wicking racks and Door 3 stations (${activeGrowsCount} crop${activeGrowsCount === 1 ? '' : 's'} currently growing in school gardens).`}
                  </p>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-3.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#001489] tabular-nums">
                    {total14dUnits} Units Harvested · {activeGrowsCount} Growing
                  </span>
                  {storeUnlocked && (
                    <button
                      type="button"
                      onClick={openOrFocusStore}
                      className="text-xs font-bold text-[#007749] hover:underline cursor-pointer"
                    >
                      View Live Feed ↓
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Immediately visible Grade Produce Store once Parent/Sponsor purchases a pet */}
            {storeUnlocked && (
              <div ref={inlineStoreRef} id="grade-produce-store" className="pt-2 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#007749]/35 bg-[#007749] px-5 py-3 text-white shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="h-5 w-5 text-[#FFB81C] shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#FFB81C]">
                        Shop Unlocked with Your Sanctuary Companion
                      </p>
                      <p className="text-sm font-bold">
                        Live Student Harvests &amp; Care Bundles for {profile.schoolName}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-white/15 px-3 py-1 text-xs font-bold tabular-nums">
                    {inStockCount} Items Live
                  </span>
                </div>

                <GradeProduceStore
                  profile={profile}
                  walletBalanceZar={walletBalanceZar}
                  adoptedPets={adoptedPets}
                  listings={listings}
                  studentGrows={studentGrows}
                  harvestBatches={harvestBatches}
                  scores14d={scores14d}
                  recentOrders={recentOrders}
                  onWalletUpdated={setWalletBalanceZar}
                  onPetsUpdated={setAdoptedPets}
                />
              </div>
            )}
          </>
        ) : !loadingPets && !storeUnlocked ? (
          <section
            aria-label="Adopt a Companion to Unlock Shop"
            className="mx-auto max-w-2xl rounded-2xl border border-[#FFB81C]/60 bg-white p-8 text-center shadow-sm"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFB81C]/20 text-[#92400E]">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-[#1E293B]">
              Adopt a R50 Companion to Unlock the Grade Produce Store
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Your school’s Grade Produce &amp; Pet Care Shop opens automatically as soon as you
              adopt one of the 4 indigenous South African herbivore companions in your sanctuary.
              Right now, {inStockCount} live store item{inStockCount === 1 ? ' is' : 's are'} ready
              and waiting for your companion!
            </p>
            <button
              type="button"
              onClick={() => setActiveView('sanctuary')}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#007749] px-6 py-3 text-sm font-bold text-white hover:bg-[#065F46] cursor-pointer shadow-sm transition-colors"
            >
              <PawPrint className="h-4 w-4 text-[#FFB81C]" />
              <span>Browse &amp; Adopt a R50 Companion</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        ) : (
          <GradeProduceStore
            profile={profile}
            walletBalanceZar={walletBalanceZar}
            adoptedPets={adoptedPets}
            listings={listings}
            studentGrows={studentGrows}
            harvestBatches={harvestBatches}
            scores14d={scores14d}
            recentOrders={recentOrders}
            onWalletUpdated={setWalletBalanceZar}
            onPetsUpdated={setAdoptedPets}
          />
        )}
      </main>

      <AdminDocumentsModal
        open={docsModalOpen}
        documents={adminDocs}
        onClose={() => setDocsModalOpen(false)}
      />
    </div>
  );
};

