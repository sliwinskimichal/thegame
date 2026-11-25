/**
 * Where raw resources and drops come from: mineable deposits, harvestable
 * world objects and creatures (wildlife, monsters, biome bosses).
 * No creature can be tamed or put to work — only dwarves and machines work.
 */
import type { Creature, Deposit, DropEntry, WorldObject } from './types';

const d = (id: string, min: number, max: number, chance = 1): DropEntry => ({ id, min, max, chance });

/** The 26 resource deposits (plus ordinary rock, which yields stone). */
export const DEPOSITS: readonly Deposit[] = [
  { id: 'clay_bed', namePl: 'Złoże gliny', nameEn: 'Clay bed', yields: 'clay', amount: 2, biomes: ['foothills', 'limestone'], hardness: 1.3, pickTier: 0, rarity: 'common' },
  { id: 'sand_bed', namePl: 'Złoże piasku', nameEn: 'Sand bed', yields: 'sand', amount: 2, biomes: ['foothills', 'sunken'], hardness: 0.8, pickTier: 0, rarity: 'common' },
  { id: 'copper_vein', namePl: 'Żyła miedzi', nameEn: 'Copper vein', yields: 'copper_ore', amount: 2, biomes: ['foothills', 'limestone', 'granite'], hardness: 2.8, pickTier: 1, rarity: 'common' },
  { id: 'coal_seam', namePl: 'Pokład węgla', nameEn: 'Coal seam', yields: 'coal', amount: 2, biomes: ['limestone', 'granite', 'fungal'], hardness: 2.0, pickTier: 1, rarity: 'common' },
  { id: 'tin_vein', namePl: 'Żyła cyny', nameEn: 'Tin vein', yields: 'tin_ore', amount: 2, biomes: ['limestone'], hardness: 2.6, pickTier: 1, rarity: 'uncommon' },
  { id: 'limestone_bed', namePl: 'Ławica wapienia', nameEn: 'Limestone bed', yields: 'limestone', amount: 2, biomes: ['limestone'], hardness: 2.2, pickTier: 1, rarity: 'common' },
  { id: 'saltpeter_crust', namePl: 'Naloty saletry', nameEn: 'Saltpeter crust', yields: 'saltpeter', amount: 2, biomes: ['limestone'], hardness: 1.6, pickTier: 1, rarity: 'uncommon' },
  { id: 'iron_vein', namePl: 'Żyła żelaza', nameEn: 'Iron vein', yields: 'iron_ore', amount: 2, biomes: ['granite', 'fungal', 'sunken'], hardness: 3.6, pickTier: 2, rarity: 'common' },
  { id: 'lead_vein', namePl: 'Żyła galeny', nameEn: 'Galena vein', yields: 'lead_ore', amount: 2, biomes: ['granite'], hardness: 3.0, pickTier: 2, rarity: 'uncommon' },
  { id: 'zinc_vein', namePl: 'Żyła sfalerytu', nameEn: 'Sphalerite vein', yields: 'zinc_ore', amount: 2, biomes: ['granite'], hardness: 3.2, pickTier: 2, rarity: 'uncommon' },
  { id: 'quartz_vein', namePl: 'Żyła kwarcu', nameEn: 'Quartz vein', yields: 'quartz', amount: 2, biomes: ['granite', 'crystal'], hardness: 3.8, pickTier: 2, rarity: 'uncommon' },
  { id: 'silver_vein', namePl: 'Żyła srebra', nameEn: 'Silver vein', yields: 'silver_ore', amount: 2, biomes: ['fungal', 'sunken', 'crystal'], hardness: 3.8, pickTier: 2, rarity: 'uncommon' },
  { id: 'sulfur_vent', namePl: 'Wyziew siarki', nameEn: 'Sulfur vent', yields: 'sulfur', amount: 2, biomes: ['fungal', 'magma'], hardness: 2.4, pickTier: 2, rarity: 'uncommon' },
  { id: 'salt_bed', namePl: 'Pokład soli', nameEn: 'Salt bed', yields: 'salt', amount: 3, biomes: ['sunken'], hardness: 2.2, pickTier: 2, rarity: 'common' },
  { id: 'nickel_vein', namePl: 'Żyła niklu', nameEn: 'Nickel vein', yields: 'nickel_ore', amount: 2, biomes: ['sunken'], hardness: 4.2, pickTier: 3, rarity: 'uncommon' },
  { id: 'gold_vein', namePl: 'Żyła złota', nameEn: 'Gold vein', yields: 'gold_ore', amount: 1, biomes: ['sunken', 'crystal', 'magma', 'ancient'], hardness: 3.4, pickTier: 3, rarity: 'rare' },
  { id: 'cobalt_vein', namePl: 'Żyła kobaltu', nameEn: 'Cobalt vein', yields: 'cobalt_ore', amount: 2, biomes: ['crystal'], hardness: 4.6, pickTier: 3, rarity: 'uncommon' },
  { id: 'amethyst_geode', namePl: 'Geoda ametystu', nameEn: 'Amethyst geode', yields: 'amethyst', amount: 1, biomes: ['crystal', 'ancient'], hardness: 4.2, pickTier: 3, rarity: 'rare' },
  { id: 'sapphire_geode', namePl: 'Geoda szafiru', nameEn: 'Sapphire geode', yields: 'sapphire', amount: 1, biomes: ['crystal'], hardness: 4.4, pickTier: 3, rarity: 'rare' },
  { id: 'frost_crystal_bed', namePl: 'Kępa mroźnych kryształów', nameEn: 'Frost crystal bed', yields: 'frost_crystal', amount: 2, biomes: ['crystal'], hardness: 4.0, pickTier: 3, rarity: 'uncommon' },
  { id: 'ruby_geode', namePl: 'Geoda rubinu', nameEn: 'Ruby geode', yields: 'ruby', amount: 1, biomes: ['magma'], hardness: 5.0, pickTier: 4, rarity: 'rare' },
  { id: 'obsidian_flow', namePl: 'Zastygły obsydian', nameEn: 'Obsidian flow', yields: 'obsidian', amount: 2, biomes: ['magma'], hardness: 6.0, pickTier: 4, rarity: 'common' },
  { id: 'emberite_vein', namePl: 'Żyła żarytu', nameEn: 'Emberite vein', yields: 'emberite_ore', amount: 1, biomes: ['magma'], hardness: 5.5, pickTier: 4, rarity: 'uncommon' },
  { id: 'adamantite_vein', namePl: 'Żyła adamantytu', nameEn: 'Adamantite vein', yields: 'adamantite_ore', amount: 1, biomes: ['ancient'], hardness: 8.0, pickTier: 4, rarity: 'rare' },
  { id: 'runestone_vein', namePl: 'Złoże runokamienia', nameEn: 'Runestone lode', yields: 'runestone', amount: 1, biomes: ['ancient'], hardness: 6.5, pickTier: 4, rarity: 'uncommon' },
  { id: 'glimmerite_vein', namePl: 'Żyła lśnitu', nameEn: 'Glimmerite vein', yields: 'glimmerite_ore', amount: 1, biomes: ['ancient'], hardness: 7.5, pickTier: 5, rarity: 'legendary' },
];

/** Ordinary rock of every layer yields stone; its pick tier rises with depth. */
export const ROCK_PICK_TIER: Readonly<Record<string, number>> = {
  foothills: 0, limestone: 1, granite: 2, fungal: 2, sunken: 2, crystal: 3, magma: 4, ancient: 4, heart: 5,
};

export const OBJECTS: readonly WorldObject[] = [
  { id: 'pine_tree', namePl: 'Sosna', nameEn: 'Pine', biomes: ['foothills'], work: 6, tool: 'axe', drops: [d('wood', 3, 5), d('resin', 1, 2, 0.6)], regrows: true },
  { id: 'birch_tree', namePl: 'Brzoza', nameEn: 'Birch', biomes: ['foothills'], work: 5, tool: 'axe', drops: [d('wood', 3, 4), d('fiber', 1, 2, 0.5)], regrows: true },
  { id: 'berry_bush', namePl: 'Krzak jagód', nameEn: 'Berry bush', biomes: ['foothills'], work: 2, tool: 'hands', drops: [d('berries', 2, 4), d('fiber', 1, 2)], regrows: true },
  { id: 'tall_grass', namePl: 'Wysoka trawa', nameEn: 'Tall grass', biomes: ['foothills'], work: 1, tool: 'hands', drops: [d('fiber', 1, 3)], regrows: true },
  { id: 'wild_barley', namePl: 'Dziki jęczmień', nameEn: 'Wild barley', biomes: ['foothills'], work: 2, tool: 'hands', drops: [d('grain', 2, 3)], regrows: true },
  { id: 'bird_nest', namePl: 'Ptasie gniazdo', nameEn: 'Bird nest', biomes: ['foothills'], work: 1, tool: 'hands', drops: [d('feather', 1, 3)], regrows: true },
  { id: 'moss_patch', namePl: 'Kępa mchu', nameEn: 'Moss patch', biomes: ['limestone', 'granite'], work: 2, tool: 'hands', drops: [d('moss', 2, 4)], regrows: true },
  { id: 'guano_pile', namePl: 'Hałda guana', nameEn: 'Guano pile', biomes: ['limestone'], work: 3, tool: 'hands', drops: [d('guano', 3, 6)], regrows: true },
  { id: 'bone_pile', namePl: 'Stos kości', nameEn: 'Bone pile', biomes: ['granite', 'fungal', 'ancient'], work: 2, tool: 'hands', drops: [d('bone', 2, 5)] },
  { id: 'giant_mushroom', namePl: 'Olbrzymi grzyb', nameEn: 'Giant mushroom', biomes: ['fungal'], work: 7, tool: 'axe', drops: [d('mushroom_timber', 4, 6), d('mushroom', 2, 4)], regrows: true },
  { id: 'glowcap', namePl: 'Świetlik grzybowy', nameEn: 'Glowcap', biomes: ['fungal'], work: 2, tool: 'hands', drops: [d('glow_spores', 1, 3), d('mushroom', 1, 1, 0.4)], regrows: true },
  { id: 'kelp_bed', namePl: 'Łąka wodorostów', nameEn: 'Kelp bed', biomes: ['sunken'], work: 2, tool: 'hands', drops: [d('kelp', 2, 4)], regrows: true },
  { id: 'giant_clam', namePl: 'Olbrzymi małż', nameEn: 'Giant clam', biomes: ['sunken'], work: 4, tool: 'hands', drops: [d('pearl', 1, 1, 0.35), d('raw_meat', 1, 2)], regrows: true },
  { id: 'fish_shoal', namePl: 'Ławica ryb', nameEn: 'Fish shoal', biomes: ['sunken'], work: 5, tool: 'rod', drops: [d('cave_fish', 1, 2)], regrows: true },
  { id: 'crystal_cluster', namePl: 'Kiść kryształów', nameEn: 'Crystal cluster', biomes: ['crystal'], work: 4, tool: 'pick', drops: [d('quartz', 2, 4), d('frost_crystal', 1, 1, 0.25)] },
  { id: 'ruin_cache', namePl: 'Skrytka w ruinach', nameEn: 'Ruin cache', biomes: ['ancient'], work: 5, tool: 'hands', drops: [d('relic', 1, 1, 0.4), d('rune_dust', 1, 3), d('ancient_cog', 1, 1, 0.5)] },
];

const c = (
  id: string, namePl: string, nameEn: string, biome: Creature['biome'], behavior: Creature['behavior'],
  hp: number, damage: number, armor: number, speed: number, drops: DropEntry[], descPl?: string,
): Creature => ({ id, namePl, nameEn, biome, behavior, hp, damage, armor, speed, drops, boss: behavior === 'boss', descPl });

export const CREATURES: readonly Creature[] = [
  // Foothills
  c('wolf', 'Wilk', 'Wolf', 'foothills', 'hunter', 30, 6, 0, 3.2, [d('raw_meat', 1, 2), d('hide', 1, 1), d('fang', 1, 1, 0.5), d('bone', 1, 1, 0.5)]),
  c('boar', 'Dzik', 'Boar', 'foothills', 'territorial', 40, 7, 1, 2.6, [d('raw_meat', 2, 3), d('hide', 1, 1)]),
  c('deer', 'Jeleń', 'Deer', 'foothills', 'skittish', 25, 0, 0, 3.6, [d('raw_meat', 2, 3), d('hide', 1, 1), d('bone', 1, 1)]),
  c('goblin_raider', 'Goblin rabuś', 'Goblin raider', 'foothills', 'raider', 35, 7, 1, 2.8, [d('copper_ore', 0, 2), d('wood', 0, 2), d('bone', 0, 1)]),
  c('alpha_wolf', 'Wilczy Herszt', 'Alpha wolf', 'foothills', 'boss', 220, 14, 2, 3.4, [d('alpha_pelt', 1, 1), d('hide', 2, 3), d('fang', 2, 2)], 'Prowadzi watahę na gród w pierwszą zimową noc.'),
  // Limestone Ledges
  c('cave_bat', 'Nietoperz jaskiniowy', 'Cave bat', 'limestone', 'swarm', 8, 2, 0, 5, [d('bat_wing', 1, 1, 0.6), d('guano', 0, 1)]),
  c('rock_rat', 'Szczur skalny', 'Rock rat', 'limestone', 'skittish', 10, 2, 0, 3, [d('raw_meat', 1, 1, 0.7), d('bone', 0, 1)]),
  c('goblin_miner', 'Goblin kopacz', 'Goblin miner', 'limestone', 'raider', 45, 8, 2, 2.6, [d('coal', 0, 2), d('copper_ore', 0, 2), d('tin_ore', 0, 1)]),
  c('bat_queen', 'Królowa Nietoperzy', 'Bat queen', 'limestone', 'boss', 400, 12, 1, 4, [d('bat_queen_heart', 1, 1), d('bat_wing', 4, 6), d('guano', 5, 10)], 'Gaśnie przy niej każde światło, które nie jest osłonięte.'),
  // Granite Roots
  c('cave_crawler', 'Pełzacz jaskiniowy', 'Cave crawler', 'granite', 'hunter', 55, 9, 3, 2.8, [d('chitin', 1, 2), d('crawler_acid', 1, 1, 0.5)]),
  c('giant_mole', 'Olbrzymi kret', 'Giant mole', 'granite', 'territorial', 70, 8, 1, 2, [d('fur', 1, 2), d('raw_meat', 1, 2)]),
  c('blind_lizard', 'Ślepiec', 'Blind lizard', 'granite', 'ambusher', 40, 10, 1, 3, [d('hide', 1, 1), d('raw_meat', 1, 1)]),
  c('brood_mother', 'Matka Pełzaczy', 'Brood mother', 'granite', 'boss', 700, 18, 6, 2.4, [d('brood_carapace', 1, 1), d('chitin', 6, 10), d('crawler_acid', 3, 5)], 'Gniazdo w zalanej szczelinie granitu.'),
  // Fungal Grottos
  c('giant_spider', 'Olbrzymi pająk', 'Giant spider', 'fungal', 'ambusher', 70, 12, 2, 3.4, [d('spider_silk', 1, 3), d('venom_sac', 1, 1, 0.6), d('chitin', 0, 1)], 'Jad zatruwa; bez antidotum rana ropieje.'),
  c('myconid', 'Grzybnik', 'Myconid', 'fungal', 'territorial', 60, 8, 1, 1.8, [d('mushroom', 1, 2), d('glow_spores', 1, 2)]),
  c('cave_slime', 'Śluzowiec', 'Cave slime', 'fungal', 'territorial', 50, 6, 0, 1.2, [d('slime', 1, 3)]),
  c('web_queen', 'Królowa Pajęczyn', 'Web queen', 'fungal', 'boss', 1100, 22, 5, 3, [d('queen_silk', 1, 1), d('spider_silk', 8, 12), d('venom_sac', 3, 5)]),
  // Sunken Deep
  c('deep_eel', 'Węgorz głębinowy', 'Deep eel', 'sunken', 'hunter', 90, 14, 2, 4, [d('eel_skin', 1, 2), d('cave_fish', 0, 1)]),
  c('drowned_one', 'Topielec', 'Drowned one', 'sunken', 'ambusher', 80, 12, 1, 2.2, [d('bone', 1, 3), d('kelp', 1, 2), d('pearl', 1, 1, 0.15)]),
  c('shore_crab', 'Krab skalny', 'Rock crab', 'sunken', 'territorial', 60, 10, 6, 2, [d('chitin', 1, 2), d('raw_meat', 1, 1)]),
  c('leviathan', 'Lewiatan Jeziora', 'Lake leviathan', 'sunken', 'boss', 1600, 28, 6, 3.5, [d('leviathan_scale', 1, 1), d('eel_skin', 6, 10), d('pearl', 2, 4)]),
  // Crystal Depths
  c('crystal_golem', 'Golem kryształowy', 'Crystal golem', 'crystal', 'territorial', 160, 18, 10, 1.6, [d('golem_shard', 2, 4), d('crystal_heart', 1, 1, 0.12), d('quartz', 1, 3)], 'Ostrze się ześlizguje; młot kruszy.'),
  c('frost_moth', 'Mroźna ćma', 'Frost moth', 'crystal', 'swarm', 20, 4, 0, 4.5, [d('frost_moth_dust', 1, 1)]),
  c('cave_troll', 'Troll jaskiniowy', 'Cave troll', 'crystal', 'hunter', 220, 22, 4, 2.4, [d('troll_hide', 1, 2), d('troll_fat', 1, 3), d('bone', 2, 2)], 'Regeneruje się, jeśli nie dobić go ogniem.'),
  c('crystal_colossus', 'Kryształowy Kolos', 'Crystal colossus', 'crystal', 'boss', 2400, 34, 14, 1.4, [d('colossus_core', 1, 1), d('crystal_heart', 1, 2), d('golem_shard', 8, 8)]),
  // Magma Belt
  c('salamander', 'Salamandra', 'Salamander', 'magma', 'territorial', 120, 18, 6, 2.6, [d('salamander_scale', 1, 3), d('raw_meat', 1, 1)]),
  c('fire_imp', 'Ognisty chochlik', 'Fire imp', 'magma', 'swarm', 50, 12, 1, 4, [d('fire_gland', 1, 1, 0.7)]),
  c('magma_worm', 'Robak magmowy', 'Magma worm', 'magma', 'ambusher', 300, 30, 8, 2.2, [d('magma_core', 1, 1, 0.4), d('obsidian', 2, 4)]),
  c('magma_wyrm', 'Pradawny Robak Magmowy', 'Ancient magma wyrm', 'magma', 'boss', 3400, 42, 12, 2.8, [d('wyrm_heart', 1, 1), d('magma_core', 3, 3), d('fire_gland', 6, 6)]),
  // Ancient Deep
  c('wraith', 'Upiór', 'Wraith', 'ancient', 'hunter', 140, 24, 0, 3.2, [d('ectoplasm', 1, 2)], 'Zwykła stal przechodzi przez niego jak przez dym.'),
  c('ancient_construct', 'Prastary konstrukt', 'Ancient construct', 'ancient', 'territorial', 400, 30, 20, 1.8, [d('ancient_cog', 1, 2), d('rune_dust', 1, 3)]),
  c('shadow_stalker', 'Cieniostwór', 'Shadow stalker', 'ancient', 'ambusher', 180, 28, 3, 3.8, [d('ectoplasm', 0, 1), d('bone', 2, 2)]),
  c('ruin_guardian', 'Strażnik Ruin', 'Ruin guardian', 'ancient', 'boss', 5000, 50, 24, 1.8, [d('guardian_sigil', 1, 1), d('ancient_cog', 6, 6), d('relic', 2, 2)]),
  // The Heart
  c('light_eater', 'Pożeracz Światła', 'The Light-Eater', 'heart', 'boss', 12000, 70, 20, 2.5, [d('eater_shard', 1, 1)], 'Śpi w Sercu Góry i pożera każde światło, które się do niego zbliży.'),
];
