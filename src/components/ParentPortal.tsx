import React from 'react';
import {
  GraduationCap,
  HeartHandshake,
  LogOut,
  PawPrint,
  School,
  ShoppingBasket,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import type { ParentProfile } from '../firebase/firebaseClient';

interface ParentPortalProps {
  profile: ParentProfile;
  onLogout: () => void;
}

const PORTAL_CARDS = [
  {
    id: 'pet-sanctuary',
    title: 'Pet Sanctuary',
    subtitle: 'Coming in Next Phase',
    description:
      'Support your child’s grade sanctuary companions powered by water-wise harvesting milestones and compost mastery.',
    accentBorder: 'border-amber-500/35',
    accentBg: 'bg-amber-500/10',
    accentText: 'text-amber-300',
    Icon: PawPrint,
  },
  {
    id: 'grade-produce-shop',
    title: 'Grade Produce Shop',
    subtitle: 'Coming in Next Phase',
    description:
      'Sponsor or browse drought-resilient herbs and greens grown in student vertical PVC racks across your child’s grade.',
    accentBorder: 'border-emerald-500/35',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-300',
    Icon: ShoppingBasket,
  },
  {
    id: 'grade-impact',
    title: 'Grade Impact',
    subtitle: 'Coming in Next Phase',
    description:
      'Track aggregate litres of water saved, JoJo tank readiness, and healthy food servings generated at this school.',
    accentBorder: 'border-sky-500/35',
    accentBg: 'bg-sky-500/10',
    accentText: 'text-sky-300',
    Icon: TrendingUp,
  },
] as const;

export const ParentPortal: React.FC<ParentPortalProps> = ({ profile, onLogout }) => {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-10">
        {/* Top Bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-amber-400">
              <HeartHandshake className="h-5 w-5" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider">
                Game X Africa · El Niño Parent & Sponsor Portal
              </span>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white">
              Welcome, {profile.pseudonym}
            </h1>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-rose-500/50 hover:bg-rose-950/50 hover:text-rose-200 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </header>

        {/* Linked School & Grade Summary */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-300">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Pseudonym
                </p>
                <p className="mt-0.5 truncate text-base font-semibold text-white">
                  {profile.pseudonym}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-300">
                <School className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Linked School
                </p>
                <p className="mt-0.5 truncate text-base font-semibold text-white">
                  {profile.schoolName}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-sky-500/15 p-2.5 text-sky-300">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Grade{profile.grades.length > 1 ? 's' : ''}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {profile.grades.map((grade) => (
                    <span
                      key={grade}
                      className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-200"
                    >
                      {grade}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Three Phase-Ready Placeholder Cards */}
        <section className="mt-6 grid flex-1 grid-cols-1 gap-5 md:grid-cols-3">
          {PORTAL_CARDS.map(({ id, title, subtitle, description, accentBorder, accentBg, accentText, Icon }) => (
            <div
              key={id}
              className={`flex flex-col justify-between rounded-2xl border ${accentBorder} bg-slate-900/70 p-6 shadow-lg`}
            >
              <div>
                <div className={`inline-flex rounded-xl p-3 ${accentBg} ${accentText}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{description}</p>
              </div>

              <div className="mt-6 border-t border-slate-800 pt-4">
                <span className={`text-xs font-mono font-semibold uppercase tracking-wider ${accentText}`}>
                  {subtitle}
                </span>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};
