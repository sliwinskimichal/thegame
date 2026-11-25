/**
 * Every "thing" in the economy: raw ores, drops from objects and creatures,
 * crafted materials and items dwarves use. Tier = biome where it first
 * becomes obtainable (0 Foothills ... 8 Heart).
 */
import type { ItemSlot, ItemStats, ResKind, Resource } from './types';

const R: Resource[] = [];
function def(kind: ResKind, id: string, namePl: string, nameEn: string, tier: number, value: number, extra: Partial<Resource> = {}): void {
  R.push({ id, kind, namePl, nameEn, tier, value, stack: kind === 'item' ? (extra.slot === 'consumable' || extra.slot === 'ammo' ? 20 : 1) : 50, ...extra });
}
const raw = (id: string, pl: string, en: string, t: number, v: number, tags?: string[]) => def('raw', id, pl, en, t, v, { tags });
const drop = (id: string, pl: string, en: string, t: number, v: number, tags?: string[]) => def('drop', id, pl, en, t, v, { tags });
const mat = (id: string, pl: string, en: string, t: number, v: number, tags?: string[]) => def('material', id, pl, en, t, v, { tags });
const item = (id: string, pl: string, en: string, t: number, v: number, slot: ItemSlot, stats: ItemStats, tags?: string[]) =>
  def('item', id, pl, en, t, v, { slot, stats, tags });

// ---------------------------------------------------------------- raw (mined)
raw('stone', 'Kamień', 'Stone', 0, 1, ['build']);
raw('clay', 'Glina', 'Clay', 0, 1);
raw('sand', 'Piasek', 'Sand', 0, 1);
raw('copper_ore', 'Ruda miedzi', 'Copper ore', 0, 3, ['ore']);
raw('coal', 'Węgiel', 'Coal', 1, 2, ['fuel']);
raw('tin_ore', 'Ruda cyny', 'Tin ore', 1, 4, ['ore']);
raw('limestone', 'Wapień', 'Limestone', 1, 1, ['flux']);
raw('saltpeter', 'Saletra', 'Saltpeter', 1, 4);
raw('iron_ore', 'Ruda żelaza', 'Iron ore', 2, 5, ['ore']);
raw('lead_ore', 'Galena', 'Galena', 2, 4, ['ore']);
raw('zinc_ore', 'Sfaleryt', 'Sphalerite', 2, 5, ['ore']);
raw('quartz', 'Kwarc', 'Quartz', 2, 6);
raw('silver_ore', 'Ruda srebra', 'Silver ore', 3, 10, ['ore']);
raw('sulfur', 'Siarka', 'Sulfur', 3, 5);
raw('salt', 'Sól kamienna', 'Rock salt', 4, 4);
raw('nickel_ore', 'Ruda niklu', 'Nickel ore', 4, 9, ['ore']);
raw('gold_ore', 'Ruda złota', 'Gold ore', 4, 16, ['ore']);
raw('cobalt_ore', 'Ruda kobaltu', 'Cobalt ore', 5, 14, ['ore']);
raw('amethyst', 'Ametyst', 'Amethyst', 5, 20, ['gem']);
raw('sapphire', 'Szafir', 'Sapphire', 5, 24, ['gem']);
raw('frost_crystal', 'Mroźny kryształ', 'Frost crystal', 5, 18, ['gem']);
raw('ruby', 'Rubin', 'Ruby', 6, 28, ['gem']);
raw('obsidian', 'Obsydian', 'Obsidian', 6, 8);
raw('emberite_ore', 'Ruda żarytu', 'Emberite ore', 6, 26, ['ore']);
raw('adamantite_ore', 'Ruda adamantytu', 'Adamantite ore', 7, 40, ['ore']);
raw('glimmerite_ore', 'Ruda lśnitu', 'Glimmerite ore', 7, 50, ['ore']);
raw('runestone', 'Runokamień', 'Runestone', 7, 30);

// ------------------------------------------------ drops (objects & creatures)
drop('wood', 'Drewno', 'Wood', 0, 1, ['fuel', 'build']);
drop('resin', 'Żywica', 'Resin', 0, 2);
drop('fiber', 'Włókno', 'Plant fiber', 0, 1);
drop('berries', 'Jagody', 'Berries', 0, 1, ['food']);
drop('grain', 'Jęczmień', 'Barley', 0, 1);
drop('raw_meat', 'Surowe mięso', 'Raw meat', 0, 2, ['food']);
drop('hide', 'Skóra surowa', 'Raw hide', 0, 3);
drop('bone', 'Kość', 'Bone', 0, 1);
drop('fang', 'Kieł', 'Fang', 0, 3);
drop('feather', 'Pióro', 'Feather', 0, 1);
drop('guano', 'Guano', 'Guano', 1, 1);
drop('bat_wing', 'Błona nietoperza', 'Bat membrane', 1, 3);
drop('moss', 'Mech jaskiniowy', 'Cave moss', 1, 1);
drop('chitin', 'Chityna', 'Chitin', 2, 4);
drop('crawler_acid', 'Kwas pełzacza', 'Crawler acid', 2, 5);
drop('fur', 'Futro', 'Fur', 2, 6);
drop('mushroom', 'Grzyb jadalny', 'Edible mushroom', 3, 2, ['food']);
drop('mushroom_timber', 'Drewno grzybowe', 'Mushroom timber', 3, 2, ['build']);
drop('glow_spores', 'Świecące zarodniki', 'Glow spores', 3, 4);
drop('spider_silk', 'Jedwab pajęczy', 'Spider silk', 3, 6);
drop('venom_sac', 'Gruczoł jadowy', 'Venom sac', 3, 6);
drop('slime', 'Śluz', 'Slime', 3, 3);
drop('cave_fish', 'Ryba jaskiniowa', 'Cave fish', 4, 3, ['food']);
drop('eel_skin', 'Skóra węgorza', 'Eel skin', 4, 8);
drop('pearl', 'Perła', 'Pearl', 4, 20);
drop('kelp', 'Wodorost jaskiniowy', 'Cave kelp', 4, 2, ['food']);
drop('golem_shard', 'Odłamek golema', 'Golem shard', 5, 10);
drop('crystal_heart', 'Kryształowe serce', 'Crystal heart', 5, 40);
drop('troll_hide', 'Skóra trolla', 'Troll hide', 5, 14);
drop('troll_fat', 'Tłuszcz trolla', 'Troll fat', 5, 8, ['fuel']);
drop('frost_moth_dust', 'Pył mroźnej ćmy', 'Frost moth dust', 5, 8);
drop('salamander_scale', 'Łuska salamandry', 'Salamander scale', 6, 14);
drop('fire_gland', 'Gruczoł ognisty', 'Fire gland', 6, 12);
drop('magma_core', 'Rdzeń magmowy', 'Magma core', 6, 30);
drop('ectoplasm', 'Ektoplazma', 'Ectoplasm', 7, 18);
drop('ancient_cog', 'Prastary tryb', 'Ancient cog', 7, 22);
drop('rune_dust', 'Pył runiczny', 'Rune dust', 7, 15);
drop('relic', 'Relikwia', 'Relic', 7, 60);
// boss trophies (one per biome) gate signature technologies
drop('alpha_pelt', 'Futro Wilczego Herszta', 'Alpha wolf pelt', 0, 30, ['trophy']);
drop('bat_queen_heart', 'Serce Królowej Nietoperzy', 'Bat queen heart', 1, 50, ['trophy']);
drop('brood_carapace', 'Pancerz Matki Pełzaczy', 'Brood mother carapace', 2, 70, ['trophy']);
drop('queen_silk', 'Jedwab Królowej Pajęczyn', 'Web queen silk', 3, 90, ['trophy']);
drop('leviathan_scale', 'Łuska Lewiatana', 'Leviathan scale', 4, 120, ['trophy']);
drop('colossus_core', 'Rdzeń Kolosa', 'Colossus core', 5, 150, ['trophy']);
drop('wyrm_heart', 'Serce Robaka Magmowego', 'Magma wyrm heart', 6, 180, ['trophy']);
drop('guardian_sigil', 'Pieczęć Strażnika', 'Guardian sigil', 7, 220, ['trophy']);
drop('eater_shard', 'Okruch Pożeracza', 'Shard of the Light-Eater', 8, 1000, ['trophy']);

// ---------------------------------------------------- crafted materials
mat('plank', 'Deska', 'Plank', 0, 2, ['build']);
mat('beam', 'Belka', 'Beam', 0, 3, ['build']);
mat('rope', 'Lina', 'Rope', 0, 3);
mat('charcoal', 'Węgiel drzewny', 'Charcoal', 0, 2, ['fuel']);
mat('brick', 'Cegła', 'Brick', 0, 2, ['build']);
mat('stone_block', 'Blok kamienny', 'Stone block', 0, 3, ['build']);
mat('leather', 'Skóra garbowana', 'Leather', 0, 6);
mat('parchment', 'Pergamin', 'Parchment', 0, 4);
mat('ink', 'Atrament', 'Ink', 0, 3);
mat('cloth', 'Płótno', 'Linen cloth', 0, 4);
mat('copper_bar', 'Sztabka miedzi', 'Copper bar', 0, 8, ['metal']);
mat('flour', 'Mąka jęczmienna', 'Barley flour', 0, 2);
mat('malt', 'Słód', 'Malt', 0, 2);
mat('glue', 'Klej kostny', 'Bone glue', 1, 3);
mat('pitch', 'Smoła', 'Pitch', 0, 3, ['fuel']);
mat('miner_notes', 'Notatki górnicze', 'Miner notes', 0, 6, ['research']);
mat('tin_bar', 'Sztabka cyny', 'Tin bar', 1, 9, ['metal']);
mat('bronze_bar', 'Sztabka brązu', 'Bronze bar', 1, 12, ['metal']);
mat('quicklime', 'Wapno palone', 'Quicklime', 1, 3);
mat('mortar', 'Zaprawa', 'Mortar', 1, 3, ['build']);
mat('nails', 'Gwoździe', 'Nails', 1, 1);
mat('copper_wire', 'Drut miedziany', 'Copper wire', 1, 4);
mat('fertilizer', 'Nawóz', 'Fertilizer', 1, 2);
mat('surveyor_charts', 'Mapy mierniczego', 'Surveyor charts', 1, 10, ['research']);
mat('coke', 'Koks', 'Coke', 2, 4, ['fuel']);
mat('iron_bar', 'Sztabka żelaza', 'Iron bar', 2, 14, ['metal']);
mat('steel_bar', 'Sztabka stali', 'Steel bar', 2, 22, ['metal']);
mat('lead_bar', 'Sztabka ołowiu', 'Lead bar', 2, 10, ['metal']);
mat('zinc_bar', 'Sztabka cynku', 'Zinc bar', 2, 11, ['metal']);
mat('brass_bar', 'Sztabka mosiądzu', 'Brass bar', 2, 16, ['metal']);
mat('glass', 'Szkło', 'Glass', 2, 6);
mat('gear', 'Zębatka', 'Gear', 2, 10);
mat('pipe', 'Rura', 'Pipe', 2, 8);
mat('iron_plate', 'Blacha żelazna', 'Iron plate', 2, 18);
mat('chain', 'Łańcuch', 'Chain', 2, 10);
mat('rail', 'Szyna', 'Rail', 2, 6);
mat('spring', 'Sprężyna', 'Spring', 2, 12);
mat('chitin_plate', 'Płytka chitynowa', 'Chitin plate', 2, 10);
mat('filter', 'Filtr węglowy', 'Charcoal filter', 2, 6);
mat('cured_fur', 'Futro wyprawione', 'Cured fur', 2, 10);
mat('engineer_plans', 'Plany inżyniera', 'Engineer plans', 2, 18, ['research']);
mat('fungal_board', 'Płyta grzybowa', 'Fungal board', 3, 4, ['build']);
mat('silk_cloth', 'Tkanina jedwabna', 'Silk cloth', 3, 14);
mat('silk_rope', 'Lina jedwabna', 'Silk rope', 3, 10);
mat('blasting_powder', 'Proch górniczy', 'Blasting powder', 3, 12);
mat('venom_extract', 'Ekstrakt jadu', 'Venom extract', 3, 10);
mat('spore_paste', 'Pasta zarodnikowa', 'Spore paste', 3, 8);
mat('silver_bar', 'Sztabka srebra', 'Silver bar', 3, 24, ['metal']);
mat('alchemy_codex', 'Kodeks alchemiczny', 'Alchemy codex', 3, 28, ['research']);
mat('fish_oil', 'Olej rybi', 'Fish oil', 4, 6, ['fuel']);
mat('nickel_bar', 'Sztabka niklu', 'Nickel bar', 4, 20, ['metal']);
mat('nickel_steel', 'Stal niklowa', 'Nickel steel', 4, 32, ['metal']);
mat('gold_bar', 'Sztabka złota', 'Gold bar', 4, 40, ['metal']);
mat('gasket', 'Uszczelka', 'Gasket', 4, 8);
mat('pressure_valve', 'Zawór ciśnieniowy', 'Pressure valve', 4, 20);
mat('piston', 'Tłok', 'Piston', 4, 30);
mat('hydraulic_treatise', 'Traktat hydrauliczny', 'Hydraulic treatise', 4, 40, ['research']);
mat('cobalt_bar', 'Sztabka kobaltu', 'Cobalt bar', 5, 30, ['metal']);
mat('cobalt_steel', 'Stal kobaltowa', 'Cobalt steel', 5, 50, ['metal']);
mat('lens', 'Soczewka', 'Lens', 5, 12);
mat('tempered_glass', 'Szkło hartowane', 'Tempered glass', 5, 16);
mat('cut_amethyst', 'Szlifowany ametyst', 'Cut amethyst', 5, 40);
mat('cut_sapphire', 'Szlifowany szafir', 'Cut sapphire', 5, 48);
mat('frost_core', 'Rdzeń mrozu', 'Frost core', 5, 45);
mat('insulated_padding', 'Ocieplina', 'Insulated padding', 5, 20);
mat('crystal_tablet', 'Kryształowa tabliczka', 'Crystal tablet', 5, 60, ['research']);
mat('cut_ruby', 'Szlifowany rubin', 'Cut ruby', 6, 56);
mat('emberbronze_bar', 'Sztabka brązu żarowego', 'Emberbronze bar', 6, 60, ['metal']);
mat('obsidian_edge', 'Ostrze obsydianowe', 'Obsidian edge', 6, 24);
mat('fire_essence', 'Esencja ognia', 'Fire essence', 6, 30);
mat('scale_leather', 'Skóra łuskowa', 'Scale leather', 6, 40);
mat('heat_exchanger', 'Wymiennik ciepła', 'Heat exchanger', 6, 70);
mat('ember_codex', 'Ognisty kodeks', 'Ember codex', 6, 80, ['research']);
mat('adamant_bar', 'Sztabka adamantu', 'Adamant bar', 7, 110, ['metal']);
mat('glimmersteel_bar', 'Sztabka lśnitstali', 'Glimmersteel bar', 7, 140, ['metal']);
mat('rune_ink', 'Atrament runiczny', 'Rune ink', 7, 40);
mat('rune_tablet', 'Tablica runiczna', 'Rune tablet', 7, 70);
mat('ether_essence', 'Esencja eteryczna', 'Ether essence', 7, 50);
mat('clockwork', 'Mechanizm zegarowy', 'Clockwork', 7, 80);
mat('rune_tome', 'Księga run', 'Rune tome', 7, 120, ['research']);
mat('heart_key', 'Klucz Serca', 'Key of the Heart', 8, 500, ['quest']);

// ------------------------------------------------------------- items
// picks (tier gates which rock can be dug)
item('flint_pick', 'Kilof krzemienny', 'Flint pick', 0, 4, 'pick', { pickTier: 1, workSpeed: 0.8, durability: 120 });
item('copper_pick', 'Kilof miedziany', 'Copper pick', 0, 12, 'pick', { pickTier: 1, workSpeed: 1.0, durability: 260 });
item('bronze_pick', 'Kilof brązowy', 'Bronze pick', 1, 24, 'pick', { pickTier: 2, workSpeed: 1.15, durability: 420 });
item('iron_pick', 'Kilof żelazny', 'Iron pick', 2, 36, 'pick', { pickTier: 2, workSpeed: 1.35, durability: 600 });
item('steel_pick', 'Kilof stalowy', 'Steel pick', 2, 56, 'pick', { pickTier: 3, workSpeed: 1.6, durability: 900 });
item('cobalt_pick', 'Kilof kobaltowy', 'Cobalt pick', 5, 110, 'pick', { pickTier: 4, workSpeed: 1.95, durability: 1300 });
item('ember_pick', 'Kilof żarowy', 'Ember pick', 6, 150, 'pick', { pickTier: 4, workSpeed: 2.35, durability: 1600 });
item('adamant_pick', 'Kilof adamantowy', 'Adamant pick', 7, 240, 'pick', { pickTier: 5, workSpeed: 2.8, durability: 2400 });
item('glimmer_pick', 'Lśniący kilof', 'Glimmering pick', 7, 400, 'pick', { pickTier: 5, workSpeed: 3.4, light: 3, durability: 4000 });
// tools
item('stone_axe', 'Kamienna siekiera', 'Stone hatchet', 0, 3, 'tool', { workSpeed: 0.9 }, ['axe']);
item('bronze_hatchet', 'Brązowa siekiera', 'Bronze hatchet', 1, 18, 'tool', { workSpeed: 1.3 }, ['axe']);
item('steel_felling_axe', 'Stalowy topór drwala', 'Steel felling axe', 2, 40, 'tool', { workSpeed: 1.8 }, ['axe']);
item('bronze_mallet', 'Brązowy młot budowniczego', 'Bronze builder mallet', 1, 20, 'tool', { workSpeed: 1.25 }, ['build']);
item('steel_mallet', 'Stalowy młot budowniczego', 'Steel builder mallet', 2, 44, 'tool', { workSpeed: 1.6 }, ['build']);
item('copper_rod', 'Miedziana różdżka', 'Copper dowsing rod', 1, 16, 'tool', { light: 0 }, ['prospect', 'r4']);
item('brass_probe', 'Mosiężna sonda', 'Brass probe', 2, 40, 'tool', {}, ['prospect', 'r7']);
item('crystal_seeker', 'Kryształowy wykrywacz', 'Crystal seeker', 5, 120, 'tool', {}, ['prospect', 'r12']);
item('fishing_rod', 'Wędka z jedwabną żyłką', 'Silk-line fishing rod', 4, 14, 'tool', {}, ['fishing']);
item('climbing_rope', 'Lina z hakiem', 'Grappling rope', 0, 10, 'back', { workSpeed: 1.2 }, ['climb']);
item('steel_crampons', 'Stalowe raki', 'Steel crampons', 2, 30, 'feet', { workSpeed: 1.4, armor: 1 }, ['climb']);
item('leather_pack', 'Skórzany plecak', 'Leather pack', 0, 14, 'back', { carry: 2 });
item('framed_pack', 'Plecak z ramą', 'Framed pack', 2, 36, 'back', { carry: 4 });
item('steam_harness', 'Nosidło parowe', 'Steam harness', 4, 120, 'back', { carry: 7 });
// lights
item('hand_lantern', 'Kaganek', 'Tallow lantern', 0, 6, 'gear', { light: 3 }, ['light']);
item('oil_lantern', 'Latarnia smolna', 'Pitch lantern', 1, 18, 'gear', { light: 5 }, ['light']);
item('crystal_lamp', 'Lampa kryształowa', 'Crystal lamp', 5, 90, 'gear', { light: 8 }, ['light']);
item('glimmer_lamp', 'Lampa lśnitowa', 'Glimmer lamp', 7, 220, 'gear', { light: 11, dreadRes: 0.3 }, ['light']);
// weapons
item('copper_axe', 'Miedziany topór bojowy', 'Copper war axe', 0, 14, 'weapon', { damage: 8 });
item('bronze_axe', 'Brązowy topór bojowy', 'Bronze war axe', 1, 26, 'weapon', { damage: 11 });
item('steel_axe', 'Stalowy topór bojowy', 'Steel war axe', 2, 60, 'weapon', { damage: 16 });
item('cobalt_axe', 'Kobaltowy topór bojowy', 'Cobalt war axe', 5, 130, 'weapon', { damage: 26 });
item('adamant_axe', 'Adamantowy topór bojowy', 'Adamant war axe', 7, 280, 'weapon', { damage: 40 });
item('iron_warhammer', 'Żelazny młot bojowy', 'Iron warhammer', 2, 50, 'weapon', { damage: 14 }, ['crush']);
item('ember_maul', 'Żarowy młot', 'Ember maul', 6, 190, 'weapon', { damage: 30 }, ['crush', 'fire']);
item('runic_hammer', 'Runiczny młot', 'Runic hammer', 7, 320, 'weapon', { damage: 38 }, ['crush', 'rune']);
item('hunting_spear', 'Włócznia myśliwska', 'Hunting spear', 0, 8, 'weapon', { damage: 7 }, ['reach']);
item('obsidian_spear', 'Włócznia obsydianowa', 'Obsidian spear', 6, 120, 'weapon', { damage: 24 }, ['reach']);
item('wooden_crossbow', 'Kusza drewniana', 'Wooden crossbow', 1, 30, 'weapon', { damage: 9 }, ['ranged']);
item('steel_crossbow', 'Kusza stalowa', 'Steel crossbow', 2, 70, 'weapon', { damage: 15 }, ['ranged']);
item('repeating_crossbow', 'Kusza powtarzalna', 'Repeating crossbow', 4, 160, 'weapon', { damage: 13 }, ['ranged', 'rapid']);
item('bolts', 'Bełty', 'Bolts', 1, 1, 'ammo', { damage: 1 });
item('piercing_bolts', 'Bełty przebijające', 'Piercing bolts', 2, 3, 'ammo', { damage: 4 });
item('fire_bolts', 'Bełty ogniste', 'Fire bolts', 6, 6, 'ammo', { damage: 8 }, ['fire']);
item('wooden_shield', 'Tarcza drewniana', 'Wooden shield', 0, 8, 'offhand', { armor: 3 });
item('steel_shield', 'Tarcza stalowa', 'Steel shield', 2, 48, 'offhand', { armor: 7 });
item('rune_shield', 'Tarcza runiczna', 'Rune shield', 7, 260, 'offhand', { armor: 14, dreadRes: 0.2 });
// armour
item('leather_hood', 'Skórzany kaptur', 'Leather hood', 0, 8, 'head', { armor: 1 });
item('bronze_helm', 'Hełm brązowy', 'Bronze helm', 1, 30, 'head', { armor: 3 });
item('steel_helm', 'Hełm stalowy', 'Steel helm', 2, 60, 'head', { armor: 5 });
item('adamant_helm', 'Hełm adamantowy', 'Adamant helm', 7, 240, 'head', { armor: 10 });
item('leather_jerkin', 'Skórznia', 'Leather jerkin', 0, 14, 'body', { armor: 2 });
item('chitin_vest', 'Kamizela chitynowa', 'Chitin vest', 2, 44, 'body', { armor: 4, gasRes: 0.1 }, ['antipoison']);
item('chainmail', 'Kolczuga', 'Chainmail', 2, 70, 'body', { armor: 6 });
item('plate_armor', 'Zbroja płytowa', 'Plate armour', 4, 150, 'body', { armor: 10 });
item('adamant_armor', 'Zbroja adamantowa', 'Adamant armour', 7, 360, 'body', { armor: 18 });
item('leather_boots', 'Skórzane buty', 'Leather boots', 0, 8, 'feet', { armor: 1 });
item('hobnailed_boots', 'Okute buty', 'Hobnailed boots', 2, 26, 'feet', { armor: 2, workSpeed: 1.05 });
item('leather_gloves', 'Skórzane rękawice', 'Leather gloves', 0, 8, 'hands', { workSpeed: 1.05 });
item('smith_gloves', 'Rękawice kowalskie', 'Smith gloves', 2, 30, 'hands', { workSpeed: 1.1, heatRes: 0.15 });
// environmental gear (each biome asks for something new)
item('filter_mask', 'Maska z filtrem', 'Filter mask', 2, 40, 'head', { gasRes: 0.7 });
item('crystal_filter_mask', 'Maska z kryształowym filtrem', 'Crystal filter mask', 5, 130, 'head', { gasRes: 0.95 });
item('eelskin_suit', 'Strój ze skóry węgorza', 'Eelskin suit', 4, 90, 'body', { waterRes: 0.5, armor: 2 });
item('diving_helmet', 'Hełm nurka', 'Diving helmet', 4, 140, 'head', { waterRes: 1, armor: 3 });
item('fur_cloak', 'Futrzany płaszcz', 'Fur cloak', 2, 40, 'back', { coldRes: 0.5 });
item('padded_coat', 'Ocieplany kubrak', 'Padded coat', 5, 110, 'body', { coldRes: 0.9, armor: 3 });
item('frostcore_armor', 'Pancerz z rdzeniem mrozu', 'Frost-core armour', 5, 220, 'body', { heatRes: 0.8, armor: 6 });
item('scale_robe', 'Szata z łuski salamandry', 'Salamander robe', 6, 200, 'body', { heatRes: 0.95, armor: 5 });
item('rune_cloak', 'Płaszcz run', 'Rune cloak', 7, 260, 'back', { dreadRes: 0.6 });
// consumables
item('ration', 'Racja podróżna', 'Travel ration', 0, 3, 'consumable', { food: 35 }, ['food']);
item('bread', 'Chleb jęczmienny', 'Barley bread', 0, 4, 'consumable', { food: 45 }, ['food']);
item('roast', 'Pieczeń', 'Roast', 0, 6, 'consumable', { food: 60, mood: 4 }, ['food']);
item('mushroom_stew', 'Gulasz grzybowy', 'Mushroom stew', 3, 7, 'consumable', { food: 70, mood: 3 }, ['food']);
item('fish_pie', 'Pasztet rybny', 'Fish pie', 4, 9, 'consumable', { food: 80, mood: 5 }, ['food']);
item('feast_platter', 'Krasnoludzka uczta', 'Dwarven feast', 5, 20, 'consumable', { food: 100, mood: 12 }, ['food']);
item('ale', 'Piwo', 'Ale', 0, 4, 'consumable', { drink: 50, mood: 3 }, ['drink']);
item('berry_mead', 'Miód jagodowy', 'Berry mead', 1, 7, 'consumable', { drink: 50, mood: 6 }, ['drink']);
item('dark_stout', 'Ciemny stout grzybowy', 'Dark mushroom stout', 3, 10, 'consumable', { drink: 60, mood: 9 }, ['drink']);
item('bandage', 'Bandaż', 'Bandage', 0, 2, 'consumable', { heal: 15 });
item('healing_draught', 'Napój leczniczy', 'Healing draught', 1, 10, 'consumable', { heal: 45 });
item('antidote', 'Antidotum', 'Antidote', 3, 14, 'consumable', { heal: 10 }, ['antipoison']);
item('nightsight_tonic', 'Tonik nocnego wzroku', 'Nightsight tonic', 3, 16, 'consumable', { light: 4, duration: 240 });
item('warming_draught', 'Napój rozgrzewający', 'Warming draught', 5, 18, 'consumable', { coldRes: 0.6, duration: 300 });
item('fire_ward_potion', 'Mikstura ognioodporności', 'Fire ward potion', 6, 30, 'consumable', { heatRes: 0.6, duration: 300 });
item('blasting_charge', 'Ładunek górniczy', 'Blasting charge', 3, 20, 'consumable', { damage: 60 }, ['explosive']);
item('fire_bomb', 'Bomba ogniowa', 'Fire bomb', 6, 40, 'consumable', { damage: 90 }, ['explosive', 'fire']);
// trinkets
item('silver_ring', 'Srebrny pierścień', 'Silver ring', 3, 60, 'trinket', { mood: 5 });
item('pearl_brooch', 'Broszka z perłą', 'Pearl brooch', 4, 80, 'trinket', { mood: 8 });
item('sapphire_amulet', 'Amulet szafirowy', 'Sapphire amulet', 5, 140, 'trinket', { coldRes: 0.3 });
item('amethyst_talisman', 'Talizman ametystowy', 'Amethyst talisman', 5, 150, 'trinket', { dreadRes: 0.3 });
item('ruby_amulet', 'Amulet rubinowy', 'Ruby amulet', 6, 170, 'trinket', { heatRes: 0.3 });
item('glimmer_amulet', 'Amulet lśnitu', 'Glimmer amulet', 7, 300, 'trinket', { dreadRes: 0.6, light: 2 });

export const RESOURCES: readonly Resource[] = R;
export const RES = new Map(R.map((r) => [r.id, r]));

/** Known from the very first minute (visible in the codex, unlock T0 research). */
export const START_DISCOVERED: readonly string[] = ['wood', 'stone', 'fiber', 'berries', 'clay', 'resin', 'grain', 'sand'];
