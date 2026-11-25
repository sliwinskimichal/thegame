/**
 * The 24 building types, each with three upgrade levels, plus small
 * infrastructure pieces (ladders, lamps, props, doors...).
 * Every level's cost only uses resources obtainable by the time the tech
 * tree unlocks it (enforced by tests/content.test.ts).
 */
import type { Building, BuildingLevel, Infrastructure, Stack } from './types';

const s = (id: string, n: number): Stack => ({ id, n });
const L = (
  namePl: string, nameEn: string, cost: Stack[], work: number, size: [number, number], workers: number,
  effects: Record<string, number>, power?: number,
): BuildingLevel => ({ namePl, nameEn, cost, work, size, workers, effects, power });

export const BUILDINGS: readonly Building[] = [
  {
    id: 'hearth', category: 'core',
    descPl: 'Serce grodu. Wyznacza limit mieszkańców, ogrzewa i podnosi morale. Jego poziom otwiera kolejne epoki.',
    levels: [
      L('Ognisko obozowe', 'Campfire', [s('stone', 10), s('wood', 10)], 20, [3, 2], 0, { popCap: 10, morale: 2, radius: 6 }),
      L('Kamienne Palenisko', 'Stone Hearth', [s('stone_block', 30), s('brick', 20), s('copper_bar', 10), s('bronze_bar', 4)], 80, [4, 3], 0, { popCap: 24, morale: 4, radius: 9, storage: 20 }),
      L('Wielkie Palenisko', 'Great Hearth', [s('stone_block', 60), s('gold_bar', 10), s('cobalt_steel', 6), s('cut_sapphire', 4)], 220, [5, 4], 0, { popCap: 50, morale: 8, radius: 12, storage: 60 }),
    ],
  },
  {
    id: 'storehouse', category: 'logistics',
    descPl: 'Magazyn na surowce i wyroby. Wyższe poziomy mieszczą więcej i same sortują towary.',
    levels: [
      L('Skład skrzyń', 'Crate store', [s('plank', 12)], 12, [3, 2], 0, { capacity: 80 }),
      L('Kamienny skład', 'Stone store', [s('stone_block', 24), s('bronze_bar', 4), s('plank', 10)], 40, [4, 2], 0, { capacity: 240 }),
      L('Skarbiec', 'Vault', [s('stone_block', 40), s('nickel_steel', 8), s('gear', 10)], 90, [4, 3], 0, { capacity: 700, autosort: 1 }),
    ],
  },
  {
    id: 'quarters', category: 'living',
    descPl: 'Miejsca do spania. Lepsze kwatery = szybsza regeneracja i lepszy nastrój.',
    levels: [
      L('Legowiska', 'Bedrolls', [s('wood', 8), s('fiber', 10)], 10, [3, 1], 0, { beds: 4, rest: 1 }),
      L('Izby', 'Bedchambers', [s('plank', 20), s('cloth', 8), s('nails', 30)], 36, [4, 2], 0, { beds: 6, rest: 1.25, mood: 1 }),
      L('Komnaty', 'Halls of rest', [s('stone_block', 30), s('silk_cloth', 10), s('brass_bar', 6)], 80, [5, 2], 0, { beds: 8, rest: 1.5, mood: 3 }),
    ],
  },
  {
    id: 'kitchen', category: 'food',
    descPl: 'Zamienia surowe jedzenie w posiłki: syci bardziej, psuje się wolniej, poprawia nastrój.',
    levels: [
      L('Palenisko kuchenne', 'Cooking fire', [s('stone', 12), s('clay', 8)], 14, [2, 2], 1, { speed: 1 }),
      L('Kuchnia', 'Kitchen', [s('brick', 20), s('copper_bar', 8)], 40, [3, 2], 1, { speed: 1.5 }),
      L('Wielka kuchnia', 'Grand kitchen', [s('brick', 30), s('nickel_steel', 6), s('glass', 6)], 90, [4, 2], 2, { speed: 2.2 }),
    ],
  },
  {
    id: 'brewery', category: 'food',
    descPl: 'Piwo to dla krasnoluda nie przyjemność, tylko paliwo. Bez niego nastrój leci w dół.',
    levels: [
      L('Kadź', 'Mash tun', [s('plank', 15), s('copper_bar', 4)], 20, [2, 2], 1, { speed: 1 }),
      L('Browar', 'Brewery', [s('plank', 20), s('copper_bar', 12), s('pipe', 4)], 50, [3, 2], 1, { speed: 1.6 }),
      L('Browar mistrzowski', 'Master brewery', [s('brass_bar', 10), s('silver_bar', 4), s('glass', 10)], 100, [4, 3], 2, { speed: 2.4 }),
    ],
  },
  {
    id: 'farm', category: 'food',
    descPl: 'Na powierzchni jęczmień, pod ziemią grzyby, a w końcu świetlne ogrody gdziekolwiek.',
    levels: [
      L('Poletko', 'Field', [s('wood', 6), s('fiber', 6)], 10, [4, 1], 1, { plots: 4, surfaceOnly: 1 }),
      L('Grzybnia', 'Mushroom beds', [s('fungal_board', 12), s('fertilizer', 10), s('pipe', 4)], 50, [4, 1], 1, { plots: 6 }),
      L('Ogród świetlny', 'Light garden', [s('lens', 6), s('pipe', 12), s('tempered_glass', 6)], 110, [5, 2], 2, { plots: 10, yield: 2 }),
    ],
  },
  {
    id: 'carpentry', category: 'production',
    descPl: 'Drewno w deski i belki, a z nich drabiny, pomosty i meble.',
    levels: [
      L('Kozioł stolarski', 'Sawhorse', [s('wood', 10), s('stone', 6)], 10, [2, 1], 1, { speed: 1 }),
      L('Stolarnia', 'Carpentry', [s('plank', 20), s('bronze_bar', 6), s('nails', 20)], 40, [3, 2], 1, { speed: 1.6 }),
      L('Tartak parowy', 'Steam sawmill', [s('steel_bar', 10), s('gear', 8), s('piston', 2)], 90, [4, 2], 1, { speed: 3 }, 4),
    ],
  },
  {
    id: 'masonry', category: 'production',
    descPl: 'Kamień w bloki, mury i posągi. Bez niej gród zostanie obozowiskiem.',
    levels: [
      L('Ława kamieniarska', 'Stone bench', [s('stone', 15), s('wood', 5)], 12, [2, 1], 1, { speed: 1 }),
      L('Kamieniarnia', 'Masonry', [s('stone_block', 20), s('bronze_bar', 8)], 40, [3, 2], 1, { speed: 1.6 }),
      L('Szlifiernia mistrzowska', 'Master stoneworks', [s('cobalt_steel', 6), s('stone_block', 30), s('gear', 6)], 100, [4, 2], 2, { speed: 2.6 }, 3),
    ],
  },
  {
    id: 'kiln', category: 'production',
    descPl: 'Wypala węgiel drzewny, cegły i smołę, potem wapno, koks i szkło, w końcu szkło hartowane.',
    levels: [
      L('Piec glinany', 'Clay kiln', [s('clay', 15), s('stone', 10)], 16, [2, 2], 1, { speed: 1 }),
      L('Wapiennik', 'Lime kiln', [s('brick', 30), s('bronze_bar', 4)], 50, [3, 2], 1, { speed: 1.5 }),
      L('Huta szkła', 'Glassworks', [s('brick', 40), s('nickel_steel', 8), s('quartz', 10)], 110, [4, 3], 2, { speed: 2.2 }, 3),
    ],
  },
  {
    id: 'smelter', category: 'production',
    descPl: 'Wytapia rudy w sztabki. Dymarka zna tylko miedź i cynę; magmowa kuźnia topi nawet adamant.',
    levels: [
      L('Dymarka', 'Bloomery', [s('clay', 20), s('stone', 15)], 20, [2, 2], 1, { speed: 1 }),
      L('Wielki piec', 'Blast furnace', [s('brick', 40), s('bronze_bar', 12), s('stone_block', 20)], 80, [3, 3], 2, { speed: 1.6 }, 2),
      L('Kuźnia magmowa', 'Magma smeltery', [s('obsidian', 30), s('cobalt_steel', 12), s('brick', 40)], 160, [4, 3], 2, { speed: 2.4 }, 6),
    ],
  },
  {
    id: 'forge', category: 'production',
    descPl: 'Kuje narzędzia, broń i pancerze. Każdy poziom otwiera nowe metale.',
    levels: [
      L('Kowadło', 'Anvil', [s('stone', 10), s('copper_bar', 6)], 16, [2, 1], 1, { speed: 1 }),
      L('Kuźnia', 'Smithy', [s('brick', 20), s('iron_bar', 10), s('bronze_bar', 6)], 60, [3, 2], 1, { speed: 1.5 }),
      L('Kuźnia mistrzowska', 'Master forge', [s('cobalt_steel', 10), s('stone_block', 20), s('cut_sapphire', 2)], 130, [4, 2], 2, { speed: 2.3 }, 3),
    ],
  },
  {
    id: 'workshop', category: 'production',
    descPl: 'Skóry, liny i tkaniny; potem zębatki, rury i sprężyny; w końcu tłoki i zawory maszyn parowych.',
    levels: [
      L('Warsztat rzemieślnika', 'Craft bench', [s('plank', 12), s('stone', 6)], 12, [2, 1], 1, { speed: 1 }),
      L('Pracownia mechanizmów', 'Mechanism shop', [s('iron_bar', 10), s('brass_bar', 6), s('plank', 10)], 60, [3, 2], 1, { speed: 1.5 }),
      L('Fabryka parowa', 'Steam works', [s('nickel_steel', 12), s('gear', 10), s('pressure_valve', 4)], 120, [4, 3], 2, { speed: 2.4 }, 6),
    ],
  },
  {
    id: 'alchemy', category: 'production',
    descPl: 'Nawozy, leki, odtrutki, proch górniczy, esencje i atrament runiczny.',
    levels: [
      L('Zielarnia', 'Herbalist', [s('plank', 10), s('clay', 10), s('copper_bar', 4)], 20, [2, 2], 1, { speed: 1 }),
      L('Laboratorium', 'Laboratory', [s('glass', 12), s('copper_bar', 8), s('brick', 10)], 60, [3, 2], 1, { speed: 1.5 }),
      L('Laboratorium eteryczne', 'Ethereal lab', [s('tempered_glass', 10), s('silver_bar', 8), s('gold_bar', 4)], 130, [3, 3], 2, { speed: 2.2 }, 2),
    ],
  },
  {
    id: 'lore_hall', category: 'research',
    descPl: 'Kronikarze spisują wiedzę i prowadzą badania. Bez niej drzewko technologii stoi.',
    levels: [
      L('Kącik kronikarza', 'Chronicler nook', [s('plank', 10), s('stone', 10)], 14, [2, 2], 1, { research: 1, packTier: 2 }),
      L('Biblioteka', 'Library', [s('stone_block', 30), s('glass', 10), s('brass_bar', 4)], 70, [3, 3], 2, { research: 1.6, packTier: 5 }),
      L('Archiwum', 'Archive', [s('cut_sapphire', 4), s('gold_bar', 8), s('tempered_glass', 8), s('stone_block', 40)], 160, [4, 3], 3, { research: 2.4, packTier: 7 }),
    ],
  },
  {
    id: 'barracks', category: 'defense',
    descPl: 'Szkolenie straży: krasnoludy uczą się walki i trzymają tu ekwipunek bojowy.',
    levels: [
      L('Ćwiczebnia', 'Training yard', [s('wood', 15), s('stone', 10), s('leather', 6)], 20, [3, 2], 0, { guards: 4, training: 1 }),
      L('Koszary', 'Barracks', [s('stone_block', 25), s('iron_bar', 10), s('leather', 8)], 60, [4, 2], 0, { guards: 8, training: 1.5 }),
      L('Sala bohaterów', 'Hall of heroes', [s('cobalt_steel', 10), s('gold_bar', 6), s('stone_block', 40)], 140, [5, 3], 0, { guards: 12, training: 2.2, morale: 3 }),
    ],
  },
  {
    id: 'defense_tower', category: 'defense',
    descPl: 'Automatyczna obrona korytarzy. Obsługuje ją jeden strażnik.',
    levels: [
      L('Balista', 'Ballista', [s('plank', 15), s('rope', 6), s('copper_bar', 4)], 24, [1, 2], 1, { damage: 18, range: 10, rate: 0.5 }),
      L('Balista powtarzalna', 'Repeating ballista', [s('iron_plate', 6), s('gear', 6), s('spring', 4)], 60, [1, 2], 1, { damage: 22, range: 12, rate: 1.4 }),
      L('Działo runiczne', 'Rune cannon', [s('adamant_bar', 4), s('rune_tablet', 2), s('fire_essence', 4), s('clockwork', 2), s('stone_block', 30)], 150, [2, 2], 1, { damage: 90, range: 16, rate: 0.6, vsConstructs: 2 }, 3),
    ],
  },
  {
    id: 'pump_station', category: 'logistics',
    descPl: 'Odpompowuje wodę i lawę z wyrobisk. Bez pomp Zatopione Głębie pozostaną zatopione.',
    levels: [
      L('Pompa ręczna', 'Hand pump', [s('plank', 10), s('pipe', 6), s('bronze_bar', 4)], 24, [1, 2], 1, { flow: 1 }),
      L('Pompa tłokowa', 'Piston pump', [s('iron_plate', 8), s('gear', 8), s('pipe', 10)], 60, [2, 2], 0, { flow: 4 }, 3),
      L('Pompa parowa', 'Steam pump', [s('nickel_steel', 10), s('piston', 4), s('pressure_valve', 4)], 110, [2, 3], 0, { flow: 12, lava: 1 }, 6),
    ],
  },
  {
    id: 'power_plant', category: 'power',
    descPl: 'Energia dla maszyn: koło wodne na podziemnym strumieniu, maszyna parowa, wreszcie turbina na lawie.',
    levels: [
      L('Koło wodne', 'Water wheel', [s('beam', 10), s('plank', 20), s('gear', 6)], 50, [3, 3], 0, { needsWater: 1 }, -6),
      L('Maszyna parowa', 'Steam engine', [s('iron_plate', 12), s('pipe', 10), s('piston', 2), s('pressure_valve', 2)], 110, [3, 3], 1, { fuelPerMin: 6 }, -16),
      L('Turbina magmowa', 'Magma turbine', [s('heat_exchanger', 2), s('nickel_steel', 12), s('obsidian', 20)], 180, [4, 4], 0, { needsLava: 1 }, -45),
    ],
  },
  {
    id: 'lift', category: 'logistics',
    descPl: 'Pionowy transport ludzi i towarów. W grodzie sięgającym setek kafli w dół to kręgosłup logistyki.',
    levels: [
      L('Kołowrót linowy', 'Rope windlass', [s('beam', 8), s('rope', 10), s('plank', 10)], 30, [2, 2], 1, { speed: 1, cargo: 4 }),
      L('Winda zębata', 'Geared lift', [s('iron_bar', 10), s('gear', 10), s('chain', 6)], 70, [2, 2], 0, { speed: 2.5, cargo: 10 }, 2),
      L('Winda parowa', 'Steam lift', [s('nickel_steel', 10), s('piston', 4), s('chain', 10)], 120, [2, 3], 0, { speed: 5, cargo: 24 }, 5),
    ],
  },
  {
    id: 'rail_depot', category: 'logistics',
    descPl: 'Wagoniki na torach: od pchanych ręcznie po parową kolejkę z automatycznymi trasami.',
    levels: [
      L('Zajezdnia', 'Cart depot', [s('rail', 10), s('plank', 10), s('iron_bar', 4)], 40, [3, 2], 1, { carts: 2, speed: 2 }),
      L('Stacja z dźwigiem', 'Crane station', [s('iron_plate', 8), s('gear', 6), s('chain', 4)], 70, [3, 2], 0, { carts: 4, speed: 2.5, autoload: 1 }, 2),
      L('Parowa kolejka', 'Steam railway', [s('nickel_steel', 8), s('piston', 4), s('pressure_valve', 2)], 130, [4, 2], 0, { carts: 8, speed: 5, routes: 1 }, 4),
    ],
  },
  {
    id: 'infirmary', category: 'living',
    descPl: 'Leczenie ran, zatruć i odmrożeń.',
    levels: [
      L('Posłanie zielarza', 'Healer cot', [s('plank', 10), s('cloth', 6)], 14, [2, 1], 1, { heal: 1, beds: 2 }),
      L('Lecznica', 'Infirmary', [s('stone_block', 20), s('glass', 6), s('silver_bar', 2)], 50, [3, 2], 1, { heal: 2, beds: 4 }),
      L('Sanktuarium', 'Sanctuary', [s('cut_amethyst', 4), s('gold_bar', 4), s('stone_block', 30)], 120, [4, 2], 2, { heal: 3.5, beds: 6, cure: 1 }),
    ],
  },
  {
    id: 'tavern', category: 'living',
    descPl: 'Opowieści, kufle i śpiew. Karczma podnosi morale i ściąga nowych osadników.',
    levels: [
      L('Szynk', 'Taproom', [s('plank', 15), s('stone', 10)], 18, [3, 2], 1, { morale: 2, migrants: 1 }),
      L('Karczma', 'Tavern', [s('brick', 25), s('copper_bar', 10), s('cloth', 6)], 50, [4, 2], 1, { morale: 4, migrants: 1.5 }),
      L('Biesiadna sala', 'Feast hall', [s('gold_bar', 6), s('silver_bar', 6), s('stone_block', 30), s('glass', 8)], 120, [5, 3], 2, { morale: 7, migrants: 2.2 }),
    ],
  },
  {
    id: 'jeweler', category: 'production',
    descPl: 'Soczewki, szlif klejnotów, pierścienie i amulety chroniące przed żywiołami.',
    levels: [
      L('Szlifiernia', 'Lapidary', [s('stone_block', 10), s('iron_bar', 6), s('quartz', 4)], 30, [2, 1], 1, { speed: 1 }),
      L('Pracownia jubilerska', 'Jeweler', [s('brass_bar', 8), s('glass', 6), s('silver_bar', 4)], 60, [3, 2], 1, { speed: 1.5 }),
      L('Runiczny jubiler', 'Rune jeweler', [s('gold_bar', 8), s('emberbronze_bar', 4), s('cut_amethyst', 2)], 130, [3, 2], 1, { speed: 2.2 }),
    ],
  },
  {
    id: 'drill_rig', category: 'production',
    descPl: 'Automatyczne wydobycie złóż w zasięgu, bez krasnoluda przy przodku — jak kopalnia przyszłości.',
    levels: [
      L('Kołowrót wiertniczy', 'Bore windlass', [s('beam', 10), s('rope', 8), s('iron_bar', 6)], 50, [2, 3], 1, { tilesPerMin: 0.3, radius: 3 }),
      L('Wiertło parowe', 'Steam drill', [s('nickel_steel', 8), s('piston', 2), s('gear', 8)], 110, [3, 3], 0, { tilesPerMin: 1.2, radius: 5 }, 5),
      L('Wiertło magmowe', 'Magma drill', [s('emberbronze_bar', 8), s('heat_exchanger', 2), s('cobalt_steel', 6)], 180, [3, 4], 0, { tilesPerMin: 3, radius: 7 }, 12),
    ],
  },
];

const I = (id: string, namePl: string, nameEn: string, tier: number, cost: Stack[], work: number, descPl: string): Infrastructure =>
  ({ id, namePl, nameEn, tier, cost, work, descPl });

export const INFRASTRUCTURE: readonly Infrastructure[] = [
  I('ladder', 'Drabina', 'Ladder', 0, [s('wood', 2)], 3, 'Pozwala wspinać się po pionowych szybach.'),
  I('platform', 'Pomost', 'Platform', 0, [s('plank', 2)], 3, 'Podłoga nad pustką; można po niej chodzić.'),
  I('torch', 'Pochodnia', 'Torch', 0, [s('wood', 1), s('resin', 1)], 1, 'Ciepłe światło na kilka kafli. Wypala się powoli.'),
  I('wooden_door', 'Drzwi drewniane', 'Wooden door', 0, [s('plank', 4)], 5, 'Krasnoludy przechodzą, wilki i gobliny muszą je wyważyć.'),
  I('stairs', 'Schody', 'Stairs', 1, [s('stone_block', 2)], 5, 'Szybsze od drabiny przejście między poziomami.'),
  I('chute', 'Zsyp', 'Chute', 1, [s('plank', 2)], 3, 'Towary spadają nim w dół szybu prosto do magazynu.'),
  I('brazier', 'Kosz żarowy', 'Brazier', 1, [s('copper_bar', 1), s('stone', 3)], 4, 'Mocne światło i ciepło; pali węgiel.'),
  I('wooden_prop', 'Stempel drewniany', 'Timber prop', 1, [s('wood', 3)], 3, 'Podpiera strop i zapobiega zawałom.'),
  I('stone_pillar', 'Filar kamienny', 'Stone pillar', 1, [s('stone_block', 3), s('mortar', 2)], 6, 'Trwała podpora szerokich hal.'),
  I('stone_wall', 'Mur kamienny', 'Stone wall', 1, [s('stone_block', 2)], 4, 'Zamyka przejścia i chroni przed zalaniem.'),
  I('spike_trap', 'Pułapka z kolcami', 'Spike trap', 1, [s('plank', 2), s('copper_bar', 1)], 4, 'Rani wrogów przechodzących przez kafel.'),
  I('banner', 'Sztandar', 'Banner', 1, [s('cloth', 2), s('plank', 1)], 2, 'Podnosi nastrój w pomieszczeniu.'),
  I('statue', 'Posąg', 'Statue', 1, [s('stone_block', 6)], 12, 'Piękno, które krasnoludy doceniają.'),
  I('iron_door', 'Drzwi żelazne', 'Iron door', 2, [s('iron_plate', 2)], 8, 'Wytrzymuje szturm trolla.'),
  I('bulkhead', 'Gródź', 'Bulkhead', 2, [s('iron_plate', 2), s('pitch', 2)], 8, 'Wodoszczelne drzwi przeciw zalaniom i lawie.'),
  I('iron_truss', 'Kratownica żelazna', 'Iron truss', 2, [s('iron_bar', 2), s('beam', 1)], 6, 'Podpora dla wielkich kawern.'),
  I('oil_lamp_post', 'Latarnia olejna', 'Oil lamp post', 2, [s('bronze_bar', 1), s('glass', 1)], 4, 'Jasne światło; pali smołę lub olej.'),
  I('rail_track', 'Tory', 'Rail track', 2, [s('rail', 1)], 2, 'Droga dla wagoników.'),
  I('pipeline', 'Rurociąg', 'Pipeline', 2, [s('pipe', 1)], 2, 'Prowadzi wodę, parę i lawę.'),
  I('vent_shaft', 'Szyb wentylacyjny', 'Vent shaft', 3, [s('plank', 4), s('gear', 1)], 6, 'Wyciąga zarodniki i opary z wyrobisk.'),
  I('heater', 'Kocioł grzewczy', 'Heater', 4, [s('brass_bar', 2), s('pipe', 2)], 8, 'Ogrzewa pomieszczenie parą lub węglem.'),
  I('chain_conveyor', 'Przenośnik łańcuchowy', 'Chain conveyor', 4, [s('chain', 2), s('gear', 1)], 4, 'Automatycznie przenosi towary (wymaga energii).'),
  I('blade_trap', 'Pułapka ostrzowa', 'Blade trap', 4, [s('steel_bar', 2), s('spring', 1)], 6, 'Ciężkie ostrza na sprężynach.'),
  I('crystal_lamp_post', 'Latarnia kryształowa', 'Crystal lamp post', 5, [s('lens', 1), s('brass_bar', 1)], 5, 'Świeci bez paliwa, chłodnym blaskiem.'),
  I('cooler', 'Chłodnica', 'Cooler', 5, [s('frost_core', 1), s('nickel_steel', 1)], 8, 'Mroźny rdzeń chłodzi pomieszczenia w Pasie Magmy.'),
  I('obsidian_wall', 'Mur obsydianowy', 'Obsidian wall', 6, [s('obsidian', 3), s('mortar', 1)], 8, 'Lawa się o niego rozbija.'),
  I('glimmer_beacon', 'Latarnia lśnitu', 'Glimmer beacon', 7, [s('glimmersteel_bar', 1), s('lens', 1)], 10, 'Światło, którego nie pożera prastary mrok.'),
  I('ward_stone', 'Kamień ochronny', 'Ward stone', 7, [s('rune_tablet', 1), s('stone_block', 2)], 10, 'Runy odpędzające grozę w promieniu kilku kafli.'),
];

export const START_BUILDINGS: readonly (readonly [string, 1 | 2 | 3])[] = [
  ['hearth', 1],
  ['storehouse', 1],
  ['quarters', 1],
  ['carpentry', 1],
  ['farm', 1],
  ['lore_hall', 1],
];
export const START_INFRA: readonly string[] = ['ladder', 'platform', 'torch'];
