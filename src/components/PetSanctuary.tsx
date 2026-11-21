import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Heart,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  Sprout,
  Utensils,
  X,
} from 'lucide-react';
import type { ParentProfile } from '../firebase/firebaseClient';
import { PetIllustration, VeldHabitatBackdrop } from './PetArtwork';
import {
  createAdoptedPetRecord,
  getCatalogPetById,
  PET_ADOPTION_PRICE_ZAR,
  SA_HERBIVORE_CATALOG,
  saveParentAdoptedPets,
  type AdoptedPet,
  type PetCatalogItem,
  type PetId,
} from './petData';

type SanctuaryTab = 'adopt' | 'habitat';
type PetMotionState = 'idle' | 'hop' | 'play';

interface FloatingHeart {
  uid: number;
  leftPct: number;
  delayMs: number;
}

interface PetSanctuaryProps {
  profile: ParentProfile;
  adoptedPets: AdoptedPet[];
  loadingPets: boolean;
  onPetsUpdated: (nextPets: AdoptedPet[]) => void;
}

export const PetSanctuary: React.FC<PetSanctuaryProps> = ({
  profile,
  adoptedPets,
  loadingPets,
  onPetsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<SanctuaryTab>(
    adoptedPets.length > 0 ? 'habitat' : 'adopt'
  );
  const [selectedCatalogPet, setSelectedCatalogPet] = useState<PetCatalogItem | null>(null);
  const [checkoutPet, setCheckoutPet] = useState<PetCatalogItem | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [sanctuaryError, setSanctuaryError] = useState<string | null>(null);

  const [focusedPetId, setFocusedPetId] = useState<PetId | null>(
    adoptedPets[0]?.id ?? null
  );
  const [petMotion, setPetMotion] = useState<PetMotionState>('idle');
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [savingCare, setSavingCare] = useState(false);

  const motionTimerRef = useRef<number | null>(null);
  const heartsTimerRef = useRef<number | null>(null);
  const interactionIndexRef = useRef(0);
  const autoSwitchedInitialRef = useRef(false);

  useEffect(() => {
    if (!autoSwitchedInitialRef.current && adoptedPets.length > 0) {
      autoSwitchedInitialRef.current = true;
      setActiveTab('habitat');
      setFocusedPetId((prev) => prev ?? adoptedPets[0].id);
    }
    if (adoptedPets.length > 0 && (!focusedPetId || !adoptedPets.some((p) => p.id === focusedPetId))) {
      setFocusedPetId(adoptedPets[0].id);
    }
  }, [adoptedPets, focusedPetId]);

  useEffect(() => {
    return () => {
      if (motionTimerRef.current) window.clearTimeout(motionTimerRef.current);
      if (heartsTimerRef.current) window.clearTimeout(heartsTimerRef.current);
    };
  }, []);

  const triggerMotion = (nextMotion: PetMotionState, durationMs = 900) => {
    if (motionTimerRef.current) window.clearTimeout(motionTimerRef.current);
    setPetMotion(nextMotion);
    motionTimerRef.current = window.setTimeout(() => {
      setPetMotion('idle');
    }, durationMs);
  };

  const spawnHearts = () => {
    if (heartsTimerRef.current) window.clearTimeout(heartsTimerRef.current);
    const base = Date.now();
    setFloatingHearts([
      { uid: base + 1, leftPct: 38, delayMs: 0 },
      { uid: base + 2, leftPct: 50, delayMs: 110 },
      { uid: base + 3, leftPct: 62, delayMs: 210 },
      { uid: base + 4, leftPct: 44, delayMs: 300 },
      { uid: base + 5, leftPct: 57, delayMs: 380 },
    ]);
    heartsTimerRef.current = window.setTimeout(() => {
      setFloatingHearts([]);
    }, 1700);
  };

  const adoptedIdSet = new Set(adoptedPets.map((p) => p.id));

  const activeAdoptedPet =
    adoptedPets.find((p) => p.id === focusedPetId) ?? adoptedPets[0] ?? null;

  const handleOpenCheckout = (pet: PetCatalogItem) => {
    setSanctuaryError(null);
    setSelectedCatalogPet(null);
    setCheckoutPet(pet);
  };

  const handleCompleteSimulatedPayment = async () => {
    if (!checkoutPet || checkoutSubmitting) return;
    setCheckoutSubmitting(true);
    setSanctuaryError(null);

    try {
      const alreadyOwned = adoptedPets.some((p) => p.id === checkoutPet.id);
      const nextList = alreadyOwned
        ? adoptedPets
        : [...adoptedPets, createAdoptedPetRecord(checkoutPet)];
      const saved = await saveParentAdoptedPets(profile.parentKey, nextList);
      onPetsUpdated(saved);
      setFocusedPetId(checkoutPet.id);
      setCheckoutPet(null);
      setActiveTab('habitat');
      triggerMotion('hop', 900);
      setSpeechBubble(
        `Welcome home! ${checkoutPet.name} is thrilled to join your ${profile.schoolName} sanctuary, ${profile.pseudonym}!`
      );
    } catch (err) {
      setSanctuaryError(
        err instanceof Error
          ? err.message
          : 'Could not complete your simulated adoption. Please try again.'
      );
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const persistPetCare = async (
    petId: PetId,
    mutate: (pet: AdoptedPet) => AdoptedPet
  ) => {
    const nextPets = adoptedPets.map((p) => (p.id === petId ? mutate(p) : p));
    onPetsUpdated(nextPets);
    setSavingCare(true);
    try {
      const saved = await saveParentAdoptedPets(profile.parentKey, nextPets);
      onPetsUpdated(saved);
    } catch (err) {
      setSanctuaryError(
        err instanceof Error ? err.message : 'Unable to save sanctuary update right now.'
      );
    } finally {
      setSavingCare(false);
    }
  };

  const handleSayHi = async () => {
    if (!activeAdoptedPet) return;
    const catalog = getCatalogPetById(activeAdoptedPet.id);
    const greetings = catalog.greetingTemplates(profile.pseudonym);
    const msg = greetings[interactionIndexRef.current % greetings.length];
    interactionIndexRef.current += 1;

    triggerMotion('hop', 820);
    setSpeechBubble(msg);

    await persistPetCare(activeAdoptedPet.id, (pet) => ({
      ...pet,
      happiness: Math.min(100, pet.happiness + 2),
    }));
  };

  const handlePetAndCuddle = async () => {
    if (!activeAdoptedPet) return;
    const catalog = getCatalogPetById(activeAdoptedPet.id);
    const reactions = catalog.cuddleReactions;
    const msg = reactions[interactionIndexRef.current % reactions.length];
    interactionIndexRef.current += 1;

    spawnHearts();
    triggerMotion('hop', 820);
    setSpeechBubble(msg);

    await persistPetCare(activeAdoptedPet.id, (pet) => ({
      ...pet,
      happiness: Math.min(100, pet.happiness + 8),
    }));
  };

  const handlePlayTogether = async () => {
    if (!activeAdoptedPet) return;
    const catalog = getCatalogPetById(activeAdoptedPet.id);
    const trivia = catalog.natureTrivia;
    const msg = trivia[interactionIndexRef.current % trivia.length];
    interactionIndexRef.current += 1;

    triggerMotion('play', 920);
    setSpeechBubble(msg);

    await persistPetCare(activeAdoptedPet.id, (pet) => ({
      ...pet,
      happiness: Math.min(100, pet.happiness + 5),
      hunger: Math.max(45, pet.hunger - 3),
    }));
  };

  return (
    <section
      aria-label="South African Herbivore Pet Sanctuary"
      className="rounded-2xl border border-[#007749]/25 bg-white shadow-sm overflow-hidden"
    >
      {/* Top Section Header & Part A / Part B Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-[#F5EFE0]/70 px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#007749]">
            Segment 1 · Indigenous Companion Sanctuary
          </p>
          <h2 className="mt-0.5 text-xl font-bold text-[#1E293B]">
            South African Herbivore Pet Sanctuary
          </h2>
        </div>

        {/* Interactive Tab Switcher: Adopt a Pet | My Sanctuary (N) */}
        <div
          role="tablist"
          aria-label="Pet Sanctuary views"
          className="flex items-center gap-1.5 rounded-xl bg-white p-1 border border-slate-200"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'adopt'}
            onClick={() => {
              setSanctuaryError(null);
              setActiveTab('adopt');
            }}
            className={`whitespace-nowrap shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'adopt'
                ? 'bg-[#007749] text-white shadow-sm'
                : 'text-[#1E293B] hover:bg-slate-100'
            }`}
          >
            Adopt a Pet
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'habitat'}
            onClick={() => {
              setSanctuaryError(null);
              setActiveTab('habitat');
            }}
            className={`whitespace-nowrap shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer tabular-nums ${
              activeTab === 'habitat'
                ? 'bg-[#001489] text-white shadow-sm'
                : 'text-[#1E293B] hover:bg-slate-100'
            }`}
          >
            My Sanctuary ({adoptedPets.length})
          </button>
        </div>
      </div>

      {sanctuaryError && (
        <div className="mx-5 mt-4 rounded-xl border border-[#E03C31]/40 bg-[#E03C31]/10 px-4 py-3 text-sm font-medium text-[#991B1B] sm:mx-6">
          {sanctuaryError}
        </div>
      )}

      {/* PART A: THE HERBIVORE ADOPTION SHOWCASE */}
      {activeTab === 'adopt' && (
        <div className="p-5 sm:p-6">
          {/* Warm Welcome Banner */}
          <div className="rounded-2xl border border-[#007749]/25 bg-gradient-to-r from-[#007749] to-[#065F46] p-5 text-white">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#FFB81C]">
                  Adopt a South African Companion
                </p>
                <h3 className="mt-1 text-lg font-bold sm:text-xl">
                  Every companion thrives on the fresh garden veggies your school grows
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-emerald-50">
                  All sanctuary companions are indigenous South African herbivores rescued from dry veld corridors. They grow happiest when fed crisp greens, herbs, and carrots harvested in {profile.schoolName}’s El Niño gardens.
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-left md:text-right">
                <p className="text-xs text-emerald-100">Adoption Support</p>
                <p className="text-2xl font-bold text-[#FFB81C] tabular-nums">R50.00</p>
                <p className="text-xs text-emerald-100">Supports {profile.grades.join(' · ')}</p>
              </div>
            </div>
          </div>

          {/* 4 Clickable South African Herbivore Cards */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SA_HERBIVORE_CATALOG.map((pet) => {
              const isAdopted = adoptedIdSet.has(pet.id);
              return (
                <div
                  key={pet.id}
                  onClick={() => setSelectedCatalogPet(pet)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCatalogPet(pet);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-[#FBF8F1] p-5 text-left transition-transform duration-200 hover:-translate-y-1 hover:border-[#007749]/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007749] cursor-pointer"
                >
                  <div>
                    {/* Illustrated Pet Stage */}
                    <div className="relative flex h-40 items-center justify-center rounded-xl bg-gradient-to-b from-[#E0F2FE]/70 via-[#FEF3C7]/60 to-[#D9F99D]/55 border border-slate-200/80 p-3 overflow-hidden">
                      <div className="transition-transform duration-300 group-hover:scale-105 group-hover:-translate-y-1">
                        <PetIllustration petId={pet.id} className="h-32 w-36" />
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="text-lg font-bold text-[#1E293B]">
                        {pet.name} <span className="font-medium text-slate-600">the {pet.species}</span>
                      </h4>
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        {pet.ageLabel} · {pet.region}
                      </p>
                      <p className="mt-2.5 text-sm leading-relaxed text-slate-700 line-clamp-3">
                        {pet.backstory}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-200 pt-4 flex items-center justify-between gap-2">
                    {isAdopted ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007749]">
                          <CheckCircle2 className="h-4 w-4" />
                          Adopted
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocusedPetId(pet.id);
                            setActiveTab('habitat');
                          }}
                          className="whitespace-nowrap shrink-0 rounded-lg bg-[#001489] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#001489]/90 cursor-pointer"
                        >
                          Visit Pet
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-base font-bold text-[#1E293B] tabular-nums">
                          R{PET_ADOPTION_PRICE_ZAR}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCheckout(pet);
                          }}
                          className="whitespace-nowrap shrink-0 rounded-lg bg-[#FFB81C] px-3.5 py-2 text-xs font-bold text-[#1E293B] hover:bg-[#eab308] transition-colors cursor-pointer"
                        >
                          Adopt for R50
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PART B: MY PET SANCTUARY (INTERACTIVE HABITAT ENVIRONMENT) */}
      {activeTab === 'habitat' && (
        <div className="p-5 sm:p-6">
          {loadingPets ? (
            <div className="rounded-2xl border border-slate-200 bg-[#FBF8F1] p-10 text-center">
              <p className="text-sm font-semibold text-slate-600">
                Loading your South African Pet Sanctuary...
              </p>
            </div>
          ) : !activeAdoptedPet ? (
            <div className="rounded-2xl border border-slate-200 bg-[#FBF8F1] p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007749]/10 text-[#007749]">
                <Sprout className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#1E293B]">
                Your Sanctuary Habitat Is Ready
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
                Adopt your first South African herbivore companion for R50 to welcome them into this sunlit school-garden habitat.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('adopt')}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#007749] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#065F46] cursor-pointer"
              >
                <span>Browse South African Companions</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Companion Switcher if Parent Adopted Multiple Pets */}
              {adoptedPets.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#FBF8F1] px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Active Sanctuary Companion:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {adoptedPets.map((pet) => {
                      const active = pet.id === activeAdoptedPet.id;
                      return (
                        <button
                          key={pet.id}
                          type="button"
                          onClick={() => {
                            setFocusedPetId(pet.id);
                            setSpeechBubble(null);
                            triggerMotion('hop', 700);
                          }}
                          className={`whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#007749] text-white'
                              : 'bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-100'
                          }`}
                        >
                          {pet.name} ({pet.species})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Illustrated South African Veld & Garden Sanctuary Scene */}
              <div className="relative h-[340px] sm:h-[380px] w-full overflow-hidden rounded-2xl border border-[#007749]/30 bg-[#FEF3C7]">
                <VeldHabitatBackdrop />

                {/* Habitat Info Caption (Top Left) */}
                <div className="absolute left-4 top-4 rounded-xl bg-white/95 border border-slate-200/90 px-3.5 py-2 shadow-sm">
                  <p className="text-xs font-bold text-[#1E293B]">
                    {activeAdoptedPet.name} the {activeAdoptedPet.species}
                  </p>
                  <p className="text-[11px] font-medium text-slate-600">
                    {activeAdoptedPet.age} years old · {profile.schoolName}
                  </p>
                </div>

                {/* Add Another Companion Quick Link (Top Right) */}
                {adoptedPets.length < SA_HERBIVORE_CATALOG.length && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('adopt')}
                    className="absolute right-4 top-4 rounded-xl bg-[#FFB81C] px-3.5 py-2 text-xs font-bold text-[#1E293B] shadow-sm hover:bg-[#eab308] transition-colors cursor-pointer"
                  >
                    + Adopt Another (R50)
                  </button>
                )}

                {/* Other Adopted Companions Hanging Out Nearby */}
                {adoptedPets
                  .filter((p) => p.id !== activeAdoptedPet.id)
                  .map((companion, idx) => (
                    <button
                      key={companion.id}
                      type="button"
                      onClick={() => {
                        setFocusedPetId(companion.id);
                        setSpeechBubble(null);
                        triggerMotion('hop', 700);
                      }}
                      title={`Say hello to ${companion.name}`}
                      className={`hidden sm:block absolute bottom-6 ${
                        idx === 0 ? 'left-[18%]' : idx === 1 ? 'right-[18%]' : 'left-[8%]'
                      } opacity-90 hover:opacity-100 hover:scale-105 transition-transform cursor-pointer`}
                    >
                      <PetIllustration petId={companion.id} className="h-20 w-24" />
                    </button>
                  ))}

                {/* Active Pet Centerpiece + Speech Bubble + Floating Hearts */}
                <div className="absolute inset-x-0 bottom-4 flex flex-col items-center justify-end pointer-events-none px-4">
                  {speechBubble && (
                    <div
                      key={speechBubble}
                      className="animate-bubble-pop relative mb-2 max-w-md rounded-2xl border border-[#007749]/35 bg-white px-4 py-2.5 text-center text-sm font-medium text-[#1E293B] shadow-lg"
                    >
                      <p>{speechBubble}</p>
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-[#007749]/35 bg-white"
                      />
                    </div>
                  )}

                  <div className="relative flex items-center justify-center">
                    {/* Floating Hearts Layer */}
                    {floatingHearts.map((heart) => (
                      <span
                        key={heart.uid}
                        aria-hidden="true"
                        style={{
                          left: `${heart.leftPct}%`,
                          animationDelay: `${heart.delayMs}ms`,
                        }}
                        className="animate-heart-float absolute -top-2 text-2xl select-none"
                      >
                        ❤️
                      </span>
                    ))}

                    <div
                      className={
                        petMotion === 'hop'
                          ? 'animate-pet-hop'
                          : petMotion === 'play'
                            ? 'animate-pet-play'
                            : 'animate-pet-idle'
                      }
                    >
                      <PetIllustration
                        petId={activeAdoptedPet.id}
                        className="h-36 w-44 sm:h-44 sm:w-52 drop-shadow-md"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Bars + Care Controls Deck */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* Happiness & Tummy / Energy Status Bars */}
                <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-[#FBF8F1] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E293B]">
                      Companion Wellbeing
                    </h3>
                    {savingCare && (
                      <span className="text-xs font-medium text-[#007749]">Saving...</span>
                    )}
                  </div>

                  {/* Happiness Meter */}
                  <div>
                    <div className="flex items-center justify-between text-sm font-semibold text-[#1E293B]">
                      <span className="inline-flex items-center gap-1.5">
                        <Heart className="h-4 w-4 text-[#E03C31]" />
                        Happiness
                      </span>
                      <span className="tabular-nums text-[#007749]">
                        {activeAdoptedPet.happiness}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#007749] transition-all duration-300"
                        style={{ width: `${activeAdoptedPet.happiness}%` }}
                      />
                    </div>
                  </div>

                  {/* Tummy / Energy Meter */}
                  <div>
                    <div className="flex items-center justify-between text-sm font-semibold text-[#1E293B]">
                      <span className="inline-flex items-center gap-1.5">
                        <Utensils className="h-4 w-4 text-[#007749]" />
                        Tummy / Energy
                      </span>
                      <span className="tabular-nums text-[#B45309]">
                        {activeAdoptedPet.hunger}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#FFB81C] transition-all duration-300"
                        style={{ width: `${activeAdoptedPet.hunger}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      Favorite food: {getCatalogPetById(activeAdoptedPet.id).favoriteCrops} — ready to nourish in the upcoming Grade Produce Shop.
                    </p>
                  </div>
                </div>

                {/* Interactive Care Buttons */}
                <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-[#FBF8F1] p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E293B]">
                      Interact & Care
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Every visit and care moment is saved automatically to your sponsor sanctuary.
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={handleSayHi}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[#001489]/25 bg-[#001489] px-4 py-3 text-sm font-semibold text-white hover:bg-[#001489]/90 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span>Say Hi 👋</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePetAndCuddle}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[#E03C31]/30 bg-[#E03C31] px-4 py-3 text-sm font-semibold text-white hover:bg-[#c83228] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span>Pet &amp; Cuddle ❤️</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePlayTogether}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[#007749]/30 bg-[#007749] px-4 py-3 text-sm font-semibold text-white hover:bg-[#065F46] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span>Play Together 🌿</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BACKSTORY & PROFILE MODAL */}
      {selectedCatalogPet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setSelectedCatalogPet(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pet-profile-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          >
            <div className="relative bg-gradient-to-b from-[#E0F2FE] via-[#FEF3C7] to-[#ECFDF5] px-6 pt-6 pb-4">
              <button
                type="button"
                onClick={() => setSelectedCatalogPet(null)}
                aria-label="Close companion profile"
                className="absolute right-4 top-4 rounded-lg bg-white/90 p-2 text-slate-700 hover:bg-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="animate-pet-idle">
                  <PetIllustration petId={selectedCatalogPet.id} className="h-36 w-44" />
                </div>
                <h3
                  id="pet-profile-modal-title"
                  className="mt-2 text-2xl font-bold text-[#1E293B]"
                >
                  {selectedCatalogPet.fullTitle}
                </h3>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#007749]">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{selectedCatalogPet.ageLabel} · {selectedCatalogPet.region}</span>
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Companion Backstory
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[#1E293B]">
                  {selectedCatalogPet.backstory}
                </p>
              </div>

              <div className="rounded-xl border border-[#007749]/20 bg-[#FBF8F1] p-3.5">
                <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007749]">
                  <Leaf className="h-3.5 w-3.5" />
                  Favorite School-Garden Harvest
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {selectedCatalogPet.favoriteCrops}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCatalogPet(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>

                {adoptedIdSet.has(selectedCatalogPet.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFocusedPetId(selectedCatalogPet.id);
                      setSelectedCatalogPet(null);
                      setActiveTab('habitat');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#001489] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#001489]/90 cursor-pointer"
                  >
                    <span>Visit in My Sanctuary</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenCheckout(selectedCatalogPet)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#007749] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#065F46] cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 text-[#FFB81C]" />
                    <span>Adopt for R50</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATED KARRI PAYMENT MODAL */}
      {checkoutPet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => !checkoutSubmitting && setCheckoutPet(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="karri-checkout-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          >
            {/* Karri Placeholder Header */}
            <div className="bg-[#001489] px-6 py-5 text-white">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-[#FFB81C]">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Karri School Payment Gateway
                  </span>
                </div>
                <button
                  type="button"
                  disabled={checkoutSubmitting}
                  onClick={() => setCheckoutPet(null)}
                  aria-label="Cancel simulated payment"
                  className="rounded-lg p-1.5 text-slate-200 hover:bg-white/10 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h3 id="karri-checkout-title" className="mt-2 text-lg font-bold">
                Simulated Sanctuary Adoption Checkout
              </h3>
              <p className="mt-0.5 text-xs text-blue-100">
                Preview placeholder for upcoming Karri school payment integration. No real card charge will occur.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-[#FBF8F1] p-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">Pet Name</span>
                  <span className="font-bold text-[#1E293B] text-right">
                    {checkoutPet.fullTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">School Supported</span>
                  <span className="font-semibold text-[#1E293B] text-right">
                    {profile.schoolName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">Grade(s) Supported</span>
                  <span className="font-semibold text-[#1E293B] text-right">
                    {profile.grades.join(', ')}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between gap-3">
                  <span className="font-semibold text-[#1E293B]">Amount</span>
                  <span className="text-xl font-bold text-[#007749] tabular-nums">
                    R{PET_ADOPTION_PRICE_ZAR}.00
                  </span>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={checkoutSubmitting}
                  onClick={() => setCheckoutPet(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={checkoutSubmitting}
                  onClick={handleCompleteSimulatedPayment}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007749] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#065F46] disabled:opacity-60 cursor-pointer"
                >
                  <span>
                    {checkoutSubmitting
                      ? 'Saving Adoption...'
                      : 'Complete Simulated R50 Payment'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
