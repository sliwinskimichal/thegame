/**
 * Production recipes. Recipe id = output id unless an alternative recipe
 * exists (suffix). Times are work-seconds for an average dwarf at level-1
 * speed; buildings multiply speed, machines need power.
 */
import type { Recipe, Stack } from './types';

const R: Recipe[] = [];
type Lvl = 1 | 2 | 3;
const s = (id: string, n = 1): Stack => ({ id, n });
function r(id: string, at: string, level: Lvl, inputs: Stack[], outputs: Stack[], time: number, power?: number): void {
  R.push({ id, at, level, inputs, outputs, time, power });
}
/** Shorthand for a single-output recipe whose id is the output id. */
function make(out: string, n: number, at: string, level: Lvl, inputs: Stack[], time: number, power?: number): void {
  r(out, at, level, inputs, [s(out, n)], time, power);
}

// ------------------------------------------------------------- carpentry
make('plank', 2, 'carpentry', 1, [s('wood')], 4);
make('beam', 1, 'carpentry', 1, [s('wood', 2)], 6);
make('flint_pick', 1, 'carpentry', 1, [s('wood'), s('stone', 3), s('fiber')], 10);
make('stone_axe', 1, 'carpentry', 1, [s('wood'), s('stone', 2), s('fiber')], 8);
make('hunting_spear', 1, 'carpentry', 1, [s('wood', 2), s('stone'), s('fiber')], 8);
make('wooden_shield', 1, 'carpentry', 1, [s('plank', 4), s('hide')], 10);
make('wooden_crossbow', 1, 'carpentry', 2, [s('plank', 3), s('rope', 2), s('bronze_bar')], 20);
make('fungal_board', 3, 'carpentry', 2, [s('mushroom_timber', 2)], 6);
r('plank_bulk', 'carpentry', 3, [s('wood', 4)], [s('plank', 10)], 8, 4);
r('fungal_board_bulk', 'carpentry', 3, [s('mushroom_timber', 4)], [s('fungal_board', 8)], 8, 4);

// --------------------------------------------------------------- masonry
make('stone_block', 1, 'masonry', 1, [s('stone', 2)], 6);
make('mortar', 3, 'masonry', 1, [s('quicklime'), s('sand', 2)], 6);
make('obsidian_edge', 2, 'masonry', 3, [s('obsidian')], 16, 3);
make('rune_tablet', 1, 'masonry', 3, [s('runestone'), s('rune_ink')], 30, 3);
r('stone_block_bulk', 'masonry', 3, [s('stone', 6)], [s('stone_block', 4)], 10, 3);

// ------------------------------------------------------------------ kiln
make('charcoal', 1, 'kiln', 1, [s('wood', 2)], 10);
make('brick', 4, 'kiln', 1, [s('clay', 2), s('charcoal')], 12);
make('pitch', 1, 'kiln', 1, [s('resin', 2)], 8);
make('quicklime', 2, 'kiln', 2, [s('limestone', 2), s('coal')], 12);
make('coke', 1, 'kiln', 2, [s('coal', 2)], 12);
make('glass', 2, 'kiln', 2, [s('sand', 2), s('quicklime'), s('coal')], 14);
r('glass_quartz', 'kiln', 2, [s('quartz'), s('coal')], [s('glass', 2)], 12);
make('tempered_glass', 1, 'kiln', 3, [s('glass', 2), s('quicklime'), s('coke')], 20, 3);

// --------------------------------------------------------------- smelter
make('copper_bar', 1, 'smelter', 1, [s('copper_ore', 2), s('charcoal')], 16);
r('copper_bar_coal', 'smelter', 1, [s('copper_ore', 2), s('coal')], [s('copper_bar')], 14);
make('tin_bar', 1, 'smelter', 1, [s('tin_ore', 2), s('coal')], 16);
make('bronze_bar', 4, 'smelter', 1, [s('copper_bar', 3), s('tin_bar')], 20);
make('lead_bar', 1, 'smelter', 1, [s('lead_ore', 2), s('coal')], 16);
make('iron_bar', 1, 'smelter', 2, [s('iron_ore', 2), s('coke')], 20, 2);
make('steel_bar', 1, 'smelter', 2, [s('iron_bar', 2), s('coke')], 28, 2);
make('zinc_bar', 1, 'smelter', 2, [s('zinc_ore', 2), s('coke')], 18, 2);
make('brass_bar', 3, 'smelter', 2, [s('copper_bar', 2), s('zinc_bar')], 20, 2);
make('silver_bar', 1, 'smelter', 2, [s('silver_ore', 2), s('coke')], 22, 2);
make('nickel_bar', 1, 'smelter', 2, [s('nickel_ore', 2), s('coke')], 24, 2);
make('nickel_steel', 2, 'smelter', 2, [s('steel_bar', 2), s('nickel_bar')], 30, 2);
make('gold_bar', 1, 'smelter', 2, [s('gold_ore', 2), s('coke')], 26, 2);
make('cobalt_bar', 1, 'smelter', 2, [s('cobalt_ore', 2), s('coke', 2)], 32, 3);
make('cobalt_steel', 2, 'smelter', 2, [s('steel_bar', 2), s('cobalt_bar')], 36, 3);
make('emberbronze_bar', 2, 'smelter', 3, [s('bronze_bar', 2), s('emberite_ore')], 36, 6);
make('adamant_bar', 1, 'smelter', 3, [s('adamantite_ore', 3), s('magma_core')], 60, 6);
make('glimmersteel_bar', 1, 'smelter', 3, [s('glimmerite_ore', 2), s('steel_bar'), s('ether_essence')], 70, 6);

// ----------------------------------------------------------------- forge
make('copper_pick', 1, 'forge', 1, [s('copper_bar', 3), s('wood')], 20);
make('copper_axe', 1, 'forge', 1, [s('copper_bar', 3), s('wood')], 20);
make('nails', 10, 'forge', 1, [s('copper_bar')], 6);
make('copper_wire', 3, 'forge', 1, [s('copper_bar')], 8);
make('bronze_pick', 1, 'forge', 1, [s('bronze_bar', 3), s('wood')], 24);
make('bronze_axe', 1, 'forge', 1, [s('bronze_bar', 3), s('wood')], 24);
make('bronze_hatchet', 1, 'forge', 1, [s('bronze_bar', 2), s('wood')], 18);
make('bronze_mallet', 1, 'forge', 1, [s('bronze_bar', 2), s('wood')], 18);
make('bronze_helm', 1, 'forge', 1, [s('bronze_bar', 3), s('leather')], 24);
make('bolts', 10, 'forge', 1, [s('wood'), s('copper_bar'), s('feather')], 10);
make('iron_pick', 1, 'forge', 2, [s('iron_bar', 3), s('plank')], 28);
make('steel_pick', 1, 'forge', 2, [s('steel_bar', 3), s('plank')], 32);
make('steel_felling_axe', 1, 'forge', 2, [s('steel_bar', 2), s('plank')], 26);
make('steel_mallet', 1, 'forge', 2, [s('steel_bar', 2), s('plank')], 26);
make('steel_axe', 1, 'forge', 2, [s('steel_bar', 3), s('leather')], 30);
make('iron_warhammer', 1, 'forge', 2, [s('iron_bar', 4), s('plank')], 28);
make('steel_shield', 1, 'forge', 2, [s('steel_bar', 3), s('plank', 2)], 28);
make('steel_helm', 1, 'forge', 2, [s('steel_bar', 3), s('leather')], 30);
make('chainmail', 1, 'forge', 2, [s('chain', 6), s('leather', 2)], 40);
make('iron_plate', 1, 'forge', 2, [s('iron_bar', 2)], 14);
make('chain', 2, 'forge', 2, [s('iron_bar')], 10);
make('rail', 4, 'forge', 2, [s('iron_bar'), s('beam')], 12);
make('piercing_bolts', 10, 'forge', 2, [s('steel_bar'), s('plank'), s('feather')], 14);
make('steel_crossbow', 1, 'forge', 2, [s('steel_bar', 2), s('plank', 2), s('spring'), s('rope')], 34);
make('hobnailed_boots', 1, 'forge', 2, [s('leather', 2), s('nails', 10)], 16);
make('steel_crampons', 1, 'forge', 2, [s('steel_bar', 2), s('leather')], 20);
make('plate_armor', 1, 'forge', 2, [s('nickel_steel', 4), s('leather', 2), s('iron_plate', 2)], 60);
make('cobalt_pick', 1, 'forge', 3, [s('cobalt_steel', 3), s('plank')], 40);
make('cobalt_axe', 1, 'forge', 3, [s('cobalt_steel', 3), s('leather')], 40);
make('ember_pick', 1, 'forge', 3, [s('emberbronze_bar', 3), s('fungal_board')], 44);
make('ember_maul', 1, 'forge', 3, [s('emberbronze_bar', 4), s('fire_essence')], 48);
make('obsidian_spear', 1, 'forge', 3, [s('obsidian_edge', 2), s('fungal_board', 2), s('silk_rope')], 36);
make('fire_bolts', 10, 'forge', 3, [s('bolts', 10), s('fire_essence')], 16);
make('adamant_pick', 1, 'forge', 3, [s('adamant_bar', 3), s('fungal_board')], 60);
make('adamant_axe', 1, 'forge', 3, [s('adamant_bar', 3), s('scale_leather')], 60);
make('adamant_helm', 1, 'forge', 3, [s('adamant_bar', 3), s('insulated_padding')], 60);
make('adamant_armor', 1, 'forge', 3, [s('adamant_bar', 6), s('scale_leather', 2)], 90);
make('runic_hammer', 1, 'forge', 3, [s('adamant_bar', 3), s('rune_tablet')], 70);
make('rune_shield', 1, 'forge', 3, [s('adamant_bar', 2), s('rune_tablet'), s('fungal_board', 2)], 60);
make('glimmer_pick', 1, 'forge', 3, [s('glimmersteel_bar', 3), s('adamant_bar')], 90);

// -------------------------------------------------------------- workshop
make('rope', 1, 'workshop', 1, [s('fiber', 3)], 6);
make('leather', 1, 'workshop', 1, [s('hide'), s('resin')], 14);
make('parchment', 2, 'workshop', 1, [s('hide')], 10);
make('cloth', 1, 'workshop', 1, [s('fiber', 3)], 10);
make('ink', 2, 'workshop', 1, [s('charcoal'), s('resin')], 6);
make('leather_hood', 1, 'workshop', 1, [s('leather', 2)], 10);
make('leather_jerkin', 1, 'workshop', 1, [s('leather', 3), s('rope')], 16);
make('leather_boots', 1, 'workshop', 1, [s('leather', 2)], 10);
make('leather_gloves', 1, 'workshop', 1, [s('leather')], 8);
make('leather_pack', 1, 'workshop', 1, [s('leather', 3), s('rope', 2)], 16);
make('climbing_rope', 1, 'workshop', 1, [s('rope', 3), s('copper_bar')], 12);
make('hand_lantern', 1, 'workshop', 1, [s('copper_bar'), s('resin', 2)], 10);
make('oil_lantern', 1, 'workshop', 1, [s('bronze_bar'), s('pitch', 2)], 14);
make('bandage', 2, 'workshop', 1, [s('cloth')], 6);
make('copper_rod', 1, 'workshop', 1, [s('copper_wire', 3), s('wood')], 12);
make('gear', 2, 'workshop', 2, [s('brass_bar')], 12);
r('gear_iron', 'workshop', 2, [s('iron_bar')], [s('gear')], 12);
make('pipe', 2, 'workshop', 2, [s('lead_bar')], 10);
make('spring', 2, 'workshop', 2, [s('steel_bar')], 12);
make('chitin_plate', 1, 'workshop', 2, [s('chitin', 3), s('glue')], 14);
make('chitin_vest', 1, 'workshop', 2, [s('chitin_plate', 3), s('leather')], 24);
make('smith_gloves', 1, 'workshop', 2, [s('leather', 2), s('chitin_plate')], 14);
make('filter', 2, 'workshop', 2, [s('charcoal', 2), s('cloth')], 10);
make('filter_mask', 1, 'workshop', 2, [s('leather', 2), s('filter', 2), s('brass_bar'), s('glass')], 24);
make('cured_fur', 1, 'workshop', 2, [s('fur'), s('quicklime')], 12);
make('fur_cloak', 1, 'workshop', 2, [s('cured_fur', 3), s('leather')], 20);
make('framed_pack', 1, 'workshop', 2, [s('leather', 3), s('iron_bar', 2), s('rope', 2)], 24);
make('brass_probe', 1, 'workshop', 2, [s('brass_bar', 3), s('glass'), s('copper_wire', 2), s('crawler_acid')], 26);
make('silk_cloth', 1, 'workshop', 2, [s('spider_silk', 3)], 12);
make('silk_rope', 1, 'workshop', 2, [s('spider_silk', 2)], 8);
make('gasket', 4, 'workshop', 2, [s('eel_skin'), s('slime')], 12);
make('pressure_valve', 1, 'workshop', 2, [s('brass_bar'), s('gasket')], 16);
make('eelskin_suit', 1, 'workshop', 2, [s('eel_skin', 4), s('gasket', 2), s('silk_cloth', 2)], 40);
make('diving_helmet', 1, 'workshop', 2, [s('brass_bar', 3), s('glass', 2), s('gasket', 2), s('pressure_valve')], 44);
make('fishing_rod', 1, 'workshop', 2, [s('bone'), s('silk_rope')], 10);
make('insulated_padding', 1, 'workshop', 2, [s('cured_fur', 2), s('silk_cloth')], 16);
make('padded_coat', 1, 'workshop', 2, [s('insulated_padding', 2), s('troll_hide'), s('leather')], 30);
make('piston', 1, 'workshop', 3, [s('nickel_steel'), s('gasket', 2), s('fish_oil')], 24, 6);
make('steam_harness', 1, 'workshop', 3, [s('piston'), s('nickel_steel', 2), s('leather', 2)], 40, 6);
make('repeating_crossbow', 1, 'workshop', 3, [s('steel_bar', 3), s('spring', 4), s('gear', 3)], 50, 6);
make('frostcore_armor', 1, 'workshop', 3, [s('frost_core', 2), s('nickel_steel', 4), s('insulated_padding')], 70, 6);
make('heat_exchanger', 1, 'workshop', 3, [s('nickel_steel', 3), s('frost_core'), s('pipe', 4)], 50, 6);
make('scale_leather', 1, 'workshop', 3, [s('salamander_scale', 3), s('leather')], 24, 6);
make('scale_robe', 1, 'workshop', 3, [s('scale_leather', 3), s('silk_cloth', 2)], 50, 6);
make('clockwork', 1, 'workshop', 3, [s('ancient_cog'), s('brass_bar', 2), s('spring', 2)], 60, 6);
make('rune_cloak', 1, 'workshop', 3, [s('silk_cloth', 3), s('rune_ink', 2), s('ether_essence')], 60, 6);

// --------------------------------------------------------------- alchemy
make('glue', 1, 'alchemy', 1, [s('bone', 2)], 8);
make('fertilizer', 2, 'alchemy', 1, [s('guano', 2)], 8);
make('healing_draught', 1, 'alchemy', 1, [s('moss', 2), s('berries', 2)], 14);
make('blasting_powder', 2, 'alchemy', 2, [s('saltpeter', 2), s('sulfur'), s('charcoal')], 18);
make('venom_extract', 2, 'alchemy', 2, [s('venom_sac')], 12);
make('spore_paste', 2, 'alchemy', 2, [s('glow_spores', 3), s('slime')], 12);
make('antidote', 2, 'alchemy', 2, [s('venom_extract'), s('moss', 2)], 16);
make('nightsight_tonic', 1, 'alchemy', 2, [s('spore_paste'), s('bat_wing')], 14);
make('blasting_charge', 1, 'alchemy', 2, [s('blasting_powder', 2), s('cloth'), s('rope')], 16);
make('fish_oil', 1, 'alchemy', 2, [s('cave_fish', 2)], 10);
make('warming_draught', 1, 'alchemy', 2, [s('troll_fat'), s('spore_paste')], 16);
make('frost_core', 1, 'alchemy', 2, [s('frost_crystal', 3), s('frost_moth_dust')], 30);
make('fire_essence', 1, 'alchemy', 3, [s('fire_gland', 2)], 24, 2);
make('fire_ward_potion', 1, 'alchemy', 3, [s('fire_essence'), s('salamander_scale')], 20, 2);
make('fire_bomb', 1, 'alchemy', 3, [s('blasting_powder', 2), s('fire_essence'), s('obsidian')], 24, 2);
make('ether_essence', 1, 'alchemy', 3, [s('ectoplasm', 2)], 30, 2);
make('rune_ink', 2, 'alchemy', 3, [s('rune_dust', 2), s('ink')], 24, 2);

// --------------------------------------------------------------- kitchen
make('ration', 2, 'kitchen', 1, [s('berries', 2), s('raw_meat')], 10);
make('flour', 1, 'kitchen', 1, [s('grain', 2)], 6);
make('bread', 2, 'kitchen', 1, [s('flour', 2)], 12);
make('roast', 1, 'kitchen', 1, [s('raw_meat', 2)], 12);
make('mushroom_stew', 2, 'kitchen', 2, [s('mushroom', 3), s('raw_meat')], 16);
make('fish_pie', 2, 'kitchen', 2, [s('cave_fish', 2), s('flour'), s('salt')], 18);
r('kelp_stew', 'kitchen', 2, [s('kelp', 3), s('salt')], [s('mushroom_stew', 1)], 14);
make('feast_platter', 3, 'kitchen', 3, [s('roast', 2), s('mushroom_stew', 2), s('fish_pie'), s('salt', 2)], 40);

// --------------------------------------------------------------- brewery
make('malt', 1, 'brewery', 1, [s('grain', 2)], 8);
make('ale', 3, 'brewery', 1, [s('malt', 2)], 20);
make('berry_mead', 2, 'brewery', 1, [s('berries', 4), s('malt')], 24);
make('dark_stout', 3, 'brewery', 3, [s('mushroom', 3), s('malt', 2), s('spore_paste')], 30);

// ------------------------------------------------------------------ farm
r('grain_field', 'farm', 1, [], [s('grain', 3)], 60);
r('berry_patch', 'farm', 1, [], [s('berries', 3)], 60);
r('mushroom_bed', 'farm', 2, [s('fertilizer')], [s('mushroom', 4)], 60);
r('glowcap_bed', 'farm', 2, [s('fertilizer')], [s('glow_spores', 2)], 60);
r('light_garden', 'farm', 3, [s('fertilizer')], [s('grain', 4), s('berries', 3)], 60);

// ------------------------------------------------------------- lore hall
make('miner_notes', 1, 'lore_hall', 1, [s('wood'), s('stone', 2), s('fiber')], 20);
make('surveyor_charts', 1, 'lore_hall', 1, [s('parchment', 2), s('ink'), s('coal'), s('limestone')], 30);
make('engineer_plans', 1, 'lore_hall', 1, [s('parchment', 2), s('ink', 2), s('bronze_bar'), s('iron_ore', 2)], 40);
make('alchemy_codex', 1, 'lore_hall', 2, [s('parchment', 2), s('glass'), s('venom_sac'), s('glow_spores', 2)], 50);
make('hydraulic_treatise', 1, 'lore_hall', 2, [s('parchment', 2), s('brass_bar'), s('pearl'), s('eel_skin')], 60);
make('crystal_tablet', 1, 'lore_hall', 2, [s('glass', 2), s('frost_crystal'), s('amethyst'), s('silver_bar')], 70);
make('ember_codex', 1, 'lore_hall', 3, [s('parchment', 2), s('tempered_glass'), s('obsidian', 2), s('ruby')], 80);
make('rune_tome', 1, 'lore_hall', 3, [s('parchment', 3), s('rune_dust', 2), s('runestone'), s('gold_bar')], 100);

// --------------------------------------------------------------- jeweler
make('lens', 1, 'jeweler', 1, [s('quartz', 2)], 20);
make('silver_ring', 1, 'jeweler', 2, [s('silver_bar', 2)], 30);
make('pearl_brooch', 1, 'jeweler', 2, [s('pearl'), s('silver_bar')], 30);
make('cut_amethyst', 1, 'jeweler', 2, [s('amethyst')], 30);
make('cut_sapphire', 1, 'jeweler', 2, [s('sapphire')], 34);
make('sapphire_amulet', 1, 'jeweler', 2, [s('cut_sapphire'), s('silver_bar')], 36);
make('amethyst_talisman', 1, 'jeweler', 2, [s('cut_amethyst'), s('gold_bar')], 36);
make('crystal_seeker', 1, 'jeweler', 2, [s('lens', 2), s('brass_bar', 2), s('cut_sapphire')], 40);
make('crystal_lamp', 1, 'jeweler', 2, [s('lens'), s('golem_shard', 2), s('brass_bar')], 30);
make('crystal_filter_mask', 1, 'jeweler', 2, [s('lens'), s('frost_moth_dust', 2), s('leather', 2), s('brass_bar')], 36);
make('cut_ruby', 1, 'jeweler', 3, [s('ruby')], 40);
make('ruby_amulet', 1, 'jeweler', 3, [s('cut_ruby'), s('gold_bar')], 40);
make('glimmer_amulet', 1, 'jeweler', 3, [s('glimmersteel_bar'), s('cut_amethyst'), s('rune_ink')], 60);
make('glimmer_lamp', 1, 'jeweler', 3, [s('glimmersteel_bar'), s('lens', 2), s('gold_bar')], 50);

// ---------------------------------------------------------------- hearth
make('heart_key', 1, 'hearth', 3, [s('glimmersteel_bar', 4), s('adamant_bar', 4), s('relic', 3), s('guardian_sigil'), s('crystal_heart')], 300);

export const RECIPES: readonly Recipe[] = R;

export const START_RECIPES: readonly string[] = [
  'plank', 'beam', 'flint_pick', 'stone_axe', 'hunting_spear', 'wooden_shield', 'grain_field', 'berry_patch', 'miner_notes',
];
