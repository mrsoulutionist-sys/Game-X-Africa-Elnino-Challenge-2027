import React from 'react';
import { Award } from 'lucide-react';
import {
  SPONSOR_CATALOG_BY_ID,
  type SponsorSlotAssignment,
} from '../firebase/sponsorService';

interface SponsorBannerStripProps {
  slot?: SponsorSlotAssignment;
  slotId: string;
  theme?: 'light' | 'dark';
}

export const SponsorBannerStrip: React.FC<SponsorBannerStripProps> = ({
  slot,
  slotId,
  theme = 'light',
}) => {
  if (!slot || !slot.active) return null;

  const catalog = SPONSOR_CATALOG_BY_ID[slotId];
  const showLogo =
    Boolean(slot.logoDataUrl) &&
    (slot.displayMode === 'logo' || slot.displayMode === 'both');
  const showText = slot.displayMode === 'text' || slot.displayMode === 'both';

  const borderColor = slot.accentHex || catalog?.defaultAccentHex || '#10b981';
  const bgColor = slot.bgHex || catalog?.defaultBgHex || '#0f172a';

  return (
    <aside
      aria-label={`Official Sponsor: ${slot.partnerName || catalog?.label || slotId}`}
      style={{
        backgroundColor: bgColor,
        borderColor,
      }}
      className={`rounded-2xl border-2 px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3 ${
        theme === 'dark' ? 'text-white' : 'text-white'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {showLogo && (
          <div className="h-11 max-w-[140px] shrink-0 rounded-xl bg-white/95 px-2.5 py-1 flex items-center justify-center overflow-hidden border border-white/20">
            <img
              src={slot.logoDataUrl}
              alt={`${slot.partnerName || 'Sponsor'} logo`}
              className="max-h-9 w-auto object-contain"
            />
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider font-bold">
            <Award className="h-3.5 w-3.5 shrink-0" style={{ color: borderColor }} />
            <span style={{ color: borderColor }}>
              Official Partner · {catalog?.categoryLabel ?? 'Platform Sponsor'}
            </span>
          </div>

          {showText ? (
            <>
              <p className="text-sm sm:text-base font-extrabold text-white truncate">
                {slot.partnerName || catalog?.defaultPartnerName}
              </p>
              {slot.tagline && (
                <p className="text-xs text-slate-200/90 truncate">{slot.tagline}</p>
              )}
            </>
          ) : (
            <p className="text-xs font-semibold text-slate-200 truncate">
              {slot.partnerName || catalog?.label}
            </p>
          )}
        </div>
      </div>

      <span
        style={{ borderColor, color: borderColor }}
        className="rounded-lg border bg-black/25 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0"
      >
        Sponsored Placement
      </span>
    </aside>
  );
};
