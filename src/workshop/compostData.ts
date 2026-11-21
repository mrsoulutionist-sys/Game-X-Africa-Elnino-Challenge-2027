import type { GradeTier } from './steps';

export type DripBottleType = 'clear_soda' | 'green_sparkling' | 'clear_water';
export type CompostContainerType = 'bucket' | 'crate' | 'pallet';
export type MulchMaterialType = 'cardboard' | 'newspaper';

export interface Door3ProgressState {
  dripBottleType: DripBottleType | null;
  dripStep: number; // 0 = start, 1 = bottle selected, 2 = holes poked, 3 = buried, 4 = filled & capped
  compostContainer: CompostContainerType | null;
  compostStep: number; // 0 = start, 1 = container, 2 = gathered, 3 = twigs, 4 = greens, 5 = browns, 6 = misted
  compostRejectTested: number; // 0..4 avoid items verified
  mulchMaterial: MulchMaterialType | null;
  mulchStep: number; // 0 = start, 1 = material selected, 2 = slit collar cut, 3 = placed flat, 4 = leaves cover
}

export const DEFAULT_DOOR3_PROGRESS: Door3ProgressState = {
  dripBottleType: null,
  dripStep: 0,
  compostContainer: null,
  compostStep: 0,
  compostRejectTested: 0,
  mulchMaterial: null,
  mulchStep: 0,
};

export interface DripBottleOption {
  id: DripBottleType;
  label: string;
  materialCode: string;
  tintHex: string;
  badgeText: string;
  note: string;
}

export const DRIP_BOTTLE_OPTIONS: DripBottleOption[] = [
  {
    id: 'clear_soda',
    label: '2L Clear Cold-Drink Bottle',
    materialCode: 'PET #1 · Thick Wall',
    tintHex: '#38bdf8',
    badgeText: 'Sturdy Ribs',
    note: 'Firm ribbed base resists soil pressure when buried beside deeper root zones.',
  },
  {
    id: 'green_sparkling',
    label: '2L Green Sparkling Bottle',
    materialCode: 'PET #1 · UV Tinted',
    tintHex: '#34d399',
    badgeText: 'Algae Shield',
    note: 'Green tint filters harsh El Niño sunlight above ground to keep stored water cooler.',
  },
  {
    id: 'clear_water',
    label: '2L Spring Water Bottle',
    materialCode: 'PET #1 · Smooth Wall',
    tintHex: '#60a5fa',
    badgeText: 'Easy Pierce',
    note: 'Thinner walls make it quick and safe for students to poke steady pinholes.',
  },
];

export interface CompostContainerOption {
  id: CompostContainerType;
  label: string;
  dimensions: string;
  spaceFit: string;
  airflowNote: string;
}

export const COMPOST_CONTAINER_OPTIONS: CompostContainerOption[] = [
  {
    id: 'bucket',
    label: '20L Recycled Bucket',
    dimensions: '30 cm × 38 cm · Tight Lid',
    spaceFit: 'Best for balconies, patios & small stoep corners',
    airflowNote: 'Drill 8 mm side & base drainage holes so worms & microbes stay aerobic.',
  },
  {
    id: 'crate',
    label: 'Slatted Plastic Crate',
    dimensions: '48 cm × 34 cm × 30 cm · Open Sides',
    spaceFit: 'Ideal for courtyards & school garden beds',
    airflowNote: 'Natural slatted walls breathe continuously; line sides with plain cardboard.',
  },
  {
    id: 'pallet',
    label: 'Wooden Pallet Box',
    dimensions: '100 cm × 100 cm × 85 cm · Modular Bay',
    spaceFit: 'Family & community food-garden scale',
    airflowNote: 'Wide timber gaps generate warm active compost up to 3× faster.',
  },
];

export type IngredientCategory = 'green' | 'brown' | 'avoid';

export interface CompostIngredientItem {
  id: string;
  label: string;
  sourceLabel: string;
  category: IngredientCategory;
  reason: string;
}

export const COMPOST_INGREDIENTS: CompostIngredientItem[] = [
  {
    id: 'veggie_peels',
    label: 'Veggie Peels',
    sourceLabel: 'Door 1 · Kitchen',
    category: 'green',
    reason: 'Nitrogen-rich kitchen offcuts feed beneficial compost microbes fast.',
  },
  {
    id: 'fruit_scraps',
    label: 'Fruit Scraps',
    sourceLabel: 'Door 1 · Kitchen',
    category: 'green',
    reason: 'Natural sugars & moisture jumpstart healthy compost heat without waste.',
  },
  {
    id: 'rooibos_teabags',
    label: 'Used Rooibos Tea Bags',
    sourceLabel: 'Door 1 · Kitchen',
    category: 'green',
    reason: 'South African staple! Spent rooibos leaves hold moisture and trace minerals.',
  },
  {
    id: 'dry_leaves_twigs',
    label: 'Dry Leaves & Twigs',
    sourceLabel: 'Door 2 · Garden Yard',
    category: 'brown',
    reason: 'Carbon-rich twigs trap air pockets so the pile never smells sour.',
  },
  {
    id: 'shredded_cardboard',
    label: 'Shredded Plain Cardboard',
    sourceLabel: 'Door 3 · Recycling',
    category: 'brown',
    reason: 'Dry corrugated paper absorbs excess juice from kitchen Greens (2:1 balance).',
  },
  {
    id: 'egg_cartons',
    label: 'Torn Pulp Egg Cartons',
    sourceLabel: 'Door 3 · Recycling',
    category: 'brown',
    reason: 'Soft molded paper fibers break down quickly and keep worms cozy.',
  },
];

export const COMPOST_SORT_CHECK_ITEMS: CompostIngredientItem[] = [
  {
    id: 'check_peels',
    label: 'Spinach & Carrot Peels',
    sourceLabel: 'Kitchen Greens',
    category: 'green',
    reason: 'YES — Fast Nitrogen fuel! Balance with 2 parts Browns.',
  },
  {
    id: 'check_rooibos',
    label: 'Spent Rooibos Leaves',
    sourceLabel: 'Kitchen Greens',
    category: 'green',
    reason: 'YES — Safe Nitrogen + trace potassium for strong roots.',
  },
  {
    id: 'check_cardboard',
    label: 'Torn Egg Cartons & Leaves',
    sourceLabel: 'Yard & Recycling Browns',
    category: 'brown',
    reason: 'YES — Essential Carbon + airflow pockets.',
  },
  {
    id: 'avoid_meat',
    label: 'Cooked Meat & Bones',
    sourceLabel: 'Kitchen Trap',
    category: 'avoid',
    reason: 'AVOID — Rots slowly, causes foul odors, and attracts rats or flies.',
  },
  {
    id: 'avoid_dairy',
    label: 'Cheese, Milk & Cooking Oil',
    sourceLabel: 'Kitchen Trap',
    category: 'avoid',
    reason: 'AVOID — Coats soil particles, blocks oxygen, and turns compost rancid.',
  },
  {
    id: 'avoid_plastic',
    label: 'Plastic Wrappers & Foil',
    sourceLabel: 'Recycling Trap',
    category: 'avoid',
    reason: 'AVOID — Never decomposes and contaminates food beds with microplastics.',
  },
  {
    id: 'avoid_glossy',
    label: 'Glossy Waxed Magazine Paper',
    sourceLabel: 'Recycling Trap',
    category: 'avoid',
    reason: 'AVOID — Plastic laminate & heavy dyes stay in garden soil.',
  },
];

export interface MulchOption {
  id: MulchMaterialType;
  label: string;
  prepNote: string;
  shieldBenefit: string;
}

export const MULCH_OPTIONS: MulchOption[] = [
  {
    id: 'cardboard',
    label: 'Flattened Corrugated Cardboard',
    prepNote: 'Remove any packing tape before cutting a plant collar.',
    shieldBenefit: 'Thick double-fluted shield blocks weeds and cools root zones up to 6°C.',
  },
  {
    id: 'newspaper',
    label: 'Layered Newspaper (4–6 Sheets)',
    prepNote: 'Black-and-white soy-ink pages wet easily and hug stem curves tightly.',
    shieldBenefit: 'Breathes naturally while stopping hot El Niño winds from drying topsoil.',
  },
];

export const DOOR3_GRADE_TIPS: Record<GradeTier, { station1: string; station2: string; station3: string }> = {
  '4-6': {
    station1: 'Underground drops go straight to thirsty roots so the hot sun cannot steal the water!',
    station2: 'Mix wet kitchen scraps (Greens) with twice as many dry leaves & cardboard (Browns)—never meat or plastic.',
    station3: 'A cardboard collar covered in dry leaves acts like a cool sunhat for your plant’s soil.',
  },
  '7-9': {
    station1: 'Burying a perforated 2L PET bottle eliminates up to 70% surface evaporation during El Niño heat.',
    station2: 'Aerobic microbes thrive on a 2:1 Carbon-to-Nitrogen ratio (2 Browns : 1 Green) with twigs at the bottom for airflow.',
    station3: 'Sheet mulching shields bare soil from UV radiation, slows capillary crusting, and keeps the drip zone moist.',
  },
  '10-12': {
    station1: 'Subsurface micro-drip reduces latent heat flux at the soil-air boundary, delivering water directly to the rhizosphere.',
    station2: 'Maintaining C:N ≈ 25–30:1 (2 parts Browns : 1 part Greens) at 50% moisture maximizes thermophilic decomposition without anaerobic methane.',
    station3: 'Combining cardboard albedo + leaf litter mulch suppresses soil thermal spikes, preserving mycorrhizal moisture around the drip plume.',
  },
};

export function countDoor3CompletedWorkstations(p: Door3ProgressState): number {
  let count = 0;
  if (p.dripStep >= 4) count++;
  if (p.compostStep >= 6) count++;
  if (p.mulchStep >= 4) count++;
  return count;
}
