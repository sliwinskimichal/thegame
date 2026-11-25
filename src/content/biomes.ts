/** The nine depth biomes and the environmental hazards they introduce. */
import type { Biome, Hazard } from './types';

export const BIOMES: readonly Biome[] = [
  {
    id: 'foothills', tier: 0, namePl: 'Podgórze', nameEn: 'Foothills', depth: [0, 20],
    hazards: ['night_predators', 'raids'],
    rocks: ['soil'],
    approachPl: 'Obóz, drewno i kamień, pierwsze schronienie w zboczu, ogień i warta przed nocą.',
    descPl: 'Łąki i sosnowy las u stóp góry. Za dnia spokojnie, nocą krążą wilki, a gobliny sprawdzają, czy przybysze są łatwym łupem.',
  },
  {
    id: 'limestone', tier: 1, namePl: 'Wapienne Progi', nameEn: 'Limestone Ledges', depth: [20, 100],
    hazards: ['darkness', 'cave_ins'],
    rocks: ['limestone', 'sandstone', 'shale'],
    approachPl: 'Światło i podpory: pochodnie, stemple, zaprawa wapienna. Brąz z miedzi i cyny.',
    descPl: 'Ciepłe warstwy wapienia i piaskowca, pokłady węgla i jaskinie nietoperzy pełne saletry. Szerokie hale bez podpór się zawalają.',
  },
  {
    id: 'granite', tier: 2, namePl: 'Granitowe Korzenie', nameEn: 'Granite Roots', depth: [100, 190],
    hazards: ['hard_rock', 'flooding'],
    rocks: ['granite', 'slate'],
    approachPl: 'Twardsze kilofy, żelazo i stal, pompy i grodzie przeciw wodzie, pierwsza energia z koła wodnego.',
    descPl: 'Twardy granit, w którym kryją się żelazo, ołów i cynk. Przebicie się do kieszeni wodnej zalewa tunele w kilka chwil.',
  },
  {
    id: 'fungal', tier: 3, namePl: 'Grzybowe Groty', nameEn: 'Fungal Grottos', depth: [190, 280],
    hazards: ['spores', 'poison'],
    rocks: ['sporeShale', 'mycelium'],
    approachPl: 'Maski z filtrem i wentylacja, antidotum, uprawa grzybów, jedwab i proch górniczy.',
    descPl: 'Ogromne groty porośnięte świecącą grzybnią. Zarodniki dławią płuca, a w sieciach czekają olbrzymie pająki.',
  },
  {
    id: 'sunken', tier: 4, namePl: 'Zatopione Głębie', nameEn: 'Sunken Deep', depth: [280, 370],
    hazards: ['deep_water', 'flooding'],
    rocks: ['mudstone'],
    approachPl: 'Hydraulika: pompy parowe, tamy, akwedukty, stroje nurków i maszyna parowa.',
    descPl: 'Podziemne morze w czarnych kawernach. Pod wodą perły, sól i nikiel, w toni węgorze długie jak wagonik.',
  },
  {
    id: 'crystal', tier: 5, namePl: 'Kryształowe Głębie', nameEn: 'Crystal Depths', depth: [370, 460],
    hazards: ['cold', 'darkness'],
    rocks: ['schist'],
    approachPl: 'Ogrzewanie i ocieplana odzież, optyka i lampy kryształowe, stal kobaltowa przeciw golemom.',
    descPl: 'Geody wielkie jak katedry. Mroźne kryształy wysysają ciepło z powietrza, a niektóre z nich chodzą.',
  },
  {
    id: 'magma', tier: 6, namePl: 'Pas Magmy', nameEn: 'Magma Belt', depth: [460, 550],
    hazards: ['heat', 'lava', 'fumes'],
    rocks: ['basalt', 'magmaRock'],
    approachPl: 'Chłodzenie mroźnymi rdzeniami z poprzedniej warstwy, obsydianowe mury, kuźnia i turbina magmowa.',
    descPl: 'Rzeki lawy, obsydian i żaryt. Gorąco zabija szybciej niż chochliki, które w nim tańczą.',
  },
  {
    id: 'ancient', tier: 7, namePl: 'Prastare Głębiny', nameEn: 'Ancient Deep', depth: [550, 640],
    hazards: ['dread', 'constructs', 'darkness'],
    rocks: ['deepstone', 'ancientBrick'],
    approachPl: 'Runy ochronne, światło lśnitu, adamant przeciw pancernym konstruktom.',
    descPl: 'Ruiny cywilizacji starszej niż krasnoludy. Mrok tu gęstnieje i odbiera odwagę, a strażnicy wciąż pełnią wartę.',
  },
  {
    id: 'heart', tier: 8, namePl: 'Serce Góry', nameEn: 'Heart of the Mountain', depth: [640, 680],
    hazards: ['dread', 'heat', 'darkness'],
    rocks: ['heartstone', 'bedrock'],
    approachPl: 'Wszystko, czego nauczył się gród: klucz Serca, najlepszy ekwipunek i przygotowana obrona.',
    descPl: 'Zapieczętowana komnata, w której śpi Pożeracz Światła. Kto go zbudzi, musi go pokonać.',
  },
];

export const HAZARDS: readonly Hazard[] = [
  { id: 'night_predators', namePl: 'Nocne drapieżniki', descPl: 'Wilki atakują krasnoludy poza obozem po zmroku.', counters: ['wooden_door', 'torch', 'defense_tower', 'copper_axe', 'hunting_spear'] },
  { id: 'raids', namePl: 'Najazdy', descPl: 'Gobliny i potwory szturmują gród, gdy rośnie jego bogactwo.', counters: ['defense_tower', 'barracks', 'iron_door', 'stone_wall'] },
  { id: 'darkness', namePl: 'Ciemność', descPl: 'Bez światła praca idzie wolniej, nastrój spada, potwory śmielej atakują.', counters: ['torch', 'oil_lamp_post', 'crystal_lamp_post', 'hand_lantern', 'oil_lantern', 'crystal_lamp', 'glimmer_lamp'] },
  { id: 'cave_ins', namePl: 'Zawały', descPl: 'Szerokie wyrobiska bez podpór osuwają się, raniąc i grzebiąc krasnoludy.', counters: ['wooden_prop', 'stone_pillar', 'iron_truss'] },
  { id: 'hard_rock', namePl: 'Twarda skała', descPl: 'Granit i bazalt wymagają lepszych kilofów.', counters: ['bronze_pick', 'iron_pick', 'steel_pick'] },
  { id: 'flooding', namePl: 'Zalania', descPl: 'Przebite kieszenie wodne zalewają tunele; woda topi i niszczy zapasy.', counters: ['pump_station', 'bulkhead', 'stone_wall'] },
  { id: 'spores', namePl: 'Zarodniki', descPl: 'Duszące chmury zarodników w grotach grzybowych.', counters: ['filter_mask', 'crystal_filter_mask', 'vent_shaft'] },
  { id: 'poison', namePl: 'Jad', descPl: 'Ukąszenia pająków zatruwają; bez antidotum trucizna zabija powoli.', counters: ['antidote', 'chitin_vest', 'infirmary'] },
  { id: 'deep_water', namePl: 'Głęboka woda', descPl: 'Zatopione kawerny skrywają złoża pod wodą; bez sprzętu krasnolud się topi.', counters: ['eelskin_suit', 'diving_helmet', 'pump_station'] },
  { id: 'cold', namePl: 'Mróz', descPl: 'Mroźne kryształy wysysają ciepło; wychłodzenie spowalnia i zabija.', counters: ['fur_cloak', 'padded_coat', 'heater', 'warming_draught'] },
  { id: 'heat', namePl: 'Żar', descPl: 'Temperatura pasa magmy pali bez ochrony.', counters: ['scale_robe', 'frostcore_armor', 'cooler', 'fire_ward_potion'] },
  { id: 'lava', namePl: 'Lawa', descPl: 'Wylewy lawy niszczą wszystko na swojej drodze; z wodą tworzą obsydian.', counters: ['obsidian_wall', 'pump_station', 'bulkhead'] },
  { id: 'fumes', namePl: 'Opary', descPl: 'Siarkowe opary nad lawą.', counters: ['crystal_filter_mask', 'vent_shaft'] },
  { id: 'dread', namePl: 'Groza', descPl: 'Prastary mrok odbiera odwagę: nastrój spada, światło gaśnie szybciej.', counters: ['rune_cloak', 'glimmer_amulet', 'ward_stone', 'glimmer_lamp'] },
  { id: 'constructs', namePl: 'Konstrukty', descPl: 'Pancerni strażnicy ruin odporni na zwykłą broń.', counters: ['adamant_axe', 'runic_hammer', 'defense_tower'] },
];
