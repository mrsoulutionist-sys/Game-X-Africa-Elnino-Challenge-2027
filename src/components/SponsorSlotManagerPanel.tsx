import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ImagePlus,
  Layers,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Tag,
  Trash2,
  Type,
} from 'lucide-react';
import type { AdminProfile } from '../firebase/adminService';
import {
  SPONSOR_CATALOG_BY_ID,
  SPONSOR_ROOM_TABS,
  SPONSOR_SLOT_CATALOG,
  clearSponsorSlotAsAdmin,
  resizeSponsorLogoToDataUrl,
  upsertSponsorSlotAsAdmin,
  type SponsorDisplayMode,
  type SponsorRoom,
  type SponsorSlotAssignment,
} from '../firebase/sponsorService';

interface SponsorSlotManagerPanelProps {
  admin: AdminProfile;
  sponsorSlots: Record<string, SponsorSlotAssignment>;
}

const ACCENT_PRESETS = [
  '#f59e0b',
  '#34d399',
  '#38bdf8',
  '#fb7185',
  '#a78bfa',
  '#22d3ee',
];

const BG_PRESETS = [
  '#0f172a',
  '#064e3b',
  '#172554',
  '#1c1917',
  '#31102f',
  '#042f2e',
];

export const SponsorSlotManagerPanel: React.FC<SponsorSlotManagerPanelProps> = ({
  admin,
  sponsorSlots,
}) => {
  const [activeRoom, setActiveRoom] = useState<SponsorRoom>('kitchen');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('kitchen_counter');

  const roomCatalog = useMemo(
    () => SPONSOR_SLOT_CATALOG.filter((item) => item.room === activeRoom),
    [activeRoom]
  );

  // Sync selectedSlotId when room changes
  useEffect(() => {
    if (!roomCatalog.some((item) => item.slotId === selectedSlotId)) {
      if (roomCatalog[0]) {
        setSelectedSlotId(roomCatalog[0].slotId);
      }
    }
  }, [roomCatalog, selectedSlotId]);

  const activeCatalog = SPONSOR_CATALOG_BY_ID[selectedSlotId] ?? roomCatalog[0];
  const existingAssignment = activeCatalog ? sponsorSlots[activeCatalog.slotId] : undefined;

  const [displayMode, setDisplayMode] = useState<SponsorDisplayMode>('both');
  const [partnerName, setPartnerName] = useState('');
  const [tagline, setTagline] = useState('');
  const [accentHex, setAccentHex] = useState('#f59e0b');
  const [bgHex, setBgHex] = useState('#0f172a');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [compressingLogo, setCompressingLogo] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hydrate form whenever slot selection or stored assignment updates
  useEffect(() => {
    if (!activeCatalog) return;
    setStatusMsg(null);
    setErrorMsg(null);
    if (existingAssignment && existingAssignment.active) {
      setDisplayMode(existingAssignment.displayMode);
      setPartnerName(existingAssignment.partnerName || activeCatalog.defaultPartnerName);
      setTagline(existingAssignment.tagline || activeCatalog.defaultTagline);
      setAccentHex(existingAssignment.accentHex || activeCatalog.defaultAccentHex);
      setBgHex(existingAssignment.bgHex || activeCatalog.defaultBgHex);
      setLogoDataUrl(existingAssignment.logoDataUrl || '');
    } else {
      setDisplayMode('text');
      setPartnerName(activeCatalog.defaultPartnerName);
      setTagline(activeCatalog.defaultTagline);
      setAccentHex(activeCatalog.defaultAccentHex);
      setBgHex(activeCatalog.defaultBgHex);
      setLogoDataUrl('');
    }
  }, [activeCatalog?.slotId, existingAssignment?.updatedAtMs, existingAssignment?.active]);

  const roomStats = useMemo(() => {
    const counts: Record<SponsorRoom, { total: number; occupied: number }> = {
      kitchen: { total: 0, occupied: 0 },
      garden: { total: 0, occupied: 0 },
      compost: { total: 0, occupied: 0 },
      platform: { total: 0, occupied: 0 },
    };
    for (const item of SPONSOR_SLOT_CATALOG) {
      counts[item.room].total += 1;
      if (sponsorSlots[item.slotId]?.active) {
        counts[item.room].occupied += 1;
      }
    }
    return counts;
  }, [sponsorSlots]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setCompressingLogo(true);
    try {
      const dataUrl = await resizeSponsorLogoToDataUrl(file);
      setLogoDataUrl(dataUrl);
      if (displayMode === 'text') {
        setDisplayMode('both');
      }
      setStatusMsg('Logo compressed & ready for 3D decal + UI preview. Click Save Slot to publish live.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to process image file.');
    } finally {
      setCompressingLogo(false);
      e.target.value = '';
    }
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCatalog || saving) return;
    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await upsertSponsorSlotAsAdmin({
        admin,
        slotId: activeCatalog.slotId,
        displayMode,
        partnerName,
        tagline,
        accentHex,
        bgHex,
        logoDataUrl,
        active: true,
      });
      setStatusMsg(
        `Published "${partnerName || activeCatalog.label}" live to ${activeCatalog.label}! Learners inside the 3D workshop see this immediately.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save sponsor slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearSlot = async () => {
    if (!activeCatalog || saving) return;
    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await clearSponsorSlotAsAdmin(admin, activeCatalog.slotId);
      setLogoDataUrl('');
      setDisplayMode('text');
      setPartnerName(activeCatalog.defaultPartnerName);
      setTagline(activeCatalog.defaultTagline);
      setStatusMsg(`Reset "${activeCatalog.label}" back to an Available Partner Slot.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to clear slot.');
    } finally {
      setSaving(false);
    }
  };

  const showPreviewLogo =
    Boolean(logoDataUrl) && (displayMode === 'logo' || displayMode === 'both');
  const showPreviewText = displayMode === 'text' || displayMode === 'both';

  const totalOccupied = Object.values(roomStats).reduce((s, r) => s + r.occupied, 0);

  return (
    <div className="space-y-5">
      {/* Header Summary Banner */}
      <section className="rounded-2xl bg-slate-900/90 border border-amber-500/35 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-300 text-xs font-mono uppercase tracking-wider font-bold">
              <Building2 className="w-4 h-4" />
              <span>Sponsor Slot Manager · Real-Time 3D &amp; Portal Branding</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white mt-1">
              Assign Brand Wording, Logos &amp; Colours Per Room &amp; Object
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Pick a room below (starting with <strong>Kitchen Lab</strong>), choose an exact 3D prop or available wall panel from the dropdown or visual list, and push a brand logo, custom wording, or both live into every connected school workshop.
            </p>
          </div>

          <div className="rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-right shrink-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Inventory Filled
            </div>
            <div className="text-xl font-extrabold font-mono text-emerald-300 tabular-nums">
              {totalOccupied} / {SPONSOR_SLOT_CATALOG.length}
            </div>
            <div className="text-[10px] text-slate-400">Brandable Slots</div>
          </div>
        </div>

        {/* Room Selector Tabs */}
        <div
          role="tablist"
          aria-label="Sponsor Room Tabs"
          className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"
        >
          {SPONSOR_ROOM_TABS.map((tab) => {
            const active = tab.id === activeRoom;
            const stats = roomStats[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveRoom(tab.id)}
                className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-950/75 border-emerald-400 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold">{tab.title}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold tabular-nums ${
                      stats.occupied > 0
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {stats.occupied}/{stats.total}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-snug">
                  {tab.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Split: Room Dropdown + Slot List (Left 5 cols) & Slot Editor + Live Preview (Right 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Dropdown + Clickable Slot Inventory for Selected Room */}
        <section className="lg:col-span-5 rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-4">
          <div>
            <label
              htmlFor="sponsor-slot-dropdown"
              className="block text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1.5"
            >
              {SPONSOR_ROOM_TABS.find((t) => t.id === activeRoom)?.title} — Select Item or Panel
            </label>
            <select
              id="sponsor-slot-dropdown"
              value={activeCatalog?.slotId ?? ''}
              onChange={(e) => setSelectedSlotId(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              {roomCatalog.map((item) => {
                const assigned = sponsorSlots[item.slotId];
                const tag = assigned?.active
                  ? `[SPONSORED: ${assigned.partnerName || 'Logo'}]`
                  : '[Available]';
                return (
                  <option key={item.slotId} value={item.slotId}>
                    {item.label} {tag}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
            {roomCatalog.map((item) => {
              const selected = item.slotId === activeCatalog?.slotId;
              const assigned = sponsorSlots[item.slotId];
              const isSponsored = Boolean(assigned?.active);
              return (
                <button
                  key={item.slotId}
                  type="button"
                  onClick={() => setSelectedSlotId(item.slotId)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                    selected
                      ? 'bg-emerald-950/60 border-emerald-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{item.label}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {item.categoryLabel}
                    </div>
                    {isSponsored && assigned?.partnerName && (
                      <div className="mt-1 text-[10px] font-mono text-amber-300 truncate">
                        Live: {assigned.partnerName} ({assigned.displayMode.toUpperCase()})
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                      isSponsored
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isSponsored ? 'LIVE' : 'OPEN'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* RIGHT: Live Editor Form & Visual Plaque Preview */}
        {activeCatalog && (
          <form
            onSubmit={handleSaveSlot}
            className="lg:col-span-7 rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-5"
          >
            <div className="border-b border-slate-800 pb-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider font-bold text-amber-300">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{activeCatalog.categoryLabel}</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Slot ID: {activeCatalog.slotId}
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-white mt-1">{activeCatalog.label}</h3>
              <p className="text-xs text-slate-300 mt-1">{activeCatalog.description}</p>
              <p className="text-[11px] font-mono text-emerald-300 mt-1">
                Suggested Fit: {activeCatalog.suggestedBrandUse}
              </p>
            </div>

            {/* Live 3D Plaque Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <span>Live 3D Sign / UI Plaque Preview</span>
                <span>{displayMode.toUpperCase()} MODE</span>
              </div>
              <div
                style={{
                  backgroundColor: bgHex,
                  borderColor: accentHex,
                }}
                className="rounded-xl border-2 px-5 py-4 flex items-center justify-center gap-4 min-h-[108px] shadow-inner"
              >
                {showPreviewLogo ? (
                  <div className="h-16 max-w-[160px] rounded-lg bg-white px-2.5 py-1 flex items-center justify-center shrink-0">
                    <img
                      src={logoDataUrl}
                      alt="Uploaded sponsor preview"
                      className="max-h-14 w-auto object-contain"
                    />
                  </div>
                ) : displayMode === 'logo' ? (
                  <span className="text-xs font-mono text-amber-300">
                    Upload an image logo below to preview Logo-Only mode
                  </span>
                ) : null}

                {showPreviewText && (
                  <div className={showPreviewLogo ? 'text-left min-w-0' : 'text-center min-w-0'}>
                    <div
                      style={{ color: accentHex }}
                      className="text-[10px] font-mono font-bold uppercase tracking-widest"
                    >
                      Official Sponsor
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
                      {partnerName.trim() || activeCatalog.defaultPartnerName}
                    </div>
                    {tagline.trim() && (
                      <div className="text-xs text-slate-200/90 mt-0.5 truncate">
                        {tagline}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Display Mode Selector */}
            <div>
              <span className="block text-xs font-bold text-slate-200 mb-2">
                What Should Display On This Slot?
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'text', label: 'Wording Only', icon: Type },
                    { id: 'logo', label: 'Logo Image', icon: ImagePlus },
                    { id: 'both', label: 'Logo + Wording', icon: Layers },
                  ] as const
                ).map((modeOpt) => {
                  const Icon = modeOpt.icon;
                  const active = displayMode === modeOpt.id;
                  return (
                    <button
                      key={modeOpt.id}
                      type="button"
                      onClick={() => setDisplayMode(modeOpt.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-2 text-xs font-bold cursor-pointer transition-colors ${
                        active
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{modeOpt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Partner Name & Tagline Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="sponsor-partner-name"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Partner / Sponsor Name
                </label>
                <input
                  id="sponsor-partner-name"
                  type="text"
                  maxLength={60}
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder={activeCatalog.defaultPartnerName}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label
                  htmlFor="sponsor-tagline"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Tagline / Short Callout
                </label>
                <input
                  id="sponsor-tagline"
                  type="text"
                  maxLength={90}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder={activeCatalog.defaultTagline}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Logo Uploader */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="sponsor-logo-upload"
                  className="text-xs font-bold text-slate-200 flex items-center gap-1.5"
                >
                  <ImagePlus className="w-4 h-4 text-sky-400" />
                  <span>Upload Sponsor Logo (PNG, JPG, WEBP, SVG — auto-optimized)</span>
                </label>
                {logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoDataUrl('');
                      if (displayMode === 'logo' || displayMode === 'both') {
                        setDisplayMode('text');
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 hover:text-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove Logo</span>
                  </button>
                )}
              </div>

              <input
                id="sponsor-logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={compressingLogo}
                onChange={handleLogoUpload}
                className="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-sky-500 cursor-pointer"
              />
              {compressingLogo && (
                <p className="text-[11px] font-mono text-sky-300">Optimizing logo for 3D textures...</p>
              )}
            </div>

            {/* Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                  <span className="inline-flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5 text-amber-300" />
                    Accent / Frame Colour
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">{accentHex}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {ACCENT_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Accent ${hex}`}
                      onClick={() => setAccentHex(hex)}
                      style={{ backgroundColor: hex }}
                      className={`h-7 w-7 rounded-lg border-2 cursor-pointer ${
                        accentHex.toLowerCase() === hex ? 'border-white scale-105' : 'border-slate-800'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="Custom accent colour"
                    value={accentHex}
                    onChange={(e) => setAccentHex(e.target.value)}
                    className="h-7 w-9 rounded bg-slate-950 border border-slate-700 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                    Plaque Background Colour
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">{bgHex}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {BG_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Background ${hex}`}
                      onClick={() => setBgHex(hex)}
                      style={{ backgroundColor: hex }}
                      className={`h-7 w-7 rounded-lg border-2 cursor-pointer ${
                        bgHex.toLowerCase() === hex ? 'border-white scale-105' : 'border-slate-700'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="Custom background colour"
                    value={bgHex}
                    onChange={(e) => setBgHex(e.target.value)}
                    className="h-7 w-9 rounded bg-slate-950 border border-slate-700 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {statusMsg && (
              <div className="rounded-xl bg-emerald-950/60 border border-emerald-500/45 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{statusMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl bg-rose-950/60 border border-rose-500/45 px-3.5 py-2.5 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {existingAssignment?.active ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleClearSlot}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 hover:border-rose-500/60 hover:text-rose-200 px-4 py-2.5 text-xs font-bold text-slate-300 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Available Slot</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Slot currently showing default workshop signage
                </span>
              )}

              <button
                type="submit"
                disabled={saving || compressingLogo}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 px-5 py-2.5 text-sm font-extrabold text-white cursor-pointer transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Publishing to 3D...' : 'Save & Publish Sponsor Slot'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
