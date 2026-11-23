import React from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Sparkles,
  Store,
  TrendingUp,
} from 'lucide-react';
import { SUPPORTER_ROLES, type ParentProfile } from '../firebase/firebaseClient';
import type {
  HarvestBatch,
  StoreListing,
  StoreOrder,
  Student14DayScore,
  StudentGrow,
} from '../firebase/storeService';
import type { AdoptedPet, PetAlert } from './petData';

export type ClerkQuickFilter =
  | 'all'
  | 'pet_needs'
  | 'fresh_harvests'
  | 'low_stock'
  | 'sold_out';

interface StoreClerkPanelProps {
  profile: ParentProfile;
  walletBalanceZar: number;
  adoptedPets: AdoptedPet[];
  petAlerts: PetAlert[];
  listings: StoreListing[];
  activeGrows: StudentGrow[];
  batches: HarvestBatch[];
  scores14d: Student14DayScore[];
  lastCompletedOrder: StoreOrder | null;
  nowMs: number;
  activeQuickFilter: ClerkQuickFilter;
  onApplyQuickFilter: (filter: ClerkQuickFilter) => void;
  onOpenTopupModal: () => void;
}

function formatShortCountdown(readyAtMs: number, nowMs: number): string {
  const diffMs = readyAtMs - nowMs;
  if (diffMs <= 0) return 'Ready to harvest now';
  const totalMin = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h remaining`;
  }
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

export const StoreClerkPanel: React.FC<StoreClerkPanelProps> = ({
  profile,
  walletBalanceZar,
  adoptedPets,
  petAlerts,
  listings,
  activeGrows,
  batches,
  scores14d,
  lastCompletedOrder,
  nowMs,
  activeQuickFilter,
  onApplyQuickFilter,
  onOpenTopupModal,
}) => {
  const roleLabel =
    SUPPORTER_ROLES.find((r) => r.id === profile.role)?.label ?? 'Parent / Supporter';

  const activeListings = listings.filter((l) => l.quantityAvailable > 0);
  const activeStudentListings = activeListings.filter(
    (l) => l.sourceType === 'student_harvest'
  );
  const lowStockListings = activeListings.filter(
    (l) => l.quantityAvailable >= 1 && l.quantityAvailable <= 2
  );
  const soldOutListings = listings.filter((l) => l.quantityAvailable === 0);

  const recent24hBatches = batches.filter((b) => nowMs - b.harvestedAtMs <= 86400000);
  const earliestGrow = activeGrows.length > 0 ? activeGrows[0] : null;
  const topStudent14d = scores14d.length > 0 ? scores14d[0] : null;

  const urgentPetAlert = petAlerts.find((a) => a.urgent) ?? petAlerts[0] ?? null;

  return (
    <aside
      aria-label="Reactive Store Clerk"
      className="rounded-2xl border border-[#007749]/30 bg-gradient-to-br from-[#FBF8F1] via-white to-[#ECFDF5]/60 p-5 shadow-sm"
    >
      {/* Clerk Identity Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#007749] text-white shadow-sm">
            <Store className="h-5 w-5 text-[#FFB81C]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#007749]">
                Garden Co-op Store Clerk
              </h3>
              <span className="rounded-md bg-[#FFB81C]/25 px-2 py-0.5 text-[11px] font-bold text-[#92400E]">
                Live Shelf Monitor
              </span>
            </div>
            <p className="text-sm font-semibold text-[#1E293B]">
              Sawubona, {profile.pseudonym} ({roleLabel}) · {profile.schoolName} (
              {profile.grades.join(', ')})
            </p>
          </div>
        </div>

        {walletBalanceZar < 15 && (
          <button
            type="button"
            onClick={onOpenTopupModal}
            className="rounded-xl bg-[#001489] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#001489]/90 cursor-pointer transition-colors"
          >
            Load R250+ Karri Credit
          </button>
        )}
      </div>

      {/* Immediate Order Confirmation Callout */}
      {lastCompletedOrder && (
        <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-[#007749]/35 bg-[#007749]/10 px-4 py-3 text-xs sm:text-sm text-[#065F46]">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#007749]" />
          <div>
            <p className="font-bold">
              Order confirmed for {lastCompletedOrder.targetPetName}!
            </p>
            <p className="mt-0.5 text-xs text-slate-700">
              Paid R{lastCompletedOrder.totalPaidZar.toFixed(2)} from Karri Credit Wallet. Remaining
              balance: R{lastCompletedOrder.walletAfterZar.toFixed(2)}. Care stats updated in real
              time.
            </p>
          </div>
        </div>
      )}

      {/* Grounded Reactive Briefing Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Card 1: Pet Need Alert & Suggestion */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Sanctuary Check
          </p>
          {adoptedPets.length === 0 ? (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
              You have not adopted a sanctuary companion yet. Student harvests on this shelf still
              directly support {profile.schoolName}!
            </p>
          ) : urgentPetAlert ? (
            <div className="mt-1.5 space-y-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B45309]">
                <AlertTriangle className="h-3.5 w-3.5 text-[#E03C31]" />
                {urgentPetAlert.petName}: {urgentPetAlert.label} ({urgentPetAlert.currentValue}%)
              </p>
              <p className="text-xs leading-relaxed text-slate-600">
                {petAlerts.length} active care alert{petAlerts.length > 1 ? 's' : ''} across your{' '}
                {adoptedPets.length} companion{adoptedPets.length > 1 ? 's' : ''}. Pick a matching
                produce bunch or care bundle below to replenish {urgentPetAlert.petName}.
              </p>
            </div>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-[#007749] font-medium">
              All {adoptedPets.length} sanctuary companion{adoptedPets.length > 1 ? 's are' : ' is'}{' '}
              well cared for right now. Stock up on 3-day supplies or fresh harvests anytime!
            </p>
          )}
        </div>

        {/* Card 2: Live Shelf Stock & Scarcity */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Live Shelf Status
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
            <span className="font-bold text-[#1E293B]">{activeListings.length}</span> listing
            {activeListings.length === 1 ? '' : 's'} in stock ({activeStudentListings.length} from
            student harvests) ·{' '}
            <span className="font-bold text-[#B45309]">{lowStockListings.length}</span> running
            low ·{' '}
            <span className="font-bold text-[#E03C31]">{soldOutListings.length}</span> sold out.
          </p>
          {recent24hBatches.length > 0 ? (
            <p className="mt-1 text-xs font-semibold text-[#007749]">
              Freshly picked: {recent24hBatches[0].itemTitle} (+{recent24hBatches[0].quantity} by{' '}
              {recent24hBatches[0].studentName}, {recent24hBatches[0].grade})
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              No student harvests logged in the past 24 hours yet.
            </p>
          )}
        </div>

        {/* Card 3: Upcoming Grows & 14-Day Harvest Leader */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Pipeline &amp; 14-Day Harvests
          </p>
          {earliestGrow ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#001489]">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                Next harvest: {earliestGrow.itemTitle} by {earliestGrow.studentName} (
                {formatShortCountdown(earliestGrow.harvestReadyAtMs, nowMs)})
              </span>
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-slate-600">
              No crops currently growing in active racks. Check back as students plant!
            </p>
          )}
          {topStudent14d ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-700">
              <Award className="h-3.5 w-3.5 text-[#FFB81C] shrink-0" />
              <span>
                14-day top grower: <strong>{topStudent14d.studentName}</strong> ({topStudent14d.grade}
                ) — {topStudent14d.totalUnits14d} units
              </span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              14-day harvest scores update automatically as students harvest.
            </p>
          )}
        </div>
      </div>

      {/* Quick Focus Action Chips */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
          <Sparkles className="h-3.5 w-3.5 text-[#FFB81C]" />
          Clerk Quick Focus:
        </span>

        {(
          [
            { id: 'all', label: `All Shelf (${listings.length})` },
            {
              id: 'pet_needs',
              label: `Matches Pet Alerts (${petAlerts.length})`,
              disabled: petAlerts.length === 0,
            },
            {
              id: 'fresh_harvests',
              label: `Student Harvests (${activeStudentListings.length})`,
            },
            {
              id: 'low_stock',
              label: `Running Low (${lowStockListings.length})`,
            },
            {
              id: 'sold_out',
              label: `Sold Out (${soldOutListings.length})`,
            },
          ] as { id: ClerkQuickFilter; label: string; disabled?: boolean }[]
        ).map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={chip.disabled}
            onClick={() => onApplyQuickFilter(chip.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              activeQuickFilter === chip.id
                ? 'bg-[#007749] text-white'
                : 'bg-white border border-slate-200 text-[#1E293B] hover:border-[#007749]/50'
            }`}
          >
            {chip.label}
          </button>
        ))}

        <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
          <TrendingUp className="h-3.5 w-3.5 text-[#007749]" />
          Synced live with school gardens
        </span>
      </div>
    </aside>
  );
};
