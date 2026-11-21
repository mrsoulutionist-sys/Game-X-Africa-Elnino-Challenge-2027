import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/firebaseClient';

export const PET_ADOPTION_PRICE_ZAR = 50;

export type PetId =
  | 'thabo-tortoise'
  | 'zuri-rabbit'
  | 'kudu-grysbok'
  | 'biko-dassie';

export interface AdoptedPet {
  id: PetId;
  species: string;
  name: string;
  age: number;
  adoptedAt: string;
  happiness: number;
  hunger: number;
}

export interface PetBodyPartFact {
  partId: string;
  label: string;
  fact: string;
}

export interface PetCatalogItem {
  id: PetId;
  name: string;
  species: string;
  fullTitle: string;
  age: number;
  ageLabel: string;
  region: string;
  favoriteCrops: string;
  backstory: string;
  accentHex: string;
  badgeBgClass: string;
  greetingTemplates: (pseudonym: string) => string[];
  cuddleReactions: string[];
  natureTrivia: string[];
  bodyPartFacts: PetBodyPartFact[];
}

export const SA_HERBIVORE_CATALOG: PetCatalogItem[] = [
  {
    id: 'thabo-tortoise',
    name: 'Thabo',
    species: 'Leopard Tortoise',
    fullTitle: 'Thabo the Leopard Tortoise',
    age: 10,
    ageLabel: '10 years old',
    region: 'Karoo & Savanna Thornveld',
    favoriteCrops: 'Crunchy spinach, lettuce & succulent leaves',
    backstory:
      'Loves warm Karoo mornings, slow strolls past JoJo tanks, and crunchy leafy greens grown by careful student farmers.',
    accentHex: '#007749',
    badgeBgClass: 'bg-[#007749]',
    greetingTemplates: (pseudonym) => [
      `Sawubona, ${pseudonym}! I strolled right past the JoJo tank to say hello.`,
      `Warm Karoo greetings, ${pseudonym}! Those student spinach leaves look crisp today.`,
    ],
    cuddleReactions: [
      'Thabo tucks happily into the warm sunshine and bobs his spotted head!',
      'Shell-rub bliss! Thabo loves gentle pats between the yellow-and-black rosettes.',
    ],
    natureTrivia: [
      'Leopard tortoises (Stigmochelys pardalis) can store water in their bodies to survive dry El Niño seasons—just like a JoJo rainwater tank!',
      'Notice the high dome of my shell? Its golden-and-charcoal pattern hides me among dry Karoo scrub and sunlit grasses.',
    ],
    bodyPartFacts: [
      {
        partId: 'shell',
        label: 'Domed Rosette Shell',
        fact: 'My domed shell has keratin plates fused right to my spine! Its golden-and-black rosettes camouflage me in Karoo scrub and shield me from El Niño sun.',
      },
      {
        partId: 'head',
        label: 'Head & Beak',
        fact: 'I have sharp eyesight for bright garden leaves and a strong beak instead of teeth—perfect for snipping crunchy student spinach!',
      },
      {
        partId: 'legs',
        label: 'Scaly Tortoise Legs',
        fact: 'My sturdy, scaly legs carry me safely over dry thornveld rocks—and inside my body I even store rainwater reserves like a walking JoJo tank!',
      },
      {
        partId: 'snack',
        label: 'Garden Leaf Snack',
        fact: 'Fresh greens from vertical PVC wicking pipes give me nearly 80% of my daily hydration during dry months!',
      },
    ],
  },
  {
    id: 'zuri-rabbit',
    name: 'Zuri',
    species: 'Riverine Rabbit',
    fullTitle: 'Zuri the Riverine Rabbit',
    age: 3,
    ageLabel: '3 years old',
    region: 'Central Karoo Riverbanks',
    favoriteCrops: 'Fresh garden carrots, basil & crisp herbs',
    backstory:
      "One of South Africa's rarest little hoppers! Energetic, curious, and always wiggling her nose for fresh garden carrots and herbs.",
    accentHex: '#FFB81C',
    badgeBgClass: 'bg-[#FFB81C]',
    greetingTemplates: (pseudonym) => [
      `Molo, ${pseudonym}! *wiggle wiggle* Did someone bring crunchy garden herbs?`,
      `Hi ${pseudonym}! I just did a high veld hop across the clover patch!`,
    ],
    cuddleReactions: [
      'Zuri thumps her soft hind paw with pure joy and twitches her velvet ears!',
      'So cozy! Zuri leans right against your hand with tiny happy nose-wiggles.',
    ],
    natureTrivia: [
      'The Riverine Rabbit (Bunolagus monticularis) is critically endangered and found only along seasonal riverbeds in South Africa’s Karoo!',
      'Healthy riverside bushes hold moisture underground—just like buried 2L drip bottles and cardboard mulch keep garden roots cool.',
    ],
    bodyPartFacts: [
      {
        partId: 'ears',
        label: 'Long Velvet Ears',
        fact: 'My tall ears act like natural air conditioners—releasing extra heat into the Karoo breeze and listening closely for hawks!',
      },
      {
        partId: 'head',
        label: 'Eye-Ring & Twitchy Nose',
        fact: 'See the white ring around my eye? That is a signature Riverine Rabbit marking, and my nose twitches over 100 times a minute sniffing for herbs!',
      },
      {
        partId: 'paws',
        label: 'Fluffy Tail & Hind Paws',
        fact: 'My fluffy tail and springy hind paws help me dart between riverbank bushes that shade the soil from harsh drought.',
      },
      {
        partId: 'snack',
        label: 'Crunchy Garden Carrot',
        fact: 'Crunchy student-grown carrots and basil stems keep my ever-growing front teeth neatly trimmed and healthy!',
      },
    ],
  },
  {
    id: 'kudu-grysbok',
    name: 'Kudu',
    species: 'Cape Grysbok',
    fullTitle: 'Kudu the Cape Grysbok',
    age: 2,
    ageLabel: '2 years old',
    region: 'Western Cape Fynbos',
    favoriteCrops: 'Sweet clover shoots, kale & mulched greens',
    backstory:
      'A shy, gentle fynbos browser from the Western Cape who loves shaded compost gardens and sweet clover shoots.',
    accentHex: '#E03C31',
    badgeBgClass: 'bg-[#E03C31]',
    greetingTemplates: (pseudonym) => [
      `Dumela, ${pseudonym}! Thank you for keeping our fynbos sanctuary shady and cool.`,
      `Hello, ${pseudonym}! I spotted fresh clover sprouting near the compost bay!`,
    ],
    cuddleReactions: [
      'Kudu perks up his big expressive ears and gives a gentle nuzzle!',
      'Happy tail flick! Gentle head scratches make this shy fynbos antelope feel right at home.',
    ],
    natureTrivia: [
      'Cape Grysboks (Raphicerus melanotis) are tiny nocturnal browsers of the Cape Floristic Region—a biodiversity hotspot found nowhere else on Earth!',
      'We get most of our moisture from tender shaded leaves, which is why shade cloth over school racks helps cut water loss by 35%.',
    ],
    bodyPartFacts: [
      {
        partId: 'coat',
        label: 'Grizzled Fynbos Coat',
        fact: '"Grysbok" means "grey buck" in Afrikaans because of these tiny white hairs sprinkled through my chestnut coat for fynbos camouflage!',
      },
      {
        partId: 'ears',
        label: 'Horns & Swivel Ears',
        fact: 'My large ears swivel like radar dishes at dusk, and tiny 8cm straight horns let me slip smoothly through dense Cape bushes.',
      },
      {
        partId: 'legs',
        label: 'Delicate Hooves',
        fact: 'My light cloven hooves step gently across mulched garden beds without crushing roots or soil compost layers!',
      },
      {
        partId: 'snack',
        label: 'Sweet Clover Shoot',
        fact: 'Shaded clover and tender kale hold cool dew inside their leaves—meaning I rarely need to visit open puddles during dry spells!',
      },
    ],
  },
  {
    id: 'biko-dassie',
    name: 'Biko',
    species: 'Rock Hyrax (Dassie)',
    fullTitle: 'Biko the Rock Hyrax (Dassie)',
    age: 4,
    ageLabel: '4 years old',
    region: 'Table Mountain & Drakensberg Rocks',
    favoriteCrops: 'Crisp parsley, Swiss chard & young shoots',
    backstory:
      'Sunbathing champion of Table Mountain rocks; friendly, vocal, and happiest when munching on crisp garden leaves.',
    accentHex: '#001489',
    badgeBgClass: 'bg-[#001489]',
    greetingTemplates: (pseudonym) => [
      `Heita, ${pseudonym}! The morning sun on Table Mountain granite is 10/10 today!`,
      `Howzit, ${pseudonym}! Ready to trade sunshine high-fives for crispy garden leaves?`,
    ],
    cuddleReactions: [
      'Biko lets out a cheerful chirp and stretches out on his warm basking stone!',
      'Maximum coziness! Biko loves ear scritches after a morning soak in the sun.',
    ],
    natureTrivia: [
      'Fun fact: Rock Hyraxes (Dassies) have rubbery, sweat-moistened footpads for gripping steep cliffs—and our closest living land relative is the elephant!',
      'Sunbathing warms us up without using extra energy, leaving more plant energy for exploring rocky koppie trails.',
    ],
    bodyPartFacts: [
      {
        partId: 'body',
        label: 'Elephant Cousin Coat',
        fact: 'Surprise! Although I look small and furry, my closest living land relative is the African elephant—we share similar skull, toe, and tooth traits!',
      },
      {
        partId: 'head',
        label: 'Whiskers & Tiny Tusks',
        fact: 'Inside my cheek smile are two tiny tusk-like front teeth that keep growing, plus sensitive whiskers for navigating cool rock caves!',
      },
      {
        partId: 'rock',
        label: 'Gripping Paws & Sun Rock',
        fact: 'My bare footpads stay moist so they grip steep Table Mountain cliffs like suction cups—and basking on warm granite saves my food energy!',
      },
      {
        partId: 'snack',
        label: 'Crisp Garden Parsley',
        fact: 'My specialized multi-chambered stomach digests tough mountain fynbos and crisp Swiss chard leaves from school gardens with ease!',
      },
    ],
  },
];

const VALID_PET_IDS: Set<PetId> = new Set([
  'thabo-tortoise',
  'zuri-rabbit',
  'kudu-grysbok',
  'biko-dassie',
]);

export function getCatalogPetById(id: PetId): PetCatalogItem {
  return SA_HERBIVORE_CATALOG.find((item) => item.id === id) ?? SA_HERBIVORE_CATALOG[0];
}

export function createAdoptedPetRecord(item: PetCatalogItem): AdoptedPet {
  return {
    id: item.id,
    species: item.species,
    name: item.name,
    age: item.age,
    adoptedAt: new Date().toISOString(),
    happiness: 100,
    hunger: 80,
  };
}

export function sanitizeAdoptedPets(raw: unknown): AdoptedPet[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<PetId>();
  const result: AdoptedPet[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = obj.id as PetId;
    if (!VALID_PET_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    const catalog = getCatalogPetById(id);
    result.push({
      id,
      species:
        typeof obj.species === 'string' && obj.species.trim()
          ? obj.species.trim().slice(0, 40)
          : catalog.species,
      name:
        typeof obj.name === 'string' && obj.name.trim()
          ? obj.name.trim().slice(0, 30)
          : catalog.name,
      age:
        typeof obj.age === 'number' && Number.isFinite(obj.age)
          ? Math.max(1, Math.min(50, Math.round(obj.age)))
          : catalog.age,
      adoptedAt:
        typeof obj.adoptedAt === 'string' && obj.adoptedAt.length >= 10 && obj.adoptedAt.length <= 40
          ? obj.adoptedAt
          : new Date().toISOString(),
      happiness:
        typeof obj.happiness === 'number' && Number.isFinite(obj.happiness)
          ? Math.max(0, Math.min(100, Math.round(obj.happiness)))
          : 100,
      hunger:
        typeof obj.hunger === 'number' && Number.isFinite(obj.hunger)
          ? Math.max(0, Math.min(100, Math.round(obj.hunger)))
          : 80,
    });
    if (result.length >= 4) break;
  }
  return result;
}

export async function loadParentAdoptedPets(parentKey: string): Promise<AdoptedPet[]> {
  const path = `parents/${parentKey}`;
  const ref = doc(db, 'parents', parentKey);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const data = snap.data() as Record<string, unknown>;
    return sanitizeAdoptedPets(data.adoptedPets);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveParentAdoptedPets(
  parentKey: string,
  adoptedPets: AdoptedPet[]
): Promise<AdoptedPet[]> {
  const cleanPets = sanitizeAdoptedPets(adoptedPets);
  const path = `parents/${parentKey}`;
  const ref = doc(db, 'parents', parentKey);
  try {
    await setDoc(
      ref,
      {
        adoptedPets: cleanPets,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return cleanPets;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}
