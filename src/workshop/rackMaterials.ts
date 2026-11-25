import type { TierSaveState } from './crops';

export type RackMaterialCategory = 'recyclable' | 'standard';

export type RackMaterialId =
  | 'reclaimed_pvc'
  | 'pallet_wood'
  | 'scrap_metal'
  | 'upcycled_hdpe'
  | 'standard_pvc'
  | 'standard_timber';

export interface RackMaterialDef {
  id: RackMaterialId;
  name: string;
  shortName: string;
  category: RackMaterialCategory;
  ecoPoints: number;
  badgeLabel: string;
  sustainabilityTip: string;
  costSavingTip: string;
  durabilityTip: string;
  swatchHex: string;
  accentHex: string;
  edgeHex: string;
}

export interface BuiltRackRecord {
  rackIndex: number;
  materialId: RackMaterialId;
  isRecyclable: boolean;
  builderName: string;
  builtAtMs: number;
  quickBuilt: boolean;
}

export const RACK_MATERIAL_CATALOG: RackMaterialDef[] = [
  {
    id: 'reclaimed_pvc',
    name: 'Reclaimed PVC Offcuts',
    shortName: 'Reclaimed PVC',
    category: 'recyclable',
    ecoPoints: 25,
    badgeLabel: '+25 Eco-Builder Pts',
    sustainabilityTip:
      'Diverts plumbers’ site offcuts from landfills and avoids ~75% of virgin plastic resin emissions.',
    costSavingTip:
      'Sourced free or at scrap-bin prices from plumbing yards—saves R140–R220 per garden rack.',
    durabilityTip:
      'Waterproof, rot-proof, and UV-stable for 8+ outdoor seasons once bolted with cross slats.',
    swatchHex: '#cbd5e1',
    accentHex: '#34d399',
    edgeHex: '#64748b',
  },
  {
    id: 'pallet_wood',
    name: 'Heat-Treated Pallet Wood',
    shortName: 'Pallet Wood',
    category: 'recyclable',
    ecoPoints: 25,
    badgeLabel: '+25 Eco-Builder Pts',
    sustainabilityTip:
      'Upcycles HT-stamped shipping pallets (always avoid MB chemical-treated pallets) into rigid garden frames.',
    costSavingTip:
      'Zero timber cost from school supply deliveries—only deck screws and a moisture liner are needed.',
    durabilityTip:
      'High grain strength for heavy water troughs when sealed from ground damp with a fitted liner.',
    swatchHex: '#b47a44',
    accentHex: '#fbbf24',
    edgeHex: '#784820',
  },
  {
    id: 'scrap_metal',
    name: 'Scrap Metal Angle & Conduit',
    shortName: 'Scrap Metal',
    category: 'recyclable',
    ecoPoints: 25,
    badgeLabel: '+25 Eco-Builder Pts',
    sustainabilityTip:
      'Repurposes salvaged bed-frame angle iron and steel conduit, cutting high-energy ore smelting.',
    costSavingTip:
      'Scrap-yard metal offcuts cost 60–70% less than retail galvanized steel shelving kits.',
    durabilityTip:
      'Maximum wind and storm rigidity—never warps or bows under full 110 mm hydroponic pipes.',
    swatchHex: '#7b8794',
    accentHex: '#38bdf8',
    edgeHex: '#475569',
  },
  {
    id: 'upcycled_hdpe',
    name: 'Upcycled HDPE Plastic',
    shortName: 'Upcycled HDPE',
    category: 'recyclable',
    ecoPoints: 25,
    badgeLabel: '+25 Eco-Builder Pts',
    sustainabilityTip:
      'Transforms shredded #2 milk jugs and bottle caps from school recycling drives into eco-lumber.',
    costSavingTip:
      'Eliminates repainting and replacement costs—collect raw feedstock right on campus.',
    durabilityTip:
      'Zero splinters, zero rot, and 100% immune to termites and constant compost-mist moisture.',
    swatchHex: '#0f766e',
    accentHex: '#2dd4bf',
    edgeHex: '#115e59',
  },
  {
    id: 'standard_pvc',
    name: 'Standard Virgin PVC',
    shortName: 'Standard PVC',
    category: 'standard',
    ecoPoints: 0,
    badgeLabel: 'Standard Build',
    sustainabilityTip:
      'Made from newly extruded petroleum resin—plan to reuse the frame across multiple school years.',
    costSavingTip:
      'Retail plumbing-aisle pricing runs R180–R260 higher per rack than salvaged offcuts.',
    durabilityTip:
      'Uniform wall thickness, clean socket tolerances, and reliable 10-year outdoor service life.',
    swatchHex: '#f1f5f9',
    accentHex: '#94a3b8',
    edgeHex: '#cbd5e1',
  },
  {
    id: 'standard_timber',
    name: 'Standard New Pine Timber',
    shortName: 'New Timber',
    category: 'standard',
    ecoPoints: 0,
    badgeLabel: 'Standard Build',
    sustainabilityTip:
      'Uses freshly milled plantation lumber—look for FSC-certified timber when reclaimed wood is unavailable.',
    costSavingTip:
      'Highest upfront hardware spend per linear metre compared to pallet or scrap-yard framing.',
    durabilityTip:
      'Straight, knot-free structural cuts with clean screw bite and solid tier weight capacity.',
    swatchHex: '#d9a45b',
    accentHex: '#f59e0b',
    edgeHex: '#9a6829',
  },
];

export const VALID_RACK_MATERIAL_IDS: Set<RackMaterialId> = new Set(
  RACK_MATERIAL_CATALOG.map((m) => m.id)
);

export function getRackMaterialById(id: RackMaterialId | string | null | undefined): RackMaterialDef {
  const found = RACK_MATERIAL_CATALOG.find((m) => m.id === id);
  return found ?? RACK_MATERIAL_CATALOG[0];
}

export function isValidRackMaterialId(value: unknown): value is RackMaterialId {
  return typeof value === 'string' && VALID_RACK_MATERIAL_IDS.has(value as RackMaterialId);
}

export function sanitizeBuiltRacks(
  rawBuiltRacks: unknown,
  tiers: TierSaveState[],
  rackSize: number,
  fallbackBuilderName: string
): BuiltRackRecord[] {
  const clampedSize = Math.max(1, Math.min(6, Math.round(rackSize || 2)));
  const cleanFallbackBuilder = fallbackBuilderName.trim().slice(0, 40) || 'Farmer';
  const byIndex = new Map<number, BuiltRackRecord>();

  if (Array.isArray(rawBuiltRacks)) {
    for (const entry of rawBuiltRacks) {
      if (!entry || typeof entry !== 'object') continue;
      const src = entry as Partial<BuiltRackRecord>;
      const idx =
        typeof src.rackIndex === 'number' && Number.isFinite(src.rackIndex)
          ? Math.round(src.rackIndex)
          : -1;
      if (idx < 0 || idx >= clampedSize) continue;
      const matDef = getRackMaterialById(
        isValidRackMaterialId(src.materialId) ? src.materialId : 'reclaimed_pvc'
      );
      const builder =
        typeof src.builderName === 'string' && src.builderName.trim().length > 0
          ? src.builderName.trim().slice(0, 40)
          : cleanFallbackBuilder;
      const builtAtMs =
        typeof src.builtAtMs === 'number' && Number.isFinite(src.builtAtMs) && src.builtAtMs >= 0
          ? Math.round(src.builtAtMs)
          : Date.now();
      byIndex.set(idx, {
        rackIndex: idx,
        materialId: matDef.id,
        isRecyclable: matDef.category === 'recyclable',
        builderName: builder,
        builtAtMs,
        quickBuilt: Boolean(src.quickBuilt),
      });
    }
  } else {
    // Backward compatibility for returning farmers saved before the 5-step Rack Builder existed:
    // any tier that already holds an installed pipe or active crop stays active & unlocked.
    for (let i = 0; i < clampedSize; i++) {
      const tier = tiers[i];
      if (tier && (tier.pipeInstalled || tier.cropId !== null)) {
        byIndex.set(i, {
          rackIndex: i,
          materialId: 'standard_pvc',
          isRecyclable: false,
          builderName: cleanFallbackBuilder,
          builtAtMs: tier.plantedAtMs ?? tier.wateredAtMs ?? Date.now(),
          quickBuilt: false,
        });
      }
    }
  }

  return Array.from(byIndex.values()).sort((a, b) => a.rackIndex - b.rackIndex);
}

export function resizeBuiltRacks(existing: BuiltRackRecord[], nextSize: number): BuiltRackRecord[] {
  const clamped = Math.max(1, Math.min(6, Math.round(nextSize)));
  return existing
    .filter((r) => r.rackIndex >= 0 && r.rackIndex < clamped)
    .map((r) => ({ ...r }))
    .sort((a, b) => a.rackIndex - b.rackIndex);
}

export function calculateEcoBuilderPoints(
  builtRacks: BuiltRackRecord[],
  storedPoints?: unknown
): number {
  const derived = builtRacks.reduce(
    (sum, r) => sum + (r.isRecyclable ? getRackMaterialById(r.materialId).ecoPoints : 0),
    0
  );
  if (typeof storedPoints === 'number' && Number.isFinite(storedPoints) && storedPoints >= 0) {
    return Math.min(100000, Math.max(derived, Math.round(storedPoints)));
  }
  return derived;
}
