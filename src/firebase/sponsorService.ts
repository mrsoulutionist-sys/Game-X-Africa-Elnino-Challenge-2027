import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
} from './firebaseClient';
import type { AdminProfile } from './adminService';

export type SponsorRoom = 'kitchen' | 'garden' | 'compost' | 'platform';
export type SponsorDisplayMode = 'text' | 'logo' | 'both';

export interface SponsorSlotCatalogItem {
  slotId: string;
  room: SponsorRoom;
  targetKey: string;
  label: string;
  categoryLabel: string;
  description: string;
  suggestedBrandUse: string;
  defaultPartnerName: string;
  defaultTagline: string;
  defaultAccentHex: string;
  defaultBgHex: string;
}

export interface SponsorSlotAssignment {
  slotId: string;
  room: SponsorRoom;
  targetKey: string;
  label: string;
  displayMode: SponsorDisplayMode;
  partnerName: string;
  tagline: string;
  accentHex: string;
  bgHex: string;
  logoDataUrl: string;
  active: boolean;
  updatedByAdminName: string;
  updatedAtMs: number;
}

export const SPONSOR_ROOM_TABS: Array<{
  id: SponsorRoom;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'kitchen',
    title: 'Kitchen Lab',
    subtitle: 'Counter, Drill, Hacksaw, Table, PVC Piping, Seeds, Fridge, Sink & Wall Panels',
  },
  {
    id: 'garden',
    title: 'Garden Yard',
    subtitle: 'Vertical Rack, JoJo Tank, Shade Cloth, Weather Radar, Storm Kit & Fence Panels',
  },
  {
    id: 'compost',
    title: 'Compost & Drip Loop',
    subtitle: '2L Drip Bench, Composter Bay, Mulch Bench & Fence Rail Panels',
  },
  {
    id: 'platform',
    title: 'Store, Sanctuary & Scoreboard',
    subtitle: 'In-app sponsor banners across Grade Produce Store, Pet Sanctuary & Leaderboard',
  },
];

export const SPONSOR_SLOT_CATALOG: SponsorSlotCatalogItem[] = [
  // =========================================================================
  // KITCHEN (Props requested explicitly + every wall panel slot)
  // =========================================================================
  {
    slotId: 'kitchen_counter',
    room: 'kitchen',
    targetKey: 'counter',
    label: 'The Kitchen Counter',
    categoryLabel: 'Countertops & Prep Fascia',
    description: 'Front oak fascia banners across the North sink counter and West cabinetry.',
    suggestedBrandUse: 'Building / Cabinet / Home Supply Partner (e.g., Cashbuild)',
    defaultPartnerName: 'CASHBUILD LAB',
    defaultTagline: 'WORKSHOP COUNTERS · EL NINO',
    defaultAccentHex: '#f59e0b',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'kitchen_drill',
    room: 'kitchen',
    targetKey: 'drill',
    label: 'The Drill Station',
    categoryLabel: 'Power Tools & Hole-Saw',
    description: 'Tool pad plaque beside the 20mm hole-saw cordless drill on the island.',
    suggestedBrandUse: 'Power Tool / Hardware Brand (e.g., Bosch, Ryobi, Makro)',
    defaultPartnerName: 'PRO DRILL TOOL',
    defaultTagline: '20MM HOLE-SAW PORT MAKER',
    defaultAccentHex: '#38bdf8',
    defaultBgHex: '#082f49',
  },
  {
    slotId: 'kitchen_hacksaw',
    room: 'kitchen',
    targetKey: 'hacksaw',
    label: 'The Hacksaw Block',
    categoryLabel: 'Cutting & Fabrication Tools',
    description: 'Front plaque at the hacksaw mitre cutting guide & saw cradle.',
    suggestedBrandUse: 'Hand Tools & Hardware Sponsor',
    defaultPartnerName: 'PRECISION SAW',
    defaultTagline: 'CLEAN PVC CUTS · GRADE LAB',
    defaultAccentHex: '#f97316',
    defaultBgHex: '#1c1917',
  },
  {
    slotId: 'kitchen_table',
    room: 'kitchen',
    targetKey: 'table',
    label: 'The Table (Island Workbench)',
    categoryLabel: 'Central Fabrication Island',
    description: 'Full-width front & back apron signage wrapping the central island workbench.',
    suggestedBrandUse: 'Primary Room Anchor Sponsor (e.g., Cashbuild DIY)',
    defaultPartnerName: 'WORKBENCH HUB',
    defaultTagline: 'BUILD · DRILL · WICK · GROW',
    defaultAccentHex: '#34d399',
    defaultBgHex: '#064e3b',
  },
  {
    slotId: 'kitchen_pvc_piping',
    room: 'kitchen',
    targetKey: 'pvc_piping',
    label: 'The PVC Piping',
    categoryLabel: '50mm Pipe, Caps & Elbows',
    description: '3D collar brand plaque mounted on the assembled PVC hydroponic manifold & raw stock.',
    suggestedBrandUse: 'Plumbing & Hardware Supplier (e.g., Cashbuild Plumbing)',
    defaultPartnerName: '50MM ECO PVC',
    defaultTagline: 'CLOSED-LOOP PIPE RESERVOIR',
    defaultAccentHex: '#22d3ee',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'kitchen_seeds',
    room: 'kitchen',
    targetKey: 'seeds',
    label: 'The Seeds & Wicks Caddy',
    categoryLabel: 'Seedlings & Capillary Wicks',
    description: 'Seedling & cotton capillary wick tray header plaque on the island.',
    suggestedBrandUse: 'Seed & Nursery Brand (e.g., Stodels, Kirchhoffs)',
    defaultPartnerName: 'SEED & WICK',
    defaultTagline: 'DROUGHT-HARDY GREENS',
    defaultAccentHex: '#4ade80',
    defaultBgHex: '#14532d',
  },
  {
    slotId: 'kitchen_fridge',
    room: 'kitchen',
    targetKey: 'fridge',
    label: 'The Fridge',
    categoryLabel: 'Fresh Harvest Cold-Chain',
    description: 'Front stainless-steel refrigerator door magnetic sponsor billboard.',
    suggestedBrandUse: 'Appliance / Fresh Grocer / Dairy Partner',
    defaultPartnerName: 'FRESH KEEPER',
    defaultTagline: 'HARVEST COLD STORAGE',
    defaultAccentHex: '#60a5fa',
    defaultBgHex: '#172554',
  },
  {
    slotId: 'kitchen_sink',
    room: 'kitchen',
    targetKey: 'sink',
    label: 'The Prep Sink & Pitcher',
    categoryLabel: 'Water Measure & Reservoir Fill',
    description: 'Backsplash header plaque above the prep sink faucet and measuring pitcher.',
    suggestedBrandUse: 'Water Efficiency / Plumbing Fixture Sponsor',
    defaultPartnerName: 'WATER SMART',
    defaultTagline: 'MEASURE · CONSERVE · REFILL',
    defaultAccentHex: '#0ea5e9',
    defaultBgHex: '#0c4a6e',
  },
  {
    slotId: 'kitchen_panel_west',
    room: 'kitchen',
    targetKey: 'panel_west',
    label: 'Panel Available — West Hero Wall',
    categoryLabel: 'Wall Billboard (3.4m x 1.3m)',
    description: 'Large primary hero billboard on the left wall of the Kitchen Lab.',
    suggestedBrandUse: 'Headline Kitchen Anchor Sponsor',
    defaultPartnerName: 'KITCHEN HERO',
    defaultTagline: 'OPEN 3.4M BRAND WALL',
    defaultAccentHex: '#38bdf8',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'kitchen_panel_north',
    room: 'kitchen',
    targetKey: 'panel_north',
    label: 'Panel Available — North-East Plaque',
    categoryLabel: 'Wall Billboard (1.8m x 0.95m)',
    description: 'Eye-level wall plaque next to Door 2 Garden exit.',
    suggestedBrandUse: 'Curriculum or Safety Partner',
    defaultPartnerName: 'LAB PARTNER',
    defaultTagline: 'EL NINO CHALLENGE 2027',
    defaultAccentHex: '#34d399',
    defaultBgHex: '#064e3b',
  },
  {
    slotId: 'kitchen_rail_1',
    room: 'kitchen',
    targetKey: 'rail_1',
    label: 'Panel Available — East Rail Slot 01',
    categoryLabel: 'Modular Wall Rail',
    description: 'Top-left East wall 2x2 modular sponsor frame.',
    suggestedBrandUse: 'Local Co-Sponsor 01',
    defaultPartnerName: 'SLOT 01',
    defaultTagline: 'KITCHEN EAST RAIL',
    defaultAccentHex: '#a78bfa',
    defaultBgHex: '#1e1b4b',
  },
  {
    slotId: 'kitchen_rail_2',
    room: 'kitchen',
    targetKey: 'rail_2',
    label: 'Panel Available — East Rail Slot 02',
    categoryLabel: 'Modular Wall Rail',
    description: 'Top-right East wall 2x2 modular sponsor frame.',
    suggestedBrandUse: 'Local Co-Sponsor 02',
    defaultPartnerName: 'SLOT 02',
    defaultTagline: 'KITCHEN EAST RAIL',
    defaultAccentHex: '#f472b6',
    defaultBgHex: '#31102f',
  },
  {
    slotId: 'kitchen_rail_3',
    room: 'kitchen',
    targetKey: 'rail_3',
    label: 'Panel Available — East Rail Slot 03',
    categoryLabel: 'Modular Wall Rail',
    description: 'Bottom-left East wall 2x2 modular sponsor frame.',
    suggestedBrandUse: 'Local Co-Sponsor 03',
    defaultPartnerName: 'SLOT 03',
    defaultTagline: 'KITCHEN EAST RAIL',
    defaultAccentHex: '#fbbf24',
    defaultBgHex: '#271a06',
  },
  {
    slotId: 'kitchen_rail_4',
    room: 'kitchen',
    targetKey: 'rail_4',
    label: 'Panel Available — East Rail Slot 04',
    categoryLabel: 'Modular Wall Rail',
    description: 'Bottom-right East wall 2x2 modular sponsor frame.',
    suggestedBrandUse: 'Local Co-Sponsor 04',
    defaultPartnerName: 'SLOT 04',
    defaultTagline: 'KITCHEN EAST RAIL',
    defaultAccentHex: '#2dd4bf',
    defaultBgHex: '#042f2e',
  },

  // =========================================================================
  // GARDEN YARD
  // =========================================================================
  {
    slotId: 'garden_rack',
    room: 'garden',
    targetKey: 'rack',
    label: 'The Vertical Hydroponic Rack',
    categoryLabel: '2-to-6 Tier Grow Stand',
    description: 'Header crown sign mounted above the 2-to-6 tier timber & PVC rack.',
    suggestedBrandUse: 'Garden & Nursery Headline Sponsor (e.g., Stodels)',
    defaultPartnerName: 'STODELS GARDEN',
    defaultTagline: 'VERTICAL RACK · 75% WATER SAVED',
    defaultAccentHex: '#34d399',
    defaultBgHex: '#064e3b',
  },
  {
    slotId: 'garden_jojo',
    room: 'garden',
    targetKey: 'jojo',
    label: 'The JoJo Rainwater Tank',
    categoryLabel: '60L+ Rain Harvesting Tank',
    description: 'Chest badge & sign plaque attached directly to the rainwater harvesting tank.',
    suggestedBrandUse: 'Rainwater Tank / Irrigation Partner (e.g., JoJo Tanks)',
    defaultPartnerName: 'JOJO RESERVE',
    defaultTagline: 'RAINWATER HARVESTING HUB',
    defaultAccentHex: '#38bdf8',
    defaultBgHex: '#082f49',
  },
  {
    slotId: 'garden_shade_cloth',
    room: 'garden',
    targetKey: 'shade_cloth',
    label: 'The 40% Shade-Cloth Canopy',
    categoryLabel: 'Heatwave UV Shield',
    description: 'Front canopy crossbar fascia on the agricultural shade structure.',
    suggestedBrandUse: 'Agri-Netting / UV Protection Partner',
    defaultPartnerName: '40% SHADE GUARD',
    defaultTagline: '-35% HEATWAVE EVAPORATION',
    defaultAccentHex: '#fbbf24',
    defaultBgHex: '#1e293b',
  },
  {
    slotId: 'garden_weather_mast',
    room: 'garden',
    targetKey: 'weather_mast',
    label: 'Weather Radar & Anemometer Mast',
    categoryLabel: 'Real-Time Weather Station',
    description: 'Mast board mounted on the solar weather station & rotating wind cups.',
    suggestedBrandUse: 'Agri-Tech / Climate Sponsor',
    defaultPartnerName: 'CLIMATE WATCH',
    defaultTagline: 'STORM · WIND · HEAT RADAR',
    defaultAccentHex: '#60a5fa',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'garden_storm_kit',
    room: 'garden',
    targetKey: 'storm_kit',
    label: 'Windbreak & Storm Defense Kit',
    categoryLabel: 'Windbreak Net & Anchors',
    description: 'Sign plaque next to the deployable windbreak & storm anchor tie-downs.',
    suggestedBrandUse: 'Outdoor Hardware & Rope/Netting Partner',
    defaultPartnerName: 'STORM SHIELD',
    defaultTagline: 'WINDBREAK + ANCHOR KIT',
    defaultAccentHex: '#f59e0b',
    defaultBgHex: '#1c1917',
  },
  {
    slotId: 'garden_arch_panel',
    room: 'garden',
    targetKey: 'arch_panel',
    label: 'Panel Available — North Fence Arch',
    categoryLabel: 'Garden Hero Banner',
    description: 'High-visibility crown arch banner on the north garden boundary.',
    suggestedBrandUse: 'Regional Garden Anchor Sponsor',
    defaultPartnerName: 'GARDEN HERO',
    defaultTagline: 'EL NINO RESILIENCE ZONE',
    defaultAccentHex: '#4ade80',
    defaultBgHex: '#052e16',
  },
  {
    slotId: 'garden_west_panel',
    room: 'garden',
    targetKey: 'west_panel',
    label: 'Panel Available — West Fence Billboard',
    categoryLabel: 'Fence Billboard',
    description: 'Large timber fence panel behind the JoJo rainwater tank.',
    suggestedBrandUse: 'Water Conservation Partner',
    defaultPartnerName: 'WATER SAVER',
    defaultTagline: 'RAIN CAPTURE + DRIP',
    defaultAccentHex: '#22d3ee',
    defaultBgHex: '#083344',
  },
  {
    slotId: 'garden_rail_1',
    room: 'garden',
    targetKey: 'rail_1',
    label: 'Panel Available — East Fence Slot 01',
    categoryLabel: 'Modular Fence Rail',
    description: 'East garden fence 2x2 modular slot 01.',
    suggestedBrandUse: 'Garden Co-Sponsor 01',
    defaultPartnerName: 'GARDEN 01',
    defaultTagline: 'EAST FENCE SLOT',
    defaultAccentHex: '#34d399',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'garden_rail_2',
    room: 'garden',
    targetKey: 'rail_2',
    label: 'Panel Available — East Fence Slot 02',
    categoryLabel: 'Modular Fence Rail',
    description: 'East garden fence 2x2 modular slot 02.',
    suggestedBrandUse: 'Garden Co-Sponsor 02',
    defaultPartnerName: 'GARDEN 02',
    defaultTagline: 'EAST FENCE SLOT',
    defaultAccentHex: '#38bdf8',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'garden_rail_3',
    room: 'garden',
    targetKey: 'rail_3',
    label: 'Panel Available — East Fence Slot 03',
    categoryLabel: 'Modular Fence Rail',
    description: 'East garden fence 2x2 modular slot 03.',
    suggestedBrandUse: 'Garden Co-Sponsor 03',
    defaultPartnerName: 'GARDEN 03',
    defaultTagline: 'EAST FENCE SLOT',
    defaultAccentHex: '#f59e0b',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'garden_rail_4',
    room: 'garden',
    targetKey: 'rail_4',
    label: 'Panel Available — East Fence Slot 04',
    categoryLabel: 'Modular Fence Rail',
    description: 'East garden fence 2x2 modular slot 04.',
    suggestedBrandUse: 'Garden Co-Sponsor 04',
    defaultPartnerName: 'GARDEN 04',
    defaultTagline: 'EAST FENCE SLOT',
    defaultAccentHex: '#a78bfa',
    defaultBgHex: '#0f172a',
  },

  // =========================================================================
  // COMPOST & DRIP STATION
  // =========================================================================
  {
    slotId: 'compost_drip_bench',
    room: 'compost',
    targetKey: 'drip_bench',
    label: 'WS1: 2L Bottle Drip-Feeder Bench',
    categoryLabel: 'Workstation 1',
    description: 'Plaque mounted on the front apron of the 2L bottle root-drip workstation.',
    suggestedBrandUse: 'Recycling / Beverage PET Partner',
    defaultPartnerName: 'ECO DRIP 2L',
    defaultTagline: 'UPCYCLED BOTTLE IRRIGATION',
    defaultAccentHex: '#38bdf8',
    defaultBgHex: '#082f49',
  },
  {
    slotId: 'compost_bay',
    room: 'compost',
    targetKey: 'compost_bay',
    label: 'WS2: Composter Layering Bay',
    categoryLabel: 'Workstation 2',
    description: 'Header board above the Bucket / Crate / Pallet greens & browns compost bay.',
    suggestedBrandUse: 'Soil, Compost & Waste-Diversion Partner',
    defaultPartnerName: 'LIVING SOIL',
    defaultTagline: 'GREENS + BROWNS COMPOST',
    defaultAccentHex: '#34d399',
    defaultBgHex: '#052e16',
  },
  {
    slotId: 'compost_mulch_bench',
    room: 'compost',
    targetKey: 'mulch_bench',
    label: 'WS3: Mulch Collar Bench',
    categoryLabel: 'Workstation 3',
    description: 'Front bench plaque at the cardboard/newspaper moisture-shield workstation.',
    suggestedBrandUse: 'Packaging / Cardboard Recycling Partner',
    defaultPartnerName: 'MULCH SHIELD',
    defaultTagline: 'CARDBOARD MOISTURE LOCK',
    defaultAccentHex: '#fbbf24',
    defaultBgHex: '#271a06',
  },
  {
    slotId: 'compost_arch_panel',
    room: 'compost',
    targetKey: 'arch_panel',
    label: 'Panel Available — Compost North Arch',
    categoryLabel: 'Compost Hero Banner',
    description: 'Overhead arch banner centered behind the 3 recycling workstations.',
    suggestedBrandUse: 'Circular Economy / Compost Headline Sponsor',
    defaultPartnerName: 'COMPOST LOOP',
    defaultTagline: 'ZERO WASTE · NUTRIENT RETURN',
    defaultAccentHex: '#4ade80',
    defaultBgHex: '#064e3b',
  },
  {
    slotId: 'compost_west_panel',
    room: 'compost',
    targetKey: 'west_panel',
    label: 'Panel Available — West Fence Banner',
    categoryLabel: 'Fence Billboard',
    description: 'West fence hero plaque next to the 2L drip bottle station.',
    suggestedBrandUse: 'Water & Mulch Co-Sponsor',
    defaultPartnerName: 'DRIP & MULCH',
    defaultTagline: 'DROP-BY-DROP TO ROOTS',
    defaultAccentHex: '#22d3ee',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'compost_rail_1',
    room: 'compost',
    targetKey: 'rail_1',
    label: 'Panel Available — East Fence Slot 01',
    categoryLabel: 'Modular Fence Rail',
    description: 'East compost fence 2x2 modular slot 01.',
    suggestedBrandUse: 'Compost Co-Sponsor 01',
    defaultPartnerName: 'COMPOST 01',
    defaultTagline: 'RECYCLING RAIL',
    defaultAccentHex: '#34d399',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'compost_rail_2',
    room: 'compost',
    targetKey: 'rail_2',
    label: 'Panel Available — East Fence Slot 02',
    categoryLabel: 'Modular Fence Rail',
    description: 'East compost fence 2x2 modular slot 02.',
    suggestedBrandUse: 'Compost Co-Sponsor 02',
    defaultPartnerName: 'COMPOST 02',
    defaultTagline: 'RECYCLING RAIL',
    defaultAccentHex: '#fbbf24',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'compost_rail_3',
    room: 'compost',
    targetKey: 'rail_3',
    label: 'Panel Available — East Fence Slot 03',
    categoryLabel: 'Modular Fence Rail',
    description: 'East compost fence 2x2 modular slot 03.',
    suggestedBrandUse: 'Compost Co-Sponsor 03',
    defaultPartnerName: 'COMPOST 03',
    defaultTagline: 'RECYCLING RAIL',
    defaultAccentHex: '#38bdf8',
    defaultBgHex: '#0f172a',
  },
  {
    slotId: 'compost_rail_4',
    room: 'compost',
    targetKey: 'rail_4',
    label: 'Panel Available — East Fence Slot 04',
    categoryLabel: 'Modular Fence Rail',
    description: 'East compost fence 2x2 modular slot 04.',
    suggestedBrandUse: 'Compost Co-Sponsor 04',
    defaultPartnerName: 'COMPOST 04',
    defaultTagline: 'RECYCLING RAIL',
    defaultAccentHex: '#f472b6',
    defaultBgHex: '#0f172a',
  },

  // =========================================================================
  // PLATFORM UI (Store, Pet Sanctuary, Leaderboard)
  // =========================================================================
  {
    slotId: 'platform_store',
    room: 'platform',
    targetKey: 'grade_store',
    label: 'Grade Produce Store Header',
    categoryLabel: 'Parent & Sponsor Marketplace',
    description: 'Sponsor strip rendered across the live Grade Produce Store storefront.',
    suggestedBrandUse: 'Retailer / Grocer / Karri Wallet Partner',
    defaultPartnerName: 'PRODUCE MARKET',
    defaultTagline: 'SCHOOL HARVESTS TO SANCTUARY CARE',
    defaultAccentHex: '#10b981',
    defaultBgHex: '#064e3b',
  },
  {
    slotId: 'platform_sanctuary',
    room: 'platform',
    targetKey: 'pet_sanctuary',
    label: 'Indigenous Pet Sanctuary Banner',
    categoryLabel: 'Pet Food & Vet Sanctuary',
    description: 'Banner displayed inside the Digital Pet Sanctuary feeding view.',
    suggestedBrandUse: 'Pet Food Brand or Veterinary Partner',
    defaultPartnerName: 'SANCTUARY VET',
    defaultTagline: 'CARING FOR SA INDIGENOUS HERBIVORES',
    defaultAccentHex: '#f59e0b',
    defaultBgHex: '#1e293b',
  },
  {
    slotId: 'platform_leaderboard',
    room: 'platform',
    targetKey: 'leaderboard',
    label: 'National School Scoreboard',
    categoryLabel: 'Student & Parent Leaderboard',
    description: 'Official trophy & leaderboard sponsor banner shown to all schools.',
    suggestedBrandUse: 'National Education / Corporate ESG Title Sponsor',
    defaultPartnerName: 'SCOREBOARD PARTNER',
    defaultTagline: 'NATIONAL SCHOOL HARVEST LEAGUE',
    defaultAccentHex: '#38bdf8',
    defaultBgHex: '#0f172a',
  },
];

export const SPONSOR_CATALOG_BY_ID: Record<string, SponsorSlotCatalogItem> = Object.fromEntries(
  SPONSOR_SLOT_CATALOG.map((item) => [item.slotId, item])
);

function generateActionTokenId(adminKey: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `tok_${adminKey.slice(0, 12)}_${Date.now()}_${rand}`;
}

function timestampToMs(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val && typeof val === 'object' && 'toMillis' in val) {
    const fn = (val as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn.call(val);
  }
  return Date.now();
}

function normalizeHex(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.trim())) {
    return raw.trim();
  }
  return fallback;
}

/**
 * Resizes and compresses an uploaded image file to a clean PNG/WEBP data URL
 * safely below Firestore's 190,000-char field limit for high-DPI 3D canvas decals.
 */
export async function resizeSponsorLogoToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file (PNG, JPG, WEBP, or SVG logo).');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unable to read logo file.'));
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode uploaded logo image.'));
    el.src = rawDataUrl;
  });

  const maxW = 512;
  const maxH = 256;
  const scale = Math.min(maxW / Math.max(1, img.width), maxH / Math.max(1, img.height), 1);
  const w = Math.max(32, Math.round(img.width * scale));
  const h = Math.max(32, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas is unavailable for image compression.');
  }
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // Try PNG first to preserve transparent backgrounds; fall back to WEBP/JPEG if large
  const pngUrl = canvas.toDataURL('image/png');
  if (pngUrl.length <= 165000) return pngUrl;

  const webp85 = canvas.toDataURL('image/webp', 0.85);
  if (webp85.length <= 165000) return webp85;

  const webp65 = canvas.toDataURL('image/webp', 0.65);
  if (webp65.length <= 165000) return webp65;

  const jpg70 = canvas.toDataURL('image/jpeg', 0.72);
  if (jpg70.length <= 175000) return jpg70;

  throw new Error('Compressed logo still exceeds 175 KB. Please pick a simpler or smaller logo.');
}

export function subscribeToSponsorSlots(
  onData: (slots: Record<string, SponsorSlotAssignment>) => void
): Unsubscribe {
  const path = 'sponsor_slots';
  const q = query(collection(db, 'sponsor_slots'), limit(80));
  return onSnapshot(
    q,
    (snap) => {
      const result: Record<string, SponsorSlotAssignment> = {};
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        const slotId = String(d.slotId || docSnap.id);
        const catalog = SPONSOR_CATALOG_BY_ID[slotId];
        const rawRoom = d.room;
        const room: SponsorRoom =
          rawRoom === 'kitchen' || rawRoom === 'garden' || rawRoom === 'compost' || rawRoom === 'platform'
            ? rawRoom
            : catalog?.room ?? 'kitchen';
        const rawMode = d.displayMode;
        const displayMode: SponsorDisplayMode =
          rawMode === 'logo' || rawMode === 'both' || rawMode === 'text' ? rawMode : 'text';

        result[slotId] = {
          slotId,
          room,
          targetKey: String(d.targetKey || catalog?.targetKey || slotId).slice(0, 80),
          label: String(d.label || catalog?.label || slotId).slice(0, 80),
          displayMode,
          partnerName: String(d.partnerName ?? '').slice(0, 60),
          tagline: String(d.tagline ?? '').slice(0, 90),
          accentHex: normalizeHex(d.accentHex, catalog?.defaultAccentHex ?? '#38bdf8'),
          bgHex: normalizeHex(d.bgHex, catalog?.defaultBgHex ?? '#0f172a'),
          logoDataUrl: typeof d.logoDataUrl === 'string' ? d.logoDataUrl : '',
          active: Boolean(d.active),
          updatedByAdminName: String(d.updatedByAdminName || 'Admin').slice(0, 40),
          updatedAtMs: timestampToMs(d.updatedAt),
        };
      });
      onData(result);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function upsertSponsorSlotAsAdmin(params: {
  admin: AdminProfile;
  slotId: string;
  displayMode: SponsorDisplayMode;
  partnerName: string;
  tagline: string;
  accentHex: string;
  bgHex: string;
  logoDataUrl: string;
  active?: boolean;
}): Promise<void> {
  const catalog = SPONSOR_CATALOG_BY_ID[params.slotId];
  if (!catalog) {
    throw new Error(`Unknown sponsor slot: ${params.slotId}`);
  }

  const active = params.active !== false;
  const partnerName = params.partnerName.trim().slice(0, 60);
  const tagline = params.tagline.trim().slice(0, 90);
  const logoDataUrl = (params.logoDataUrl || '').trim();

  if (active && params.displayMode === 'text' && !partnerName) {
    throw new Error('Enter a Partner / Brand Name for wording display.');
  }
  if (active && params.displayMode === 'logo' && !logoDataUrl) {
    throw new Error('Upload a brand logo image or switch Display Mode to Wording.');
  }
  if (active && params.displayMode === 'both' && (!partnerName || !logoDataUrl)) {
    throw new Error('Logo + Wording mode requires both a Partner Name and a Logo Image.');
  }
  if (logoDataUrl.length > 185000) {
    throw new Error('Logo image exceeds 185 KB after compression. Please use a smaller image.');
  }

  const slotRef = doc(db, 'sponsor_slots', params.slotId);
  const tokenId = generateActionTokenId(params.admin.adminKey);
  const tokenRef = doc(db, 'admin_write_tokens', tokenId);

  let existingCreatedAt: unknown = null;
  try {
    const snap = await getDoc(slotRef);
    if (snap.exists()) {
      existingCreatedAt = snap.data().createdAt ?? null;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `sponsor_slots/${params.slotId}`);
  }

  const batch = writeBatch(db);
  batch.set(tokenRef, {
    tokenId,
    adminKey: params.admin.adminKey,
    createdAt: serverTimestamp(),
  });

  const payload = {
    slotId: params.slotId,
    room: catalog.room,
    targetKey: catalog.targetKey,
    label: catalog.label,
    displayMode: params.displayMode,
    partnerName,
    tagline,
    accentHex: normalizeHex(params.accentHex, catalog.defaultAccentHex),
    bgHex: normalizeHex(params.bgHex, catalog.defaultBgHex),
    logoDataUrl,
    active,
    actionTokenId: tokenId,
    updatedByAdminName: params.admin.adminName.trim().slice(0, 40) || 'Admin',
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (existingCreatedAt) {
    batch.update(slotRef, {
      room: payload.room,
      targetKey: payload.targetKey,
      label: payload.label,
      displayMode: payload.displayMode,
      partnerName: payload.partnerName,
      tagline: payload.tagline,
      accentHex: payload.accentHex,
      bgHex: payload.bgHex,
      logoDataUrl: payload.logoDataUrl,
      active: payload.active,
      actionTokenId: payload.actionTokenId,
      updatedByAdminName: payload.updatedByAdminName,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(slotRef, payload);
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sponsor_slots/${params.slotId}`);
  }
}

export async function clearSponsorSlotAsAdmin(
  admin: AdminProfile,
  slotId: string
): Promise<void> {
  const catalog = SPONSOR_CATALOG_BY_ID[slotId];
  if (!catalog) return;

  await upsertSponsorSlotAsAdmin({
    admin,
    slotId,
    displayMode: 'text',
    partnerName: '',
    tagline: '',
    accentHex: catalog.defaultAccentHex,
    bgHex: catalog.defaultBgHex,
    logoDataUrl: '',
    active: false,
  });
}
