/**
 * The research tree. Each node is shown as "???" (but counted, so the player
 * sees how much is still hidden) until one of its `revealBy` resources is
 * discovered. Research consumes packs written in the Lore Hall; every new
 * pack needs samples from the newest biome, so research pulls the colony
 * deeper. One boss trophy gates a keystone node in each tier.
 */
import type { Stack, TechNode } from './types';

const PACKS = [
  'miner_notes', 'surveyor_charts', 'engineer_plans', 'alchemy_codex',
  'hydraulic_treatise', 'crystal_tablet', 'ember_codex', 'rune_tome',
] as const;
export const RESEARCH_PACKS: readonly string[] = PACKS;

/** Pack cost curve (tuned by the balance simulator, see docs/BALANCE.md). */
export interface PackCurve {
  base: number;
  growth: number;
  prevShare: number;
  /** Multiplier for tiers 0-1 (the settling phase right after the tutorial). */
  early?: number;
}
/** Chosen by the curve tournament (docs/BALANCE.md): base 7, growth 1.33, early 0.6. */
export const PACK_CURVE: PackCurve = { base: 7, growth: 1.33, prevShare: 0.6, early: 0.6 };

/** Research cost of a node of `tier` and relative `size` (1 small .. 3 keystone). */
export function packCost(tier: number, size: number, curve: PackCurve = PACK_CURVE): Stack[] {
  const early = tier <= 1 ? (curve.early ?? 1) : 1;
  const main = Math.max(1, Math.round(curve.base * size * Math.pow(curve.growth, tier) * early));
  const out: Stack[] = [{ id: PACKS[tier]!, n: main }];
  if (tier > 0 && curve.prevShare > 0) out.push({ id: PACKS[tier - 1]!, n: Math.max(1, Math.round(main * curve.prevShare)) });
  return out;
}

type U = TechNode['unlocks'];
const T: TechNode[] = [];
function node(
  id: string, tier: number, size: number, namePl: string, nameEn: string, descPl: string,
  requires: string[], revealBy: string[], unlocks: U, extra: Stack[] = [],
): void {
  T.push({ id, tier, size, namePl, nameEn, descPl, cost: [...packCost(tier, size), ...extra], requires, revealBy, unlocks });
}
const B = (id: string, l: 1 | 2 | 3) => [id, l] as const;

// ===================================================== T0 — Podgórze
node('campcraft', 0, 1, 'Rzemiosło obozowe', 'Campcraft', 'Liny, płótno i bandaże z włókna roślinnego.', [], [], { buildings: [B('workshop', 1)], recipes: ['rope', 'cloth', 'bandage'] });
node('stonecutting', 0, 1, 'Kamieniarstwo', 'Stonecutting', 'Ciosanie kamienia w bloki.', [], [], { buildings: [B('masonry', 1)], recipes: ['stone_block'] });
node('kiln_firing', 0, 1, 'Wypał w glinie', 'Kiln firing', 'Węgiel drzewny, cegły i smoła z prostego pieca.', [], ['clay'], { buildings: [B('kiln', 1)], recipes: ['charcoal', 'brick', 'pitch'] });
node('hunting', 0, 1, 'Łowiectwo', 'Hunting', 'Garbowanie skór i pierwsze ubrania.', ['campcraft'], ['hide'], { recipes: ['leather', 'leather_hood', 'leather_jerkin', 'leather_boots', 'leather_gloves', 'leather_pack'] }, [{ id: 'fang', n: 2 }]);
node('scribing', 0, 1, 'Pismo', 'Scribing', 'Pergamin i atrament — wiedza, która przetrwa krasnoluda.', ['campcraft'], ['hide'], { recipes: ['parchment', 'ink'] });
node('cooking', 0, 1, 'Gotowanie', 'Cooking', 'Racje, pieczenie i chleb.', [], ['grain', 'raw_meat'], { buildings: [B('kitchen', 1)], recipes: ['ration', 'roast', 'flour', 'bread'] });
node('brewing', 0, 1, 'Warzenie', 'Brewing', 'Słód i piwo — krasnoludzkie paliwo.', ['cooking'], ['grain'], { buildings: [B('brewery', 1)], recipes: ['malt', 'ale'] });
node('copper_smelting', 0, 2, 'Wytop miedzi', 'Copper smelting', 'Dymarka i pierwszy metal.', ['kiln_firing'], ['copper_ore'], { buildings: [B('smelter', 1)], recipes: ['copper_bar'] });
node('smithing', 0, 2, 'Kowalstwo', 'Smithing', 'Kowadło: miedziane kilofy i topory.', ['copper_smelting'], ['copper_ore'], { buildings: [B('forge', 1)], recipes: ['copper_pick', 'copper_axe'] });
node('lanterns', 0, 1, 'Kaganki', 'Lanterns', 'Przenośne światło i lina z hakiem.', ['smithing'], ['copper_ore'], { recipes: ['hand_lantern', 'climbing_rope'], infra: ['wooden_door'] });
node('ballista', 0, 2, 'Balista', 'Ballista', 'Pierwsza obrona przed nocą i goblinami.', ['smithing', 'campcraft'], ['copper_ore'], { buildings: [B('defense_tower', 1)] });
node('surveying', 0, 2, 'Miernictwo', 'Surveying', 'Mapy nowej warstwy z próbek węgla i wapienia — klucz do badań Wapiennych Progów.', ['scribing'], ['coal', 'limestone'], { recipes: ['surveyor_charts'] });

// ============================================ T1 — Wapienne Progi
node('stone_hearth', 1, 3, 'Kamienne Palenisko', 'Stone hearth', 'Gród przestaje być obozem. Wymaga trofeum Wilczego Herszta.', ['stonecutting', 'copper_smelting'], ['coal', 'limestone'], { buildings: [B('hearth', 2)] }, [{ id: 'alpha_pelt', n: 1 }]);
node('tin_smelting', 1, 1, 'Wytop cyny', 'Tin smelting', 'Cyna i wytop na węglu kamiennym.', ['copper_smelting'], ['tin_ore'], { recipes: ['tin_bar'] });
node('coal_working', 1, 1, 'Węgiel kamienny', 'Coal working', 'Kosze żarowe, zsypy i wytop na węglu.', ['copper_smelting'], ['coal'], { recipes: ['copper_bar_coal'], infra: ['brazier', 'chute'] });
node('bronze_age', 1, 3, 'Epoka brązu', 'Bronze age', 'Brąz: kilof, który kruszy granit.', ['tin_smelting', 'smithing'], ['tin_ore'], { recipes: ['bronze_bar', 'bronze_pick', 'bronze_axe', 'bronze_hatchet', 'bronze_mallet', 'bronze_helm'] });
node('lime_burning', 1, 2, 'Wypał wapna', 'Lime burning', 'Wapno palone i zaprawa; kamienne filary.', ['kiln_firing', 'stonecutting'], ['limestone'], { buildings: [B('kiln', 2)], recipes: ['quicklime', 'mortar'], infra: ['stone_pillar'] });
node('supports', 1, 1, 'Obudowa górnicza', 'Mine supports', 'Stemple, mury i schody — koniec z zawałami.', ['stonecutting'], ['limestone', 'coal'], { infra: ['wooden_prop', 'stone_wall', 'stairs'] });
node('masonry_2', 1, 2, 'Kamieniarnia', 'Masonry workshop', 'Większa wydajność i posągi.', ['stonecutting', 'bronze_age'], ['limestone'], { buildings: [B('masonry', 2)], infra: ['statue'] });
node('carpentry_2', 1, 2, 'Stolarnia', 'Carpentry workshop', 'Szybsza obróbka drewna.', ['bronze_age'], ['tin_ore'], { buildings: [B('carpentry', 2)] });
node('wire_drawing', 1, 1, 'Ciągnienie drutu', 'Wire drawing', 'Drut, gwoździe i miedziana różdżka do szukania rud.', ['smithing'], ['coal', 'tin_ore'], { recipes: ['copper_wire', 'nails', 'copper_rod'] });
node('crossbows', 1, 2, 'Kusze', 'Crossbows', 'Broń dystansowa i bełty.', ['bronze_age', 'carpentry_2'], ['feather', 'tin_ore'], { recipes: ['wooden_crossbow', 'bolts'] });
node('herbalism', 1, 1, 'Zielarstwo', 'Herbalism', 'Zielarnia: klej, nawóz i napój leczniczy.', ['cooking'], ['moss', 'guano'], { buildings: [B('alchemy', 1)], recipes: ['glue', 'fertilizer', 'healing_draught'] });
node('living_quarters', 1, 2, 'Izby i składy', 'Rooms and stores', 'Prawdziwe łóżka i kamienne magazyny.', ['wire_drawing', 'stonecutting'], ['coal'], { buildings: [B('quarters', 2), B('storehouse', 2)] });
node('kitchen_2', 1, 1, 'Kuchnia', 'Kitchen', 'Lepsza kuchnia i miód jagodowy.', ['cooking', 'brewing'], ['coal'], { buildings: [B('kitchen', 2)], recipes: ['berry_mead'] });
node('militia', 1, 2, 'Straż grodu', 'Militia', 'Ćwiczebnia, pułapki i sztandary.', ['ballista', 'hunting'], ['fang', 'coal'], { buildings: [B('barracks', 1)], infra: ['spike_trap', 'banner'] });
node('healers', 1, 1, 'Uzdrowiciele', 'Healers', 'Posłanie zielarza dla rannych.', ['herbalism'], ['moss'], { buildings: [B('infirmary', 1)] });
node('taproom', 1, 1, 'Szynk', 'Taproom', 'Miejsce, gdzie krasnolud odpoczywa przy kuflu.', ['brewing'], ['coal'], { buildings: [B('tavern', 1)] });
node('windlass', 1, 2, 'Kołowrót', 'Windlass', 'Pierwsza winda: towary w górę i w dół szybu.', ['supports'], ['coal'], { buildings: [B('lift', 1)] });
node('pitch_lanterns', 1, 1, 'Latarnie smolne', 'Pitch lanterns', 'Jaśniejsze, mocniejsze światło na ramieniu.', ['lanterns', 'bronze_age'], ['coal'], { recipes: ['oil_lantern'] });
node('drafting', 1, 2, 'Kreślarstwo', 'Drafting', 'Plany inżyniera z próbek rudy żelaza — klucz do badań granitu.', ['surveying', 'bronze_age'], ['iron_ore'], { recipes: ['engineer_plans'] });

// ======================================== T2 — Granitowe Korzenie
node('coking', 2, 1, 'Koksownia', 'Coking', 'Koks: czystsze i gorętsze paliwo.', ['lime_burning'], ['iron_ore'], { recipes: ['coke'] });
node('blast_furnace', 2, 3, 'Wielki piec', 'Blast furnace', 'Żelazo. Wymaga Serca Królowej Nietoperzy do miechów.', ['coking', 'bronze_age'], ['iron_ore'], { buildings: [B('smelter', 2)], recipes: ['iron_bar'] }, [{ id: 'bat_queen_heart', n: 1 }]);
node('smithy', 2, 2, 'Kuźnia', 'Smithy', 'Blachy, łańcuchy i młot bojowy.', ['blast_furnace'], ['iron_ore'], { buildings: [B('forge', 2)], recipes: ['iron_plate', 'chain', 'iron_warhammer'] });
node('steelmaking', 2, 3, 'Stal', 'Steelmaking', 'Stalowe kilofy, siekiery i młoty budowniczego.', ['blast_furnace'], ['iron_ore'], { recipes: ['steel_bar', 'iron_pick', 'steel_pick', 'steel_felling_axe', 'steel_mallet'] });
node('arms_steel', 2, 2, 'Uzbrojenie stalowe', 'Steel arms', 'Stalowe topory, tarcze, hełmy i kolczugi.', ['steelmaking', 'smithy'], ['iron_ore'], { recipes: ['steel_axe', 'steel_shield', 'steel_helm', 'chainmail', 'piercing_bolts'] });
node('lead_working', 2, 1, 'Ołów i rury', 'Lead and pipes', 'Rury z ołowiu i rurociągi.', ['copper_smelting'], ['lead_ore'], { recipes: ['lead_bar', 'pipe'], infra: ['pipeline'] });
node('zinc_brass', 2, 2, 'Mosiądz', 'Brass', 'Cynk i mosiądz na mechanizmy.', ['blast_furnace'], ['zinc_ore'], { recipes: ['zinc_bar', 'brass_bar'] });
node('glassmaking', 2, 2, 'Szkło', 'Glassmaking', 'Szkło z piasku i kwarcu; latarnie olejne.', ['lime_burning'], ['quartz', 'sand'], { recipes: ['glass', 'glass_quartz'], infra: ['oil_lamp_post'] });
node('mechanisms', 2, 2, 'Mechanizmy', 'Mechanisms', 'Zębatki i sprężyny; pracownia mechanizmów.', ['zinc_brass', 'smithy'], ['zinc_ore'], { buildings: [B('workshop', 2)], recipes: ['gear', 'gear_iron', 'spring'] });
node('pumps', 2, 2, 'Pompy', 'Pumps', 'Pompy ręczne i tłokowe, grodzie przeciw zalaniom.', ['lead_working', 'mechanisms'], ['lead_ore', 'iron_ore'], { buildings: [B('pump_station', 1), B('pump_station', 2)], infra: ['bulkhead'] });
node('water_wheel', 2, 2, 'Koło wodne', 'Water wheel', 'Pierwsza energia z podziemnego strumienia.', ['mechanisms'], ['zinc_ore'], { buildings: [B('power_plant', 1)] });
node('geared_lift', 2, 2, 'Winda zębata', 'Geared lift', 'Szybsza winda napędzana kołem wodnym.', ['mechanisms', 'windlass'], ['zinc_ore'], { buildings: [B('lift', 2)] });
node('rails', 2, 2, 'Kolej kopalniana', 'Mine rails', 'Szyny, tory i zajezdnia wagoników.', ['smithy'], ['iron_ore'], { buildings: [B('rail_depot', 1)], recipes: ['rail'], infra: ['rail_track'] });
node('drilling', 2, 2, 'Wiertnictwo', 'Drilling', 'Kołowrót wiertniczy wydobywa złoża bez krasnoluda.', ['mechanisms', 'rails'], ['iron_ore'], { buildings: [B('drill_rig', 1)] });
node('trusses', 2, 1, 'Kratownice', 'Iron trusses', 'Żelazne podpory i drzwi.', ['smithy'], ['iron_ore'], { infra: ['iron_truss', 'iron_door'] });
node('library', 2, 2, 'Biblioteka', 'Library', 'Szybsze badania i kodeksy wyższych warstw.', ['glassmaking', 'zinc_brass'], ['quartz'], { buildings: [B('lore_hall', 2)] });
node('lapidary', 2, 1, 'Szlifiernia', 'Lapidary', 'Szlifowanie kwarcu.', ['glassmaking', 'smithy'], ['quartz'], { buildings: [B('jeweler', 1)] });
node('chitin_craft', 2, 1, 'Chityna', 'Chitin craft', 'Lekkie pancerze z chityny pełzaczy.', ['herbalism'], ['chitin'], { recipes: ['chitin_plate', 'chitin_vest', 'smith_gloves'] });
node('furriery', 2, 1, 'Kuśnierstwo', 'Furriery', 'Wyprawione futra i ciepłe płaszcze.', ['lime_burning', 'hunting'], ['fur'], { recipes: ['cured_fur', 'fur_cloak'] });
node('gas_masks', 2, 2, 'Maski z filtrem', 'Filter masks', 'Węglowe filtry chroniące przed zarodnikami.', ['glassmaking', 'zinc_brass'], ['glow_spores'], { recipes: ['filter', 'filter_mask'] });
node('prospecting', 2, 2, 'Poszukiwania', 'Prospecting', 'Sonda, plecak z ramą, okute buty i raki.', ['zinc_brass', 'steelmaking'], ['zinc_ore', 'crawler_acid'], { recipes: ['brass_probe', 'framed_pack', 'hobnailed_boots', 'steel_crampons'] });
node('barracks_2', 2, 2, 'Koszary', 'Barracks', 'Koszary i stalowe kusze.', ['arms_steel', 'militia'], ['iron_ore'], { buildings: [B('barracks', 2)], recipes: ['steel_crossbow'] });
node('repeating_ballista', 2, 2, 'Balista powtarzalna', 'Repeating ballista', 'Szybkostrzelna obrona korytarzy.', ['mechanisms'], ['zinc_ore'], { buildings: [B('defense_tower', 2)] });
node('brewery_2', 2, 1, 'Browar', 'Brewery', 'Większy browar z rurociągiem.', ['lead_working'], ['lead_ore'], { buildings: [B('brewery', 2)] });
node('tavern_2', 2, 1, 'Karczma', 'Tavern', 'Prawdziwa karczma przyciąga osadników.', ['taproom', 'smithy'], ['iron_ore'], { buildings: [B('tavern', 2)] });
node('codex_lore', 2, 2, 'Kodeksy alchemiczne', 'Alchemy codices', 'Próbki jadu i zarodników — klucz do badań grot.', ['drafting', 'glassmaking'], ['venom_sac', 'glow_spores'], { recipes: ['alchemy_codex'] });

// ============================================= T3 — Grzybowe Groty
node('fungal_carpentry', 3, 1, 'Drewno grzybowe', 'Fungal timber', 'Płyty z olbrzymich grzybów — drewno głębin.', ['carpentry_2'], ['mushroom_timber'], { recipes: ['fungal_board'] });
node('mushroom_farming', 3, 3, 'Grzybnie', 'Mushroom farming', 'Uprawy pod ziemią. Wymaga pancerza Matki Pełzaczy na skrzynie.', ['herbalism', 'fungal_carpentry'], ['mushroom'], { buildings: [B('farm', 2)], recipes: ['mushroom_bed', 'glowcap_bed'] }, [{ id: 'brood_carapace', n: 1 }]);
node('laboratory', 3, 2, 'Laboratorium', 'Laboratory', 'Ekstrakty jadu i pasta zarodnikowa.', ['herbalism', 'glassmaking'], ['venom_sac'], { buildings: [B('alchemy', 2)], recipes: ['venom_extract', 'spore_paste'] });
node('antidotes', 3, 1, 'Odtrutki', 'Antidotes', 'Antidotum i tonik nocnego wzroku.', ['laboratory'], ['venom_sac'], { recipes: ['antidote', 'nightsight_tonic'] });
node('silk_weaving', 3, 2, 'Tkactwo jedwabiu', 'Silk weaving', 'Jedwabna tkanina i lina.', ['campcraft'], ['spider_silk'], { recipes: ['silk_cloth', 'silk_rope'] });
node('blasting', 3, 2, 'Proch górniczy', 'Blasting', 'Ładunki kruszące skałę w promieniu.', ['laboratory'], ['sulfur'], { recipes: ['blasting_powder', 'blasting_charge'] });
node('silver_working', 3, 2, 'Srebro', 'Silverwork', 'Srebrne sztabki, jubiler i pierścienie.', ['blast_furnace', 'lapidary'], ['silver_ore'], { buildings: [B('jeweler', 2)], recipes: ['silver_bar', 'silver_ring'] });
node('ventilation', 3, 1, 'Wentylacja', 'Ventilation', 'Szyby wyciągające zarodniki.', ['mechanisms'], ['glow_spores'], { infra: ['vent_shaft'] });
node('comfort', 3, 1, 'Komnaty', 'Halls of rest', 'Jedwab i mosiądz w sypialniach.', ['silk_weaving', 'living_quarters'], ['spider_silk'], { buildings: [B('quarters', 3)] });
node('fine_brewing', 3, 2, 'Browar mistrzowski', 'Master brewing', 'Ciemny stout grzybowy.', ['brewery_2', 'silver_working'], ['mushroom'], { buildings: [B('brewery', 3)], recipes: ['dark_stout'] });
node('stews', 3, 1, 'Kuchnia grzybowa', 'Mushroom cuisine', 'Gulasz grzybowy.', ['kitchen_2'], ['mushroom'], { recipes: ['mushroom_stew'] });
node('infirmary_2', 3, 1, 'Lecznica', 'Infirmary', 'Lecznica ze srebrnymi narzędziami.', ['healers', 'silver_working'], ['silver_ore'], { buildings: [B('infirmary', 2)] });
node('crane_station', 3, 2, 'Stacja z dźwigiem', 'Crane station', 'Automatyczny załadunek wagoników.', ['rails', 'mechanisms'], ['mushroom_timber'], { buildings: [B('rail_depot', 2)] });
node('spore_lamps', 3, 1, 'Lampy zarodnikowe', 'Spore lamps', 'Światło głębin bez paliwa i dymu.', ['laboratory'], ['glow_spores'], { infra: ['spore_lamp'] });
node('silk_bridges', 3, 1, 'Mosty linowe', 'Rope bridges', 'Jedwabne liny nad rozpadlinami grot.', ['silk_weaving', 'fungal_carpentry'], ['spider_silk'], { infra: ['rope_bridge'] });
node('treatise_lore', 3, 2, 'Traktaty hydrauliczne', 'Hydraulic treatises', 'Próbki pereł i skór węgorzy — klucz do badań zatopionych głębi.', ['codex_lore', 'pumps'], ['pearl', 'eel_skin'], { recipes: ['hydraulic_treatise'] });

// =========================================== T4 — Zatopione Głębie
node('gaskets', 4, 3, 'Uszczelnienia', 'Gaskets', 'Uszczelki i zawory. Wymaga jedwabiu Królowej Pajęczyn.', ['mechanisms', 'silk_weaving'], ['eel_skin'], { recipes: ['gasket', 'pressure_valve'] }, [{ id: 'queen_silk', n: 1 }]);
node('diving', 4, 2, 'Nurkowanie', 'Diving', 'Strój ze skóry węgorza i hełm nurka.', ['gaskets', 'glassmaking'], ['eel_skin'], { recipes: ['eelskin_suit', 'diving_helmet'] });
node('nickel', 4, 2, 'Nikiel', 'Nickel', 'Stal niklowa odporna na wilgoć i parę.', ['steelmaking'], ['nickel_ore'], { recipes: ['nickel_bar', 'nickel_steel'] });
node('seafood', 4, 1, 'Rybołówstwo', 'Fishing', 'Wędka, olej rybi, pasztet i zupa z wodorostów.', ['stews', 'silk_weaving'], ['cave_fish', 'kelp'], { recipes: ['fishing_rod', 'fish_oil', 'fish_pie', 'kelp_stew'] });
node('steam_works', 4, 3, 'Fabryka parowa', 'Steam works', 'Tłoki i maszyny na parę.', ['nickel', 'gaskets', 'seafood'], ['nickel_ore'], { buildings: [B('workshop', 3)], recipes: ['piston'] });
node('steam_engine', 4, 3, 'Maszyna parowa', 'Steam engine', 'Energia z węgla i wody — wszędzie, nie tylko przy strumieniu.', ['steam_works', 'water_wheel'], ['nickel_ore'], { buildings: [B('power_plant', 2)] });
node('steam_pump', 4, 2, 'Pompa parowa', 'Steam pump', 'Osusza całe zatopione kawerny.', ['steam_engine', 'pumps'], ['nickel_ore'], { buildings: [B('pump_station', 3)] });
node('steam_lift', 4, 2, 'Winda parowa', 'Steam lift', 'Kręgosłup głębokiego grodu.', ['steam_engine', 'geared_lift'], ['nickel_ore'], { buildings: [B('lift', 3)] });
node('steam_railway', 4, 2, 'Parowa kolejka', 'Steam railway', 'Automatyczne trasy wagoników.', ['steam_engine', 'crane_station'], ['nickel_ore'], { buildings: [B('rail_depot', 3)] });
node('steam_drill', 4, 2, 'Wiertło parowe', 'Steam drill', 'Szybkie wydobycie bez górników.', ['steam_engine', 'drilling'], ['nickel_ore'], { buildings: [B('drill_rig', 2)] });
node('steam_saw', 4, 1, 'Tartak parowy', 'Steam sawmill', 'Masowa produkcja desek i płyt grzybowych.', ['steam_works', 'fungal_carpentry'], ['nickel_ore'], { buildings: [B('carpentry', 3)], recipes: ['plank_bulk', 'fungal_board_bulk'] });
node('vaults', 4, 2, 'Skarbiec', 'Vaults', 'Ogromny magazyn z automatycznym sortowaniem.', ['nickel', 'mechanisms'], ['nickel_ore'], { buildings: [B('storehouse', 3)] });
node('grand_kitchen', 4, 2, 'Wielka kuchnia', 'Grand kitchen', 'Kuchnia ze stali niklowej i krasnoludzka uczta.', ['nickel', 'seafood'], ['salt'], { buildings: [B('kitchen', 3)], recipes: ['feast_platter'] });
node('gold_smelting', 4, 2, 'Złoto', 'Goldwork', 'Złote sztabki i broszki z pereł.', ['silver_working'], ['gold_ore'], { recipes: ['gold_bar', 'pearl_brooch'] });
node('plate_armor_t', 4, 2, 'Zbroja płytowa', 'Plate armour', 'Pełna zbroja, nosidło parowe i kusza powtarzalna.', ['steam_works', 'arms_steel'], ['nickel_ore'], { recipes: ['plate_armor', 'steam_harness', 'repeating_crossbow'] });
node('heating', 4, 2, 'Ogrzewanie i przenośniki', 'Heating and conveyors', 'Kotły grzewcze, przenośniki łańcuchowe i pułapki ostrzowe.', ['steam_works'], ['nickel_ore'], { infra: ['heater', 'chain_conveyor', 'blade_trap'] });
node('feast_hall', 4, 2, 'Biesiadna sala', 'Feast hall', 'Złoto i srebro w największej karczmie.', ['gold_smelting', 'tavern_2'], ['gold_ore'], { buildings: [B('tavern', 3)] });
node('crystal_lore', 4, 2, 'Kryształowe tabliczki', 'Crystal tablets', 'Próbki mroźnych kryształów i ametystu — klucz do badań głębi kryształów.', ['treatise_lore', 'silver_working'], ['frost_crystal', 'amethyst'], { recipes: ['crystal_tablet'] });

// ========================================== T5 — Kryształowe Głębie
node('optics', 5, 2, 'Optyka', 'Optics', 'Soczewki i latarnie kryształowe bez paliwa.', ['lapidary'], ['frost_crystal', 'golem_shard'], { recipes: ['lens'], infra: ['crystal_lamp_post'] });
node('gem_cutting', 5, 3, 'Szlif klejnotów', 'Gem cutting', 'Ametysty i szafiry. Wymaga łuski Lewiatana do tarczy szlifierskiej.', ['silver_working', 'optics'], ['amethyst', 'sapphire'], { recipes: ['cut_amethyst', 'cut_sapphire'] }, [{ id: 'leviathan_scale', n: 1 }]);
node('cobalt', 5, 2, 'Kobalt', 'Cobalt', 'Stal kobaltowa — twardsza niż wszystko dotąd.', ['nickel', 'steam_engine'], ['cobalt_ore'], { recipes: ['cobalt_bar', 'cobalt_steel'] });
node('master_forge', 5, 3, 'Kuźnia mistrzowska', 'Master forge', 'Kobaltowe kilofy i topory — przebiją obsydian.', ['cobalt', 'gem_cutting'], ['cobalt_ore'], { buildings: [B('forge', 3)], recipes: ['cobalt_pick', 'cobalt_axe'] });
node('frost_alchemy', 5, 2, 'Alchemia mrozu', 'Frost alchemy', 'Rdzenie mrozu, napój rozgrzewający i chłodnice.', ['laboratory'], ['frost_crystal', 'frost_moth_dust'], { recipes: ['frost_core', 'warming_draught'], infra: ['cooler'] });
node('insulation', 5, 2, 'Ocieplenie', 'Insulation', 'Ocieplina i kubrak przeciw mrozowi.', ['furriery', 'silk_weaving'], ['frost_crystal', 'troll_hide'], { recipes: ['insulated_padding', 'padded_coat'] });
node('frostcore_armor', 5, 2, 'Pancerz mrozu', 'Frost-core armour', 'Chłód kryształów jako tarcza przed żarem głębin.', ['frost_alchemy', 'steam_works'], ['frost_crystal'], { recipes: ['frostcore_armor'] });
node('crystal_lamps', 5, 2, 'Lampy kryształowe', 'Crystal lamps', 'Lampa, wykrywacz złóż i maska z kryształowym filtrem.', ['optics', 'gem_cutting'], ['golem_shard'], { recipes: ['crystal_lamp', 'crystal_seeker', 'crystal_filter_mask'] });
node('great_hearth', 5, 3, 'Wielkie Palenisko', 'Great hearth', 'Trzecia epoka grodu: limit mieszkańców 50.', ['gem_cutting', 'cobalt', 'stone_hearth'], ['sapphire'], { buildings: [B('hearth', 3)] });
node('archive', 5, 2, 'Archiwum', 'Archive', 'Najszybsze badania i kodeksy najgłębszych warstw.', ['gem_cutting', 'library'], ['sapphire'], { buildings: [B('lore_hall', 3)] });
node('glassworks', 5, 2, 'Huta szkła', 'Glassworks', 'Szkło hartowane.', ['optics', 'nickel'], ['frost_crystal'], { buildings: [B('kiln', 3)], recipes: ['tempered_glass'] });
node('light_garden', 5, 2, 'Ogród świetlny', 'Light garden', 'Uprawy w każdej głębi pod sztucznym słońcem.', ['glassworks', 'mushroom_farming'], ['frost_crystal'], { buildings: [B('farm', 3)], recipes: ['light_garden'] });
node('master_stoneworks', 5, 1, 'Szlifiernia mistrzowska', 'Master stoneworks', 'Masowa produkcja bloków.', ['cobalt', 'masonry_2'], ['cobalt_ore'], { buildings: [B('masonry', 3)], recipes: ['stone_block_bulk'] });
node('heroes', 5, 2, 'Sala bohaterów', 'Hall of heroes', 'Elitarna straż.', ['master_forge', 'barracks_2'], ['cobalt_ore'], { buildings: [B('barracks', 3)] });
node('sanctuary', 5, 1, 'Sanktuarium', 'Sanctuary', 'Leczy nawet najcięższe rany.', ['gem_cutting', 'infirmary_2'], ['amethyst'], { buildings: [B('infirmary', 3)] });
node('trinkets', 5, 1, 'Amulety', 'Amulets', 'Amulet szafirowy i talizman ametystowy.', ['gem_cutting', 'gold_smelting'], ['sapphire', 'amethyst'], { recipes: ['sapphire_amulet', 'amethyst_talisman'] });
node('ember_lore', 5, 2, 'Ogniste kodeksy', 'Ember codices', 'Próbki obsydianu i rubinów — klucz do badań Pasa Magmy.', ['crystal_lore', 'glassworks'], ['obsidian', 'ruby'], { recipes: ['ember_codex'] });

// ================================================ T6 — Pas Magmy
node('magma_smeltery', 6, 3, 'Kuźnia magmowa', 'Magma smeltery', 'Lawa zamiast węgla; brąz żarowy. Wymaga Rdzenia Kolosa.', ['cobalt', 'frost_alchemy'], ['emberite_ore'], { buildings: [B('smelter', 3)], recipes: ['emberbronze_bar'] }, [{ id: 'colossus_core', n: 1 }]);
node('ember_tools', 6, 2, 'Narzędzia żarowe', 'Ember tools', 'Kilof żarowy i żarowy młot.', ['magma_smeltery', 'fire_alchemy'], ['emberite_ore'], { recipes: ['ember_pick', 'ember_maul'] });
node('obsidian_craft', 6, 2, 'Obsydian', 'Obsidian craft', 'Ostrza, włócznie i mury obsydianowe.', ['master_forge'], ['obsidian'], { recipes: ['obsidian_edge', 'obsidian_spear'], infra: ['obsidian_wall'] });
node('fire_alchemy', 6, 2, 'Alchemia ognia', 'Fire alchemy', 'Esencja ognia, ognioodporność, bomby i bełty ogniste.', ['laboratory', 'blasting'], ['fire_gland'], { buildings: [B('alchemy', 3)], recipes: ['fire_essence', 'fire_ward_potion', 'fire_bomb', 'fire_bolts'] });
node('scale_tanning', 6, 2, 'Garbowanie łusek', 'Scale tanning', 'Skóra łuskowa i szata z łuski salamandry.', ['steam_works', 'hunting'], ['salamander_scale'], { recipes: ['scale_leather', 'scale_robe'] });
node('heat_exchange', 6, 2, 'Wymienniki ciepła', 'Heat exchange', 'Mróz kryształów okiełznuje żar lawy.', ['frost_alchemy', 'steam_works'], ['magma_core', 'obsidian'], { recipes: ['heat_exchanger'] });
node('lava_engineering', 6, 2, 'Inżynieria lawy', 'Lava engineering', 'Kanały i zasuwy: lawa płynie tam, gdzie chce krasnolud.', ['obsidian_craft', 'heat_exchange'], ['obsidian', 'magma_core'], { infra: ['lava_channel', 'lava_gate'] });
node('cooling_grid', 6, 2, 'Sieć chłodząca', 'Cooling grid', 'Rury rozprowadzające chłód rdzeni mrozu.', ['heat_exchange'], ['magma_core'], { infra: ['cooling_pipe'] });
node('obsidian_architecture', 6, 1, 'Architektura obsydianowa', 'Obsidian architecture', 'Filary, które nie mięknieją od żaru.', ['obsidian_craft'], ['obsidian'], { infra: ['obsidian_pillar'] });
node('magma_turbine', 6, 3, 'Turbina magmowa', 'Magma turbine', 'Ogromna energia z lawy doprowadzonej kanałami.', ['heat_exchange', 'steam_engine', 'lava_engineering'], ['magma_core'], { buildings: [B('power_plant', 3)] });
node('magma_forging', 6, 3, 'Hartowanie w magmie', 'Magma forging', 'Stal bez koksu, szkło z obsydianu, cegły hurtem — żar lawy zastępuje paliwo.', ['magma_smeltery', 'lava_engineering', 'glassworks'], ['emberite_ore', 'obsidian'], { recipes: ['steel_bar_magma', 'glass_obsidian', 'brick_magma'] });
node('fire_defense', 6, 2, 'Obrona ogniowa', 'Fire defence', 'Pułapki ogniowe i lampy żarowe.', ['fire_alchemy', 'magma_smeltery'], ['fire_gland'], { infra: ['fire_trap', 'ember_lamp'] });
node('magma_drill', 6, 2, 'Wiertło magmowe', 'Magma drill', 'Najszybsze automatyczne wydobycie.', ['heat_exchange', 'magma_smeltery', 'steam_drill'], ['magma_core'], { buildings: [B('drill_rig', 3)] });
node('rune_jeweler', 6, 2, 'Rubiny', 'Rubies', 'Szlif rubinów, amulet rubinowy, runiczny jubiler.', ['gem_cutting', 'magma_smeltery'], ['ruby'], { buildings: [B('jeweler', 3)], recipes: ['cut_ruby', 'ruby_amulet'] });
node('rune_lore', 6, 2, 'Księgi run', 'Rune tomes', 'Próbki runokamienia i pyłu runicznego — klucz do badań prastarych głębin.', ['ember_lore', 'archive'], ['runestone', 'rune_dust'], { recipes: ['rune_tome'] });

// ========================================= T7 — Prastare Głębiny
node('ether', 7, 3, 'Esencja eteryczna', 'Ether essence', 'To, z czego zbudowane są upiory. Wymaga Serca Robaka Magmowego.', ['fire_alchemy'], ['ectoplasm'], { recipes: ['ether_essence'] }, [{ id: 'wyrm_heart', n: 1 }]);
node('rune_ink_t', 7, 2, 'Atrament runiczny', 'Rune ink', 'Pył runiczny w atramencie.', ['laboratory', 'scribing'], ['rune_dust'], { recipes: ['rune_ink'] });
node('rune_carving', 7, 3, 'Tablice runiczne', 'Rune carving', 'Tablice i kamienie ochronne odpędzające grozę.', ['rune_ink_t', 'master_stoneworks'], ['runestone'], { recipes: ['rune_tablet'], infra: ['ward_stone'] });
node('adamant', 7, 3, 'Adamant', 'Adamant', 'Najtwardszy metal świata, wytapiany na rdzeniach magmy przy mocy turbiny.', ['magma_smeltery', 'magma_turbine'], ['adamantite_ore'], { recipes: ['adamant_bar'] });
node('adamant_arms', 7, 3, 'Oręż adamantowy', 'Adamant arms', 'Kilof, topór, hełm i zbroja z adamantu.', ['adamant', 'scale_tanning', 'insulation'], ['adamantite_ore'], { recipes: ['adamant_pick', 'adamant_axe', 'adamant_helm', 'adamant_armor'] });
node('glimmersteel', 7, 3, 'Lśnitstal', 'Glimmersteel', 'Metal, który świeci — mrok go nie pożera.', ['ether', 'adamant'], ['glimmerite_ore'], { recipes: ['glimmersteel_bar'], infra: ['glimmer_beacon'] });
node('glimmer_crafts', 7, 3, 'Dzieła z lśnitu', 'Glimmer crafts', 'Lśniący kilof, lampa i amulet lśnitu.', ['glimmersteel', 'rune_jeweler', 'rune_ink_t'], ['glimmerite_ore'], { recipes: ['glimmer_pick', 'glimmer_lamp', 'glimmer_amulet'] });
node('clockwork_t', 7, 2, 'Mechanizmy zegarowe', 'Clockwork', 'Odtworzone mechanizmy prastarych.', ['mechanisms'], ['ancient_cog'], { recipes: ['clockwork'] });
node('rune_arms', 7, 3, 'Oręż runiczny', 'Rune arms', 'Runiczny młot, tarcza i płaszcz run.', ['rune_carving', 'adamant', 'ether'], ['runestone'], { recipes: ['runic_hammer', 'rune_shield', 'rune_cloak'] });
node('rune_cannon', 7, 3, 'Działo runiczne', 'Rune cannon', 'Obrona, która rozbija konstrukty.', ['rune_carving', 'clockwork_t', 'fire_alchemy'], ['ancient_cog'], { buildings: [B('defense_tower', 3)] });
node('heart_key_t', 7, 3, 'Klucz Serca', 'Key of the Heart', 'Pieczęć Strażnika, relikwie, adamant i lśnitstal otwierają Serce Góry.', ['glimmersteel', 'rune_carving', 'great_hearth'], ['relic', 'guardian_sigil'], { recipes: ['heart_key'] });

export const TECH: readonly TechNode[] = T;
export const TECH_BY_ID = new Map(T.map((t) => [t.id, t]));
