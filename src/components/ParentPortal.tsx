import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  LogOut,
  PawPrint,
  School,
  ShoppingBasket,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import type { ParentProfile } from '../firebase/firebaseClient';
import { loadParentAdoptedPets, type AdoptedPet } from './petData';
import { PetSanctuary } from './PetSanctuary';

interface ParentPortalProps {
  profile: ParentProfile;
  onLogout: () => void;
}

const UPCOMING_MODULES = [
  {
    id: 'grade-produce-shop',
    title: 'Grade Produce Shop',
    statusLabel: 'Coming in Next Build Phase',
    description:
      'Sponsor fresh student-grown herbs, spinach, and carrots harvested from school vertical PVC racks to nourish your sanctuary companions.',
    accentText: 'text-[#007749]',
    accentBg: 'bg-[#007749]/10',
    accentBorder: 'border-[#007749]/25',
    Icon: ShoppingBasket,
  },
  {
    id: 'grade-impact',
    title: 'Grade Impact',
    statusLabel: 'Coming in Next Build Phase',
    description:
      'View aggregate litres of water saved, JoJo rainwater readiness, and fresh food servings produced across your child’s grade.',
    accentText: 'text-[#001489]',
    accentBg: 'bg-[#001489]/10',
    accentBorder: 'border-[#001489]/25',
    Icon: TrendingUp,
  },
] as const;

export const ParentPortal: React.FC<ParentPortalProps> = ({ profile, onLogout }) => {
  const [adoptedPets, setAdoptedPets] = useState<AdoptedPet[]>([]);
  const [loadingPets, setLoadingPets] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingPets(true);
    void loadParentAdoptedPets(profile.parentKey)
      .then((pets) => {
        if (!active) return;
        setAdoptedPets(pets);
      })
      .catch(() => {
        if (!active) return;
        setAdoptedPets([]);
      })
      .finally(() => {
        if (active) setLoadingPets(false);
      });
    return () => {
      active = false;
    };
  }, [profile.parentKey]);

  const petCountLabel = adoptedPets.length === 1 ? '1 Pet' : `${adoptedPets.length} Pets`;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#FBF8F1] text-[#1E293B]">
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
                El Niño Parent &amp; Sponsor Portal
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Sanctuary Counter Badge */}
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#FFB81C] bg-[#FFB81C]/20 px-3 py-1.5 text-sm font-bold text-[#1E293B] tabular-nums">
              <PawPrint className="h-4 w-4 text-[#007749]" />
              <span>My Sanctuary: {petCountLabel}</span>
            </div>

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

        {/* Linked Sponsor, School & Grade(s) Strip */}
        <div className="border-t border-slate-100 bg-[#F5EFE0]/60">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-2 px-4 py-2 sm:grid-cols-3 sm:px-8">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="h-4 w-4 shrink-0 text-[#001489]" />
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-500">Sponsor: </span>
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
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-4 sm:px-8 sm:py-5">
        {/* Segment 1: Interactive South African Herbivore Pet Sanctuary */}
        <PetSanctuary
          profile={profile}
          adoptedPets={adoptedPets}
          loadingPets={loadingPets}
          onPetsUpdated={setAdoptedPets}
        />

        {/* Next Build Phase Modules */}
        <section aria-label="Upcoming Parent Portal Modules" className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {UPCOMING_MODULES.map(
            ({ id, title, statusLabel, description, accentText, accentBg, accentBorder, Icon }) => (
              <div
                key={id}
                className={`flex flex-col justify-between rounded-2xl border ${accentBorder} bg-white p-6 shadow-sm`}
              >
                <div>
                  <div className={`inline-flex rounded-xl p-3 ${accentBg} ${accentText}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-[#1E293B]">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {description}
                  </p>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-3.5">
                  <span className={`text-xs font-bold uppercase tracking-wider ${accentText}`}>
                    {statusLabel}
                  </span>
                </div>
              </div>
            )
          )}
        </section>
      </main>
    </div>
  );
};
