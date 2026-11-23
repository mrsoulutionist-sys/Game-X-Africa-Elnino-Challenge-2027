import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  CreditCard,
  Filter,
  Leaf,
  Minus,
  Plus,
  Recycle,
  ShieldCheck,
  ShoppingBasket,
  Sprout,
  Wallet,
  X,
} from 'lucide-react';
import type { ParentProfile } from '../firebase/firebaseClient';
import {
  checkoutStoreBasket,
  loadWalletCredit,
  MIN_KARRI_TOPUP_ZAR,
  normalizeSchoolId,
  type BasketLineItem,
  type HarvestBatch,
  type StoreCategory,
  type StoreListing,
  type StoreOrder,
  type Student14DayScore,
  type StudentGrow,
} from '../firebase/storeService';
import {
  computePetAlerts,
  type AdoptedPet,
  type PetId,
} from './petData';
import { StoreClerkPanel, type ClerkQuickFilter } from './StoreClerkPanel';

interface GradeProduceStoreProps {
  profile: ParentProfile;
  walletBalanceZar: number;
  adoptedPets: AdoptedPet[];
  listings: StoreListing[];
  studentGrows: StudentGrow[];
  harvestBatches: HarvestBatch[];
  scores14d: Student14DayScore[];
  recentOrders: StoreOrder[];
  onWalletUpdated: (nextBalanceZar: number) => void;
  onPetsUpdated: (nextPets: AdoptedPet[]) => void;
}

const KARRI_PRESET_AMOUNTS = [250, 500, 1000] as const;

function formatRelativeAge(ms: number | null, nowMs: number): string {
  if (!ms) return 'Ready today';
  const diffMin = Math.max(0, Math.floor((nowMs - ms) / 60000));
  if (diffMin < 2) return 'Just harvested';
  if (diffMin < 60) return `${diffMin}m ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatGrowCountdown(readyAtMs: number, nowMs: number): string {
  const diffMs = readyAtMs - nowMs;
  if (diffMs <= 0) return 'Mature · Waiting for student harvest';
  const totalMin = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h left`;
  }
  return `${hours}h ${mins}m left`;
}

function getStatBadgeLabel(listing: StoreListing): string {
  const { stat, boostAmount, supplyDays } = listing.petCareEffect;
  const statTitle =
    stat === 'hunger'
      ? 'Food'
      : stat === 'water'
        ? 'Water'
        : stat === 'energy'
          ? 'Energy'
          : 'Play';
  return supplyDays
    ? `+${boostAmount}% ${statTitle} · ${supplyDays}-Day Supply`
    : `+${boostAmount}% ${statTitle}`;
}

export const GradeProduceStore: React.FC<GradeProduceStoreProps> = ({
  profile,
  walletBalanceZar,
  adoptedPets,
  listings,
  studentGrows,
  harvestBatches,
  scores14d,
  recentOrders,
  onWalletUpdated,
  onPetsUpdated,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [schoolScope, setSchoolScope] = useState<'all' | 'my_school'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | StoreCategory>('all');
  const [clerkFilter, setClerkFilter] = useState<ClerkQuickFilter>('all');

  const [basket, setBasket] = useState<Record<string, number>>({});
  const [targetPetId, setTargetPetId] = useState<PetId | null>(adoptedPets[0]?.id ?? null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<StoreOrder | null>(null);

  // Karri R250+ Credit Load Modal
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupAmountInput, setTopupAmountInput] = useState<string>('250');
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (adoptedPets.length > 0 && (!targetPetId || !adoptedPets.some((p) => p.id === targetPetId))) {
      setTargetPetId(adoptedPets[0].id);
    }
  }, [adoptedPets, targetPetId]);

  const petAlerts = useMemo(() => computePetAlerts(adoptedPets, nowMs), [adoptedPets, nowMs]);

  const normalizedProfileSchoolId = useMemo(
    () => normalizeSchoolId(profile.schoolKey || profile.schoolName),
    [profile.schoolKey, profile.schoolName]
  );

  const scoreByStudentUid = useMemo(() => {
    const map = new Map<string, Student14DayScore>();
    for (const s of scores14d) map.set(s.studentUid, s);
    return map;
  }, [scores14d]);

  const activeGrows = useMemo(() => {
    return studentGrows
      .filter((g) => !g.harvested)
      .filter(
        (g) =>
          schoolScope === 'all' ||
          normalizeSchoolId(g.schoolId || g.schoolName) === normalizedProfileSchoolId
      );
  }, [studentGrows, schoolScope, normalizedProfileSchoolId]);

  const mySchoolHarvestCount = useMemo(
    () =>
      listings.filter(
        (item) =>
          item.sourceType === 'care_bundle' ||
          normalizeSchoolId(item.schoolId || item.schoolName) === normalizedProfileSchoolId
      ).length,
    [listings, normalizedProfileSchoolId]
  );

  const filteredListings = useMemo(() => {
    const alertStats = new Set(petAlerts.map((a) => a.type));
    return listings.filter((item) => {
      if (
        schoolScope === 'my_school' &&
        item.sourceType === 'student_harvest' &&
        normalizeSchoolId(item.schoolId || item.schoolName) !== normalizedProfileSchoolId
      ) {
        return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (clerkFilter === 'pet_needs') {
        if (alertStats.size > 0 && !alertStats.has(item.petCareEffect.stat)) return false;
        if (item.quantityAvailable <= 0) return false;
      } else if (clerkFilter === 'fresh_harvests') {
        if (item.sourceType !== 'student_harvest' || item.quantityAvailable <= 0) return false;
      } else if (clerkFilter === 'low_stock') {
        if (item.quantityAvailable < 1 || item.quantityAvailable > 2) return false;
      } else if (clerkFilter === 'sold_out') {
        if (item.quantityAvailable > 0) return false;
      }
      return true;
    });
  }, [listings, schoolScope, normalizedProfileSchoolId, categoryFilter, clerkFilter, petAlerts]);

  const basketLines: BasketLineItem[] = useMemo(() => {
    const lines: BasketLineItem[] = [];
    for (const listing of listings) {
      const requestedQty = basket[listing.listingId] ?? 0;
      if (requestedQty > 0 && listing.quantityAvailable > 0) {
        lines.push({
          listing,
          quantity: Math.min(requestedQty, listing.quantityAvailable),
        });
      }
    }
    return lines;
  }, [basket, listings]);

  const basketTotalZar = useMemo(
    () =>
      Math.round(
        basketLines.reduce((sum, line) => sum + line.listing.priceZar * line.quantity, 0) * 100
      ) / 100,
    [basketLines]
  );

  const basketUnitCount = useMemo(
    () => basketLines.reduce((sum, line) => sum + line.quantity, 0),
    [basketLines]
  );

  const handleAdjustBasket = (listing: StoreListing, delta: number) => {
    setCheckoutError(null);
    setBasket((prev) => {
      const current = prev[listing.listingId] ?? 0;
      const next = Math.max(0, Math.min(listing.quantityAvailable, current + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[listing.listingId];
        return copy;
      }
      return { ...prev, [listing.listingId]: next };
    });
  };

  const handleConfirmTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topupSubmitting) return;
    const numeric = Number(topupAmountInput);
    if (!Number.isFinite(numeric) || numeric < MIN_KARRI_TOPUP_ZAR) {
      setTopupError(`Minimum Karri Credit load is R${MIN_KARRI_TOPUP_ZAR}.`);
      return;
    }

    setTopupSubmitting(true);
    setTopupError(null);
    try {
      const result = await loadWalletCredit({
        uid: profile.parentKey,
        userName: profile.pseudonym,
        role: profile.role,
        schoolId: profile.schoolKey,
        schoolName: profile.schoolName,
        grades: profile.grades,
        amountZar: numeric,
      });
      onWalletUpdated(result.nextBalanceZar);
      setTopupModalOpen(false);
    } catch (err) {
      setTopupError(
        err instanceof Error ? err.message : 'Could not complete Karri wallet top-up.'
      );
    } finally {
      setTopupSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    if (checkingOut || basketLines.length === 0) return;
    setCheckoutError(null);

    if (walletBalanceZar < basketTotalZar) {
      setCheckoutError(
        `Your Karri Credit Wallet has R${walletBalanceZar.toFixed(2)}, but your basket is R${basketTotalZar.toFixed(2)}. Load R${MIN_KARRI_TOPUP_ZAR}+ credit first.`
      );
      return;
    }

    setCheckingOut(true);
    try {
      const result = await checkoutStoreBasket({
        buyerUid: profile.parentKey,
        buyerName: profile.pseudonym,
        basketItems: basketLines,
        targetPetId,
      });
      onWalletUpdated(result.nextWalletBalanceZar);
      if (result.updatedPets.length > 0) {
        onPetsUpdated(result.updatedPets);
      }
      setBasket({});
      setLastCompletedOrder(result.order);
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Checkout failed. Please review shelf stock.'
      );
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <section
      aria-label="School Produce and Pet Care Store"
      className="space-y-5"
    >
      {/* Top Wallet + Store Header Card */}
      <div className="rounded-2xl border border-[#001489]/25 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#007749]">
              Segment 2 · Real-Time School Garden Co-op Store
            </p>
            <h2 className="mt-0.5 text-xl font-extrabold text-[#1E293B]">
              Grade Produce, Mulch &amp; Sanctuary Care Shop
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Every item comes from real student harvests or sanctuary care bundles. When shelf
              stock hits zero, it stays sold out until learners harvest the next crop!
            </p>
          </div>

          {/* Karri Credit Wallet Summary */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#FFB81C]/70 bg-[#FBF8F1] px-4 py-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Wallet className="h-3.5 w-3.5 text-[#007749]" />
                Karri Credit Wallet
              </p>
              <p className="text-2xl font-extrabold text-[#1E293B] tabular-nums">
                R{walletBalanceZar.toFixed(2)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setTopupError(null);
                setTopupModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#001489] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#001489]/90 cursor-pointer transition-colors whitespace-nowrap"
            >
              <CreditCard className="h-4 w-4 text-[#FFB81C]" />
              <span>Load Credit (Min R250)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reactive Store Clerk Panel */}
      <StoreClerkPanel
        profile={profile}
        walletBalanceZar={walletBalanceZar}
        adoptedPets={adoptedPets}
        petAlerts={petAlerts}
        listings={listings}
        activeGrows={activeGrows}
        batches={harvestBatches}
        scores14d={scores14d}
        lastCompletedOrder={lastCompletedOrder}
        nowMs={nowMs}
        activeQuickFilter={clerkFilter}
        onApplyQuickFilter={(f) => setClerkFilter(f)}
        onOpenTopupModal={() => {
          setTopupError(null);
          setTopupModalOpen(true);
        }}
      />

      {/* Main Split: Storefront Shelf + Pipeline (Left 8 cols) & Basket Checkout (Right 4 cols) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8 space-y-5">
          {/* Store Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400 mr-1" />
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'harvest_produce', label: 'Harvested Produce' },
                  { id: 'mulch_compost', label: 'Mulch & Compost' },
                  { id: 'pet_care', label: 'Pet Care Bundles' },
                ] as { id: 'all' | StoreCategory; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-[#007749] text-white'
                      : 'bg-slate-100 text-[#1E293B] hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setSchoolScope('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors tabular-nums ${
                  schoolScope === 'all'
                    ? 'bg-white text-[#1E293B] shadow-sm'
                    : 'text-slate-600 hover:text-[#1E293B]'
                }`}
              >
                All Schools ({listings.length})
              </button>
              <button
                type="button"
                onClick={() => setSchoolScope('my_school')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors tabular-nums ${
                  schoolScope === 'my_school'
                    ? 'bg-white text-[#1E293B] shadow-sm'
                    : 'text-slate-600 hover:text-[#1E293B]'
                }`}
              >
                My School ({mySchoolHarvestCount})
              </button>
            </div>
          </div>

          {/* Live Shelf Cards */}
          {filteredListings.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <Sprout className="mx-auto h-8 w-8 text-[#007749]" />
              <h3 className="mt-3 text-base font-bold text-[#1E293B]">
                No matching items on this shelf filter right now
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Try switching back to All Schools or check the &ldquo;On Its Way&rdquo; growing
                crops below!
              </p>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('all');
                  setSchoolScope('all');
                  setClerkFilter('all');
                }}
                className="mt-4 rounded-xl bg-[#007749] px-4 py-2 text-xs font-bold text-white hover:bg-[#065F46] cursor-pointer"
              >
                Reset Shelf Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filteredListings.map((item) => {
                const inBasketQty = basket[item.listingId] ?? 0;
                const isSoldOut = item.quantityAvailable <= 0;
                const isLowStock = item.quantityAvailable >= 1 && item.quantityAvailable <= 2;
                const studentScore = item.studentUid
                  ? scoreByStudentUid.get(item.studentUid)
                  : undefined;

                return (
                  <article
                    key={item.listingId}
                    className={`flex flex-col justify-between rounded-2xl border p-4 transition-shadow ${
                      isSoldOut
                        ? 'border-slate-200 bg-slate-50/90 opacity-85'
                        : 'border-slate-200 bg-white shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            item.category === 'harvest_produce'
                              ? 'bg-[#007749]/12 text-[#007749]'
                              : item.category === 'mulch_compost'
                                ? 'bg-[#FFB81C]/25 text-[#92400E]'
                                : 'bg-[#001489]/10 text-[#001489]'
                          }`}
                        >
                          {item.category === 'harvest_produce' ? (
                            <Leaf className="h-3 w-3" />
                          ) : item.category === 'mulch_compost' ? (
                            <Recycle className="h-3 w-3" />
                          ) : (
                            <ShoppingBasket className="h-3 w-3" />
                          )}
                          {item.category === 'harvest_produce'
                            ? 'Student Harvest'
                            : item.category === 'mulch_compost'
                              ? 'Mulch & Compost'
                              : 'Care Bundle'}
                        </span>

                        {isSoldOut ? (
                          <span className="rounded-md bg-[#E03C31]/15 px-2 py-0.5 text-[11px] font-bold text-[#991B1B]">
                            Sold Out — Waiting on Harvest
                          </span>
                        ) : isLowStock ? (
                          <span className="rounded-md bg-[#FFB81C]/30 px-2 py-0.5 text-[11px] font-bold text-[#92400E] tabular-nums">
                            Only {item.quantityAvailable} left!
                          </span>
                        ) : (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-[#007749] tabular-nums">
                            {item.quantityAvailable} in stock
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2.5 text-base font-extrabold text-[#1E293B]">
                        {item.title}
                      </h3>

                      <p className="mt-1 text-xs font-medium text-slate-600">
                        {item.sourceType === 'student_harvest' ? (
                          <>
                            Grown by{' '}
                            <span className="font-bold text-[#1E293B]">
                              {item.studentName || 'Student'}
                            </span>{' '}
                            · {item.grade} · {item.schoolName}
                          </>
                        ) : (
                          <>Sanctuary Support Bundle · {item.schoolName}</>
                        )}
                      </p>

                      {item.sourceType === 'student_harvest' && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>Harvested {formatRelativeAge(item.lastHarvestedAtMs, nowMs)}</span>
                          {studentScore && (
                            <span className="inline-flex items-center gap-1 rounded bg-[#F5EFE0] px-1.5 py-0.5 font-bold text-[#92400E]">
                              <Award className="h-3 w-3 text-[#FFB81C]" />
                              14d Score: {studentScore.totalUnits14d}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-[#FBF8F1] border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-[#001489]">
                        <span>{getStatBadgeLabel(item)}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-lg font-extrabold text-[#1E293B] tabular-nums">
                        R{item.priceZar.toFixed(2)}
                      </span>

                      {isSoldOut ? (
                        <button
                          type="button"
                          disabled
                          className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-bold text-slate-500 cursor-not-allowed"
                        >
                          Waiting on Next Harvest
                        </button>
                      ) : inBasketQty > 0 ? (
                        <div className="flex items-center gap-2 rounded-xl border border-[#007749] bg-[#007749]/10 px-2 py-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustBasket(item, -1)}
                            aria-label={`Remove one ${item.title}`}
                            className="rounded-lg bg-white p-1 text-[#1E293B] hover:bg-slate-100 cursor-pointer"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-5 text-center text-xs font-extrabold text-[#007749] tabular-nums">
                            {inBasketQty}
                          </span>
                          <button
                            type="button"
                            disabled={inBasketQty >= item.quantityAvailable}
                            onClick={() => handleAdjustBasket(item, 1)}
                            aria-label={`Add one more ${item.title}`}
                            className="rounded-lg bg-white p-1 text-[#1E293B] hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAdjustBasket(item, 1)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#007749] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#065F46] cursor-pointer transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add to Basket</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* ON ITS WAY — Active Student Growing Crops & Door 3 Cycles */}
          <div className="rounded-2xl border border-[#001489]/20 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#001489]">
                  Growing in School Gardens · Not Yet Harvestable
                </p>
                <h3 className="text-base font-extrabold text-[#1E293B]">
                  On Its Way ({activeGrows.length})
                </h3>
              </div>
              <Clock className="h-5 w-5 text-[#001489]" />
            </div>

            {activeGrows.length === 0 ? (
              <p className="mt-2.5 text-xs text-slate-600">
                No crops are mid-cycle right now. As students plant seeds or start composting, live
                harvest countdowns appear here automatically.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {activeGrows.slice(0, 6).map((grow) => (
                  <div
                    key={grow.growId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#FBF8F1] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#1E293B]">
                        {grow.itemTitle} (+{grow.expectedYieldQty} expected)
                      </p>
                      <p className="truncate text-[11px] text-slate-600">
                        {grow.studentName} · {grow.grade} · {grow.schoolName}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-[#001489]/10 px-2 py-1 text-[11px] font-bold text-[#001489] tabular-nums">
                      {formatGrowCountdown(grow.harvestReadyAtMs, nowMs)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TWO-WEEK (14-DAY) HARVEST SUMMARY */}
          <div className="rounded-2xl border border-[#FFB81C]/50 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#92400E]">
                  Rolling Two-Week Accountability
                </p>
                <h3 className="text-base font-extrabold text-[#1E293B]">
                  14-Day Student Harvest Summary
                </h3>
              </div>
              <Award className="h-5 w-5 text-[#FFB81C]" />
            </div>

            {scores14d.length === 0 ? (
              <p className="mt-2.5 text-xs text-slate-600">
                No student harvests recorded in the last 14 days yet. Harvested crops and completed
                Door 3 compost/mulch batches score here automatically.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {scores14d.slice(0, 5).map((entry, idx) => (
                  <div
                    key={entry.studentUid}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#FBF8F1] px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FFB81C] font-extrabold text-[#1E293B]">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#1E293B]">
                          {entry.studentName} · {entry.grade} ({entry.schoolName})
                        </p>
                        <p className="truncate text-[11px] text-slate-600">
                          Top yields: {entry.topItems.join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 tabular-nums">
                      <p className="font-extrabold text-[#007749]">
                        {entry.totalUnits14d} units harvested
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {entry.batchCount14d} batch{entry.batchCount14d === 1 ? '' : 'es'} in 14d
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 4 COLS: Basket, Target Pet Selector & Atomic Karri Wallet Checkout */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
          <div className="rounded-2xl border border-[#007749]/35 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="h-5 w-5 text-[#007749]" />
                <h3 className="text-base font-extrabold text-[#1E293B]">
                  Care Basket ({basketUnitCount})
                </h3>
              </div>
              {basketLines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBasket({})}
                  className="text-xs font-semibold text-slate-500 hover:text-[#E03C31] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Target Pet Selector (for multiple owned pets) */}
            <div>
              <label
                htmlFor="target-pet-select"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Deliver Care &amp; Food To
              </label>
              {adoptedPets.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-[#FBF8F1] px-3 py-2 text-xs text-slate-600">
                  Adopt a South African companion above for R50 to feed them directly—or support
                  school gardens now!
                </div>
              ) : (
                <select
                  id="target-pet-select"
                  value={targetPetId ?? adoptedPets[0].id}
                  onChange={(e) => setTargetPetId(e.target.value as PetId)}
                  className="w-full rounded-xl border border-slate-300 bg-[#FBF8F1] px-3 py-2 text-sm font-bold text-[#1E293B] focus:outline-none focus:border-[#007749]"
                >
                  {adoptedPets.map((pet) => {
                    const petNeeds = petAlerts
                      .filter((a) => a.petId === pet.id)
                      .map((a) => a.label);
                    return (
                      <option key={pet.id} value={pet.id}>
                        {pet.name} ({pet.species})
                        {petNeeds.length > 0 ? ` — Needs: ${petNeeds.join(', ')}` : ' — Happy'}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Basket Items */}
            {basketLines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-[#FBF8F1]/70 p-6 text-center">
                <p className="text-xs font-semibold text-slate-600">
                  Your basket is empty. Add fresh student harvests or R5–R15 pet care supplies from
                  the shelf!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {basketLines.map(({ listing, quantity }) => (
                  <div
                    key={listing.listingId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#FBF8F1] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#1E293B]">{listing.title}</p>
                      <p className="text-[11px] text-slate-500">
                        R{listing.priceZar.toFixed(2)} × {quantity} = R
                        {(listing.priceZar * quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAdjustBasket(listing, -1)}
                        className="rounded-lg border border-slate-300 bg-white p-1 text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={quantity >= listing.quantityAvailable}
                        onClick={() => handleAdjustBasket(listing, 1)}
                        className="rounded-lg border border-slate-300 bg-white p-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totals & Wallet Balance */}
            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Order Total</span>
                <span className="text-lg font-extrabold text-[#1E293B] tabular-nums">
                  R{basketTotalZar.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Karri Wallet Balance</span>
                <span
                  className={`font-bold tabular-nums ${
                    walletBalanceZar >= basketTotalZar ? 'text-[#007749]' : 'text-[#E03C31]'
                  }`}
                >
                  R{walletBalanceZar.toFixed(2)}
                </span>
              </div>
            </div>

            {checkoutError && (
              <div className="flex items-start gap-2 rounded-xl border border-[#E03C31]/40 bg-[#E03C31]/10 px-3 py-2 text-xs font-medium text-[#991B1B]">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{checkoutError}</span>
              </div>
            )}

            {basketLines.length > 0 && walletBalanceZar < basketTotalZar ? (
              <button
                type="button"
                onClick={() => {
                  setTopupError(null);
                  setTopupModalOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFB81C] px-4 py-3 text-sm font-extrabold text-[#1E293B] hover:bg-[#eab308] cursor-pointer transition-colors"
              >
                <Wallet className="h-4 w-4" />
                <span>Load R250+ Credit to Checkout</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={checkingOut || basketLines.length === 0}
                onClick={handleCheckout}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#007749] px-4 py-3 text-sm font-extrabold text-white hover:bg-[#065F46] disabled:bg-slate-200 disabled:text-slate-500 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {checkingOut
                    ? 'Processing Atomic Order...'
                    : `Pay R${basketTotalZar.toFixed(2)} from Wallet`}
                </span>
              </button>
            )}
          </div>

          {/* Recent Wallet Orders */}
          {recentOrders.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Orders
              </p>
              <div className="mt-2.5 space-y-2">
                {recentOrders.slice(0, 3).map((ord) => (
                  <div
                    key={ord.orderId}
                    className="rounded-xl border border-slate-100 bg-[#FBF8F1] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-[#1E293B]">
                      <span>For {ord.targetPetName}</span>
                      <span className="tabular-nums text-[#007749]">
                        R{ord.totalPaidZar.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {ord.items.map((i) => `${i.quantity}× ${i.title}`).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* KARRI MINIMUM R250 CREDIT LOAD MODAL */}
      {topupModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => !topupSubmitting && setTopupModalOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="karri-topup-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleConfirmTopup}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          >
            <div className="bg-[#001489] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FFB81C]">
                  <ShieldCheck className="h-4 w-4" />
                  Karri School Wallet Top-Up
                </span>
                <button
                  type="button"
                  disabled={topupSubmitting}
                  onClick={() => setTopupModalOpen(false)}
                  aria-label="Close wallet top-up"
                  className="rounded-lg p-1.5 text-slate-200 hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h3 id="karri-topup-title" className="mt-2 text-lg font-extrabold">
                Load Sanctuary &amp; Garden Credit
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-blue-100">
                Minimum top-up is <strong>R250.00</strong>. Pre-loading credit keeps micro-purchases
                like R5 rabbit food and R12 spinach free of per-item card gateway fees!
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {KARRI_PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setTopupError(null);
                      setTopupAmountInput(String(amt));
                    }}
                    className={`rounded-xl border py-2.5 text-sm font-extrabold tabular-nums cursor-pointer transition-colors ${
                      Number(topupAmountInput) === amt
                        ? 'border-[#007749] bg-[#007749] text-white'
                        : 'border-slate-200 bg-[#FBF8F1] text-[#1E293B] hover:border-[#007749]/50'
                    }`}
                  >
                    R{amt}
                  </button>
                ))}
              </div>

              <div>
                <label
                  htmlFor="karri-custom-amount"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Custom Amount (ZAR · Min R250)
                </label>
                <input
                  id="karri-custom-amount"
                  type="number"
                  min={MIN_KARRI_TOPUP_ZAR}
                  step="10"
                  value={topupAmountInput}
                  onChange={(e) => {
                    setTopupError(null);
                    setTopupAmountInput(e.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-[#FBF8F1] px-3.5 py-2.5 text-base font-bold text-[#1E293B] tabular-nums focus:outline-none focus:border-[#001489]"
                />
              </div>

              {topupError && (
                <p className="text-xs font-bold text-[#E03C31]">{topupError}</p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={topupSubmitting}
                  onClick={() => setTopupModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={topupSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#007749] px-5 py-2.5 text-xs font-extrabold text-white hover:bg-[#065F46] disabled:opacity-60 cursor-pointer"
                >
                  <Wallet className="h-4 w-4 text-[#FFB81C]" />
                  <span>
                    {topupSubmitting
                      ? 'Loading Credit...'
                      : `Confirm R${Number(topupAmountInput || 0).toFixed(2)} Top-Up`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
