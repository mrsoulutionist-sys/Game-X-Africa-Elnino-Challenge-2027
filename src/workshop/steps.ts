export type BuildStepId =
  | 'GET_SAW'
  | 'CUT_AND_ASSEMBLE_PVC'
  | 'GET_DRILL'
  | 'DRILL_PORTS'
  | 'GET_WICKS'
  | 'THREAD_WICKS_AND_PLANT'
  | 'FILL_AT_SINK'
  | 'POUR_AND_GROW'
  | 'COMPLETE';

export type ToolId = 'none' | 'hacksaw' | 'drill' | 'wicks' | 'pitcher_empty' | 'pitcher_full';

export type TargetZoneId = 'saw_station' | 'workbench' | 'drill_station' | 'wick_station' | 'sink';

export type GradeTier = '4-6' | '7-9' | '10-12';

export interface StepDefinition {
  id: BuildStepId;
  stepNumber: number;
  totalSteps: number;
  title: string;
  instruction: string;
  actionLabel: string;
  holdMode?: boolean;
  targetZone: TargetZoneId;
  scienceNote: string;
  gradeNotes: Record<GradeTier, string>;
}

export const BUILD_STEPS: Record<BuildStepId, StepDefinition> = {
  GET_SAW: {
    id: 'GET_SAW',
    stepNumber: 1,
    totalSteps: 8,
    title: 'Pick Up Hacksaw',
    instruction: 'Walk to the West quartz counter and pick up the Hacksaw.',
    actionLabel: 'Pick Up Hacksaw',
    targetZone: 'saw_station',
    scienceNote: 'Fine-toothed hacksaw blades cut rigid Schedule-40 PVC cleanly without cracking the pipe walls.',
    gradeNotes: {
      '4-6': 'A fine-toothed hacksaw slices PVC pipe cleanly so the pieces fit together without leaks.',
      '7-9': 'Fine-toothed blades distribute cutting force across small teeth, cutting rigid PVC without cracking.',
      '10-12': 'High-TPI hacksaw blades minimize kerf stress concentration in Schedule-40 PVC for tight interference joints.',
    },
  },
  CUT_AND_ASSEMBLE_PVC: {
    id: 'CUT_AND_ASSEMBLE_PVC',
    stepNumber: 2,
    totalSteps: 8,
    title: 'Aim & Saw PVC Manifold',
    instruction: 'At the island, aim the center reticle at each glowing cut mark and hold to saw & fit the elbows.',
    actionLabel: 'Hold to Saw Cut',
    holdMode: true,
    targetZone: 'workbench',
    scienceNote: '90° elbow fittings form a watertight horizontal reservoir channel with a side fill riser—zero glue fumes or pumps required.',
    gradeNotes: {
      '4-6': 'Cutting straight marks lets the 90° elbow snap tightly onto the pipe so water stays inside.',
      '7-9': 'Accurate perpendicular cuts seat cleanly into 90° elbow sockets to form a passive horizontal reservoir.',
      '10-12': 'Square kerf cuts maximize socket contact area in 90° elbow fittings, creating a zero-pump hydrostatic manifold.',
    },
  },
  GET_DRILL: {
    id: 'GET_DRILL',
    stepNumber: 3,
    totalSteps: 8,
    title: 'Equip Hole-Saw Drill',
    instruction: 'Walk to the North-East counter to grab the Cordless Drill with a Hole-Saw bit.',
    actionLabel: 'Equip Drill',
    targetZone: 'drill_station',
    scienceNote: 'A 50 mm hole-saw cuts uniform circular ports so net-cups seat flush above the reservoir water line.',
    gradeNotes: {
      '4-6': 'The round hole-saw bit cuts neat circles so each plant cup sits right on top of the pipe.',
      '7-9': 'A 50 mm hole-saw bores uniform ports along the pipe crown so net-cups stay suspended above water.',
      '10-12': 'A cylindrical hole-saw removes only the circular perimeter ring, leaving clean port collars for 50 mm net-cups.',
    },
  },
  DRILL_PORTS: {
    id: 'DRILL_PORTS',
    stepNumber: 4,
    totalSteps: 8,
    title: 'Aim & Drill 4 Planting Ports',
    instruction: 'Aim your reticle at each of the 4 top port marks on the PVC pipe and hold to bore every hole.',
    actionLabel: 'Hold to Drill Port',
    holdMode: true,
    targetZone: 'workbench',
    scienceNote: 'Spacing ports 28 cm apart gives leafy greens airflow and prevents root crowding.',
    gradeNotes: {
      '4-6': 'Spacing the 4 holes evenly gives every leafy green enough room and sunlight to grow.',
      '7-9': 'Centering each hole along the top ridge keeps structural stiffness while leaving 28 cm for leaf canopy airflow.',
      '10-12': 'Axial spacing (28 cm) balances pipe beam rigidity against photosynthetic canopy spacing and root zone separation.',
    },
  },
  GET_WICKS: {
    id: 'GET_WICKS',
    stepNumber: 5,
    totalSteps: 8,
    title: 'Collect Wicks, LECA & Seeds',
    instruction: 'Pick up the cotton Capillary Wicks, LECA substrate, and seed caddy from the East counter.',
    actionLabel: 'Take Wicks & Seeds',
    targetZone: 'wick_station',
    scienceNote: 'Porous expanded clay (LECA) holds air pockets around roots while braided cotton wicks draw water upward.',
    gradeNotes: {
      '4-6': 'Cotton wicks drink water upward like a paper towel, while clay pebbles give plant roots air to breathe.',
      '7-9': 'Porous LECA clay balls trap oxygen around roots while cotton fibers pull moisture up from the reservoir.',
      '10-12': 'Expanded clay (LECA) provides aerobic pore spaces while braided cellulose fibers create narrow capillary conduits.',
    },
  },
  THREAD_WICKS_AND_PLANT: {
    id: 'THREAD_WICKS_AND_PLANT',
    stepNumber: 6,
    totalSteps: 8,
    title: 'Thread Wicks & Pack Substrate',
    instruction: 'At the workbench, drop cotton wicks into the PVC channel, pack LECA/soil, and sow seeds.',
    actionLabel: 'Install Wicks & Seeds',
    targetZone: 'workbench',
    scienceNote: 'Adhesion and cohesion inside narrow cotton fibers pull water upward against gravity via capillary action.',
    gradeNotes: {
      '4-6': 'Dropping each cotton wick to the bottom of the pipe lets it reach water and carry it up to the seeds.',
      '7-9': 'Adhesion to cotton fibers and water cohesion work together to lift water upward against gravity.',
      '10-12': 'Capillary rise h = 2γ cosθ / (ρgr) draws reservoir water up through micro-capillaries to hydrate the root substrate.',
    },
  },
  FILL_AT_SINK: {
    id: 'FILL_AT_SINK',
    stepNumber: 7,
    totalSteps: 8,
    title: 'Fill Reservoir Pitcher at Sink',
    instruction: 'Walk to the kitchen sink basin and fill the water pitcher under the gooseneck faucet.',
    actionLabel: 'Turn On Tap & Fill',
    targetZone: 'sink',
    scienceNote: 'Fresh tap water fills the lower PVC reservoir, keeping roots moist without electricity or submerged pumps.',
    gradeNotes: {
      '4-6': 'One pitcher of water feeds all four plants passively—no electric pumps or plugs needed.',
      '7-9': 'Storing water inside the enclosed PVC channel cuts evaporation during hot El Niño dry spells.',
      '10-12': 'Enclosed reservoir storage minimizes evaporative loss, critical for off-grid food security during El Niño droughts.',
    },
  },
  POUR_AND_GROW: {
    id: 'POUR_AND_GROW',
    stepNumber: 8,
    totalSteps: 8,
    title: 'Pour Water & Stabilize Reservoir',
    instruction: 'Return to the workbench and pour water into the PVC fill riser to stabilize the reservoir.',
    actionLabel: 'Pour Water & Grow',
    targetZone: 'workbench',
    scienceNote: 'Gravity levels water across the PVC channel, then capillary wicking hydrates the substrate and grows greens.',
    gradeNotes: {
      '4-6': 'Gravity spreads the water evenly down the pipe, and the cotton wicks feed the sprouts automatically.',
      '7-9': 'Hydrostatic pressure equalizes the waterline across the manifold, priming all four wicks at once.',
      '10-12': 'Pascal equilibrium stabilizes the hydrostatic head across the horizontal channel, sustaining passive transpiration-driven uptake.',
    },
  },
  COMPLETE: {
    id: 'COMPLETE',
    stepNumber: 8,
    totalSteps: 8,
    title: 'Off-Grid Garden Thriving',
    instruction: 'Toggle Cutaway X-Ray to inspect water level stabilization and capillary wicking sustaining growth.',
    actionLabel: 'Toggle Cutaway X-Ray',
    targetZone: 'workbench',
    scienceNote: 'Capillary wicking delivers moisture only as fast as the plant transpires, preventing overwatering and waste.',
    gradeNotes: {
      '4-6': 'Your zero-electricity garden keeps itself watered! Toggle Cutaway to peek at the water and cotton wicks inside.',
      '7-9': 'Cutaway view shows the stabilized waterline and steady capillary wicking feeding all four greens without power.',
      '10-12': 'Self-regulating capillary flux matches plant transpiration demand—delivering resilient off-grid nutrition with 0 W draw.',
    },
  },
};
