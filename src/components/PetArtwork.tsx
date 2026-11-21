import React from 'react';
import type { PetId } from './petData';

interface PetIllustrationProps {
  petId: PetId;
  className?: string;
  interactive?: boolean;
  activePartId?: string | null;
  onPartClick?: (partId: string) => void;
}

export const PetIllustration: React.FC<PetIllustrationProps> = ({
  petId,
  className = 'w-28 h-28',
  interactive = false,
  activePartId = null,
  onPartClick,
}) => {
  const partProps = (partId: string, label: string) => {
    if (!interactive || !onPartClick) return {};
    const isSelected = activePartId === partId;
    return {
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': `Inspect ${label}`,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onPartClick(partId);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onPartClick(partId);
        }
      },
      className: `cursor-pointer transition-opacity focus:outline-none hover:opacity-85 ${
        isSelected ? 'drop-shadow-[0_0_8px_rgba(255,184,28,0.9)]' : ''
      }`,
    };
  };

  switch (petId) {
    case 'thabo-tortoise':
      return (
        <svg
          viewBox="0 0 180 150"
          className={className}
          aria-label="Thabo the Leopard Tortoise"
        >
          {/* Ground shadow */}
          <ellipse cx="90" cy="133" rx="60" ry="10" fill="#1E293B" opacity="0.16" />
          {/* Back & front legs (Clickable: legs) */}
          <g {...partProps('legs', 'Thabo’s scaly legs')}>
            <rect x="44" y="102" width="18" height="27" rx="8" fill="#8C6D46" />
            <rect x="104" y="102" width="18" height="27" rx="8" fill="#8C6D46" />
            <path d="M46 125 h4 M52 126 h4" stroke="#5C4428" strokeWidth="2" strokeLinecap="round" />
            <path d="M106 125 h4 M112 126 h4" stroke="#5C4428" strokeWidth="2" strokeLinecap="round" />
          </g>
          {/* Neck & friendly head (Clickable: head) */}
          <g {...partProps('head', 'Thabo’s head and beak')}>
            <path
              d="M118 96 Q142 94 150 82 Q158 70 144 65 Q130 62 122 76 Z"
              fill="#A68557"
            />
            <circle cx="144" cy="75" r="13" fill="#A68557" />
            <circle cx="148" cy="72" r="3" fill="#1E293B" />
            <circle cx="149" cy="71" r="1" fill="#FFFFFF" />
            <path
              d="M142 81 Q149 85 155 80"
              fill="none"
              stroke="#3F2E1A"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
          {/* Domed leopard tortoise shell (Clickable: shell) */}
          <g {...partProps('shell', 'Thabo’s domed rosette shell')}>
            <path
              d="M28 106 C28 52, 130 48, 132 106 Z"
              fill="#FFB81C"
              stroke="#3B2B15"
              strokeWidth="3"
            />
            <path
              d="M24 106 Q80 115 135 106 Q134 99 80 101 Q26 99 24 106 Z"
              fill="#5C4428"
            />
            <g fill="#2B2118" opacity="0.88">
              <ellipse cx="62" cy="76" rx="11" ry="8" />
              <ellipse cx="92" cy="72" rx="12" ry="9" />
              <ellipse cx="46" cy="92" rx="9" ry="7" />
              <ellipse cx="77" cy="92" rx="10" ry="7" />
              <ellipse cx="109" cy="90" rx="10" ry="7" />
            </g>
            <g fill="#FDE68A" opacity="0.9">
              <circle cx="62" cy="76" r="4.5" />
              <circle cx="92" cy="72" r="5" />
              <circle cx="46" cy="92" r="3.5" />
              <circle cx="77" cy="92" r="4" />
              <circle cx="109" cy="90" r="4" />
            </g>
          </g>
          {/* Crisp green garden leaf (Clickable: snack) */}
          <g {...partProps('snack', 'garden spinach leaf')}>
            <path
              d="M153 83 Q170 72 169 87 Q160 92 153 83 Z"
              fill="#007749"
            />
            <circle cx="161" cy="83" r="10" fill="transparent" />
          </g>
        </svg>
      );

    case 'zuri-rabbit':
      return (
        <svg
          viewBox="0 0 180 150"
          className={className}
          aria-label="Zuri the Riverine Rabbit"
        >
          <ellipse cx="90" cy="134" rx="46" ry="9" fill="#1E293B" opacity="0.16" />
          {/* Fluffy tail & hind paws (Clickable: paws) */}
          <g {...partProps('paws', 'Zuri’s fluffy tail and hind paws')}>
            <circle cx="46" cy="108" r="12" fill="#F5EFE0" stroke="#9C8468" strokeWidth="2" />
            <ellipse cx="66" cy="126" rx="18" ry="8" fill="#B89F82" />
            <ellipse cx="105" cy="126" rx="10" ry="6.5" fill="#B89F82" />
            <ellipse cx="82" cy="103" rx="34" ry="26" fill="#C7B093" />
            <ellipse cx="92" cy="108" rx="20" ry="16" fill="#F5EFE0" opacity="0.85" />
          </g>
          {/* Tall riverine rabbit ears (Clickable: ears) */}
          <g {...partProps('ears', 'Zuri’s tall velvet ears')}>
            <g transform="rotate(-12 96 42)">
              <ellipse cx="96" cy="36" rx="9" ry="28" fill="#B89F82" stroke="#6E5840" strokeWidth="2" />
              <ellipse cx="96" cy="38" rx="5" ry="20" fill="#F4A89F" />
            </g>
            <g transform="rotate(10 116 42)">
              <ellipse cx="116" cy="36" rx="9" ry="28" fill="#C7B093" stroke="#6E5840" strokeWidth="2" />
              <ellipse cx="116" cy="38" rx="5" ry="20" fill="#F4A89F" />
            </g>
          </g>
          {/* Head, white eye-ring & pink nose (Clickable: head) */}
          <g {...partProps('head', 'Zuri’s eye-ring and twitchy nose')}>
            <circle cx="110" cy="74" r="24" fill="#C7B093" />
            <circle cx="118" cy="70" r="7" fill="#FFFFFF" opacity="0.9" />
            <circle cx="119" cy="70" r="3.5" fill="#1E293B" />
            <circle cx="120" cy="69" r="1.2" fill="#FFFFFF" />
            <ellipse cx="132" cy="77" rx="4" ry="3" fill="#E03C31" opacity="0.8" />
            <path
              d="M126 82 Q131 86 135 82"
              fill="none"
              stroke="#5C4428"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
          {/* Little orange carrot snack (Clickable: snack) */}
          <g {...partProps('snack', 'Zuri’s garden carrot')}>
            <path d="M138 92 L156 84 L152 96 Z" fill="#F97316" />
            <path d="M153 86 L162 80 M155 88 L164 88" stroke="#007749" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="150" cy="89" r="12" fill="transparent" />
          </g>
        </svg>
      );

    case 'kudu-grysbok':
      return (
        <svg
          viewBox="0 0 180 150"
          className={className}
          aria-label="Kudu the Cape Grysbok"
        >
          <ellipse cx="92" cy="136" rx="48" ry="8" fill="#1E293B" opacity="0.16" />
          {/* Slender legs & hooves (Clickable: legs) */}
          <g {...partProps('legs', 'Kudu’s delicate hooves')}>
            <rect x="58" y="98" width="8" height="36" rx="4" fill="#A64B2A" />
            <rect x="74" y="100" width="8" height="34" rx="4" fill="#8C3D20" />
            <rect x="104" y="100" width="8" height="34" rx="4" fill="#8C3D20" />
            <rect x="116" y="98" width="8" height="36" rx="4" fill="#A64B2A" />
            <rect x="58" y="129" width="8" height="6" rx="2" fill="#1E293B" />
            <rect x="74" y="129" width="8" height="6" rx="2" fill="#1E293B" />
            <rect x="104" y="129" width="8" height="6" rx="2" fill="#1E293B" />
            <rect x="116" y="129" width="8" height="6" rx="2" fill="#1E293B" />
          </g>
          {/* Body & grizzled white-flecked coat (Clickable: coat) */}
          <g {...partProps('coat', 'Kudu’s grizzled fynbos coat')}>
            <ellipse cx="89" cy="88" rx="37" ry="22" fill="#C45732" />
            <g fill="#F8FAFC" opacity="0.78">
              <circle cx="70" cy="83" r="1.5" />
              <circle cx="80" cy="79" r="1.4" />
              <circle cx="92" cy="84" r="1.5" />
              <circle cx="101" cy="78" r="1.4" />
              <circle cx="76" cy="91" r="1.3" />
              <circle cx="96" cy="93" r="1.4" />
            </g>
            <ellipse cx="51" cy="84" rx="7" ry="4" fill="#F8FAFC" />
          </g>
          {/* Neck, head, horns & alert ears (Clickable: ears) */}
          <g {...partProps('ears', 'Kudu’s ears and tiny horns')}>
            <path d="M108 84 L118 52 L132 56 L122 90 Z" fill="#C45732" />
            <ellipse cx="114" cy="36" rx="7" ry="16" transform="rotate(-18 114 36)" fill="#B54925" />
            <ellipse cx="114" cy="37" rx="4" ry="11" transform="rotate(-18 114 37)" fill="#F7C5B4" />
            <ellipse cx="131" cy="35" rx="7" ry="16" transform="rotate(16 131 35)" fill="#C45732" />
            <ellipse cx="131" cy="36" rx="4" ry="11" transform="rotate(16 131 36)" fill="#F7C5B4" />
            <path d="M120 40 L118 26 M127 40 L130 26" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="129" cy="54" rx="18" ry="13" fill="#C45732" />
            <ellipse cx="142" cy="57" rx="8" ry="6" fill="#F2D0BE" />
            <circle cx="130" cy="51" r="3.4" fill="#1E293B" />
            <circle cx="131" cy="50" r="1.1" fill="#FFFFFF" />
            <circle cx="147" cy="55" r="2.6" fill="#1E293B" />
          </g>
          {/* Sweet clover leaf (Clickable: snack) */}
          <g {...partProps('snack', 'sweet clover shoot')}>
            <path d="M148 64 Q159 56 161 65 Q153 70 148 64 Z" fill="#007749" />
            <circle cx="154" cy="64" r="10" fill="transparent" />
          </g>
        </svg>
      );

    case 'biko-dassie':
      return (
        <svg
          viewBox="0 0 180 150"
          className={className}
          aria-label="Biko the Rock Hyrax (Dassie)"
        >
          {/* Table Mountain warm basking rock & paws (Clickable: rock) */}
          <g {...partProps('rock', 'Biko’s basking rock and gripping paws')}>
            <path
              d="M24 134 Q36 108 88 110 Q140 108 156 134 Z"
              fill="#94A3B8"
              stroke="#64748B"
              strokeWidth="2"
            />
            <path d="M40 124 Q88 116 138 124" stroke="#CBD5E1" strokeWidth="2" fill="none" />
            <ellipse cx="64" cy="113" rx="10" ry="5.5" fill="#4E3826" />
            <ellipse cx="108" cy="113" rx="10" ry="5.5" fill="#4E3826" />
          </g>
          {/* Round cosy body (Clickable: body) */}
          <g {...partProps('body', 'Biko’s warm fur coat')}>
            <ellipse cx="86" cy="92" rx="42" ry="27" fill="#7C5C43" />
            <ellipse cx="90" cy="98" rx="28" ry="16" fill="#9E7B5E" opacity="0.7" />
          </g>
          {/* Head, rounded ears & whiskered snout (Clickable: head) */}
          <g {...partProps('head', 'Biko’s ears, whiskers, and tiny tusks')}>
            <circle cx="106" cy="58" r="7" fill="#634630" />
            <circle cx="106" cy="58" r="3.5" fill="#D4A98E" />
            <circle cx="128" cy="59" r="7" fill="#7C5C43" />
            <circle cx="128" cy="59" r="3.5" fill="#D4A98E" />
            <circle cx="120" cy="76" r="22" fill="#8A684C" />
            <ellipse cx="131" cy="82" rx="12" ry="9" fill="#B59173" />
            <circle cx="121" cy="71" r="3.3" fill="#1E293B" />
            <circle cx="122" cy="70" r="1.1" fill="#FFFFFF" />
            <ellipse cx="137" cy="79" rx="3.2" ry="2.2" fill="#2B1E16" />
            <path
              d="M128 85 Q134 89 140 85"
              fill="none"
              stroke="#2B1E16"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
          {/* Crisp garden leaf beside Biko (Clickable: snack) */}
          <g {...partProps('snack', 'crisp garden parsley leaf')}>
            <path d="M142 106 Q157 95 160 109 Q149 114 142 106 Z" fill="#007749" />
            <circle cx="151" cy="105" r="10" fill="transparent" />
          </g>
        </svg>
      );
  }
};

export const VeldHabitatBackdrop: React.FC = () => {
  return (
    <svg
      viewBox="0 0 960 400"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="saSkyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="55%" stopColor="#FEF3C7" />
          <stop offset="100%" stopColor="#FDE68A" />
        </linearGradient>
        <linearGradient id="saVeldHills" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4D7C0F" />
          <stop offset="100%" stopColor="#007749" />
        </linearGradient>
      </defs>

      {/* Warm South African morning sky */}
      <rect width="960" height="400" fill="url(#saSkyGrad)" />

      {/* African Sun & soft glow */}
      <circle cx="810" cy="82" r="56" fill="#FFB81C" opacity="0.24" />
      <circle cx="810" cy="82" r="36" fill="#FFB81C" />

      {/* Table Mountain / Karoo Koppie silhouette */}
      <path
        d="M0 245 L110 185 L180 198 L290 142 L510 142 L615 200 L760 172 L960 225 L960 400 L0 400 Z"
        fill="#1E293B"
        opacity="0.22"
      />
      <path
        d="M0 265 Q240 218 490 250 T960 240 L960 400 L0 400 Z"
        fill="#65A30D"
        opacity="0.45"
      />

      {/* Foreground lush veld & school garden meadow */}
      <path
        d="M0 278 Q320 252 640 272 T960 265 L960 400 L0 400 Z"
        fill="url(#saVeldHills)"
      />
      <ellipse cx="480" cy="348" rx="230" ry="38" fill="#F5EFE0" opacity="0.32" />

      {/* JoJo Rainwater Harvesting Tank in the Left-Center Background */}
      <g transform="translate(88, 134)">
        <rect x="6" y="112" width="108" height="16" rx="3" fill="#64748B" />
        <rect x="14" y="128" width="12" height="22" fill="#475569" />
        <rect x="94" y="128" width="12" height="22" fill="#475569" />
        <rect
          x="10"
          y="16"
          width="100"
          height="98"
          rx="14"
          fill="#007749"
          stroke="#064E3B"
          strokeWidth="3"
        />
        <line x1="12" y1="42" x2="108" y2="42" stroke="#065F46" strokeWidth="3" />
        <line x1="12" y1="68" x2="108" y2="68" stroke="#065F46" strokeWidth="3" />
        <line x1="12" y1="92" x2="108" y2="92" stroke="#065F46" strokeWidth="3" />
        <ellipse cx="60" cy="16" rx="34" ry="7" fill="#065F46" />
        <path d="M0 6 H38 V16" fill="none" stroke="#E2E8F0" strokeWidth="6" strokeLinecap="round" />
        <rect x="28" y="48" width="64" height="18" rx="4" fill="#FFB81C" />
        <text
          x="60"
          y="60"
          textAnchor="middle"
          fontSize="9"
          fontWeight="bold"
          fill="#1E293B"
        >
          JOJO TANK
        </text>
      </g>

      {/* School Garden Wooden Raised Bed (Right Background) */}
      <g transform="translate(710, 224)">
        <rect x="0" y="34" width="180" height="44" rx="5" fill="#92400E" stroke="#78350F" strokeWidth="2" />
        <line x1="0" y1="56" x2="180" y2="56" stroke="#78350F" strokeWidth="2" />
        <g fill="#16A34A">
          <circle cx="30" cy="28" r="14" />
          <circle cx="58" cy="24" r="15" />
          <circle cx="88" cy="27" r="14" />
          <circle cx="118" cy="25" r="15" />
          <circle cx="148" cy="28" r="14" />
        </g>
        <g fill="#4ADE80" opacity="0.7">
          <circle cx="28" cy="24" r="6" />
          <circle cx="86" cy="23" r="6" />
          <circle cx="146" cy="24" r="6" />
        </g>
      </g>

      {/* Indigenous King Protea & Fynbos Clusters */}
      <g transform="translate(245, 290)">
        <path d="M0 32 L-10 4 M0 32 L10 6 M0 32 L0 0" stroke="#14532D" strokeWidth="4" strokeLinecap="round" />
        <path d="M-16 6 L0 -16 L16 6 Z" fill="#E03C31" />
        <path d="M-10 6 L0 -12 L10 6 Z" fill="#FFB81C" />
      </g>

      <g transform="translate(650, 305)">
        <path d="M0 28 L-14 4 L-4 28 L0 0 L4 28 L14 6 Z" fill="#065F46" />
        <circle cx="0" cy="-2" r="9" fill="#E03C31" />
        <circle cx="0" cy="-2" r="4" fill="#FFB81C" />
      </g>
    </svg>
  );
};
