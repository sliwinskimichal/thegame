/**
 * Great Works: monumental optional projects for the late game (the
 * "max-out" goal of ~120 h). Each has three stages with escalating costs and
 * colony-wide bonuses. Unlocked by research tier, built like buildings but
 * on a monumental scale.
 */
import type { Stack } from './types';

export interface GreatWorkStage {
  namePl: string;
  cost: readonly Stack[];
  work: number;
  bonus: Readonly<Record<string, number>>;
}

export interface GreatWork {
  id: string;
  namePl: string;
  nameEn: string;
  /** Research tier from which the first stage can be started. */
  tier: number;
  descPl: string;
  stages: readonly [GreatWorkStage, GreatWorkStage, GreatWorkStage];
}

const s = (id: string, n: number): Stack => ({ id, n });

export const GREAT_WORKS: readonly GreatWork[] = [
  {
    id: 'forefather_statue', namePl: 'Posąg Przodka', nameEn: 'Statue of the Forefather', tier: 1,
    descPl: 'Kamienny olbrzym wykuty w ścianie głównego szybu. Każdy krasnolud przechodzący obok staje prościej.',
    stages: [
      { namePl: 'Fundament', cost: [s('stone_block', 900), s('mortar', 400)], work: 3000, bonus: { morale: 2 } },
      { namePl: 'Postać', cost: [s('stone_block', 2400), s('bronze_bar', 300)], work: 7000, bonus: { morale: 4 } },
      { namePl: 'Złocenie', cost: [s('gold_bar', 90), s('stone_block', 2000), s('brass_bar', 400)], work: 9000, bonus: { morale: 7, migrants: 0.2 } },
    ],
  },
  {
    id: 'great_gate', namePl: 'Wielka Brama', nameEn: 'Great Gate', tier: 2,
    descPl: 'Wrota grodu, o które rozbija się każdy najazd.',
    stages: [
      { namePl: 'Żelazne skrzydła', cost: [s('iron_plate', 500), s('beam', 400)], work: 4000, bonus: { raidDefense: 0.15 } },
      { namePl: 'Stalowe okucia', cost: [s('steel_bar', 1200), s('chain', 600)], work: 8000, bonus: { raidDefense: 0.3 } },
      { namePl: 'Adamantowe zawiasy', cost: [s('adamant_bar', 60), s('rune_tablet', 40), s('cobalt_steel', 300)], work: 11000, bonus: { raidDefense: 0.5 } },
    ],
  },
  {
    id: 'tankard_hall', namePl: 'Sala Tysiąca Kufli', nameEn: 'Hall of a Thousand Tankards', tier: 2,
    descPl: 'Legenda głosi, że nikt nie wyszedł z niej trzeźwy ani smutny.',
    stages: [
      { namePl: 'Ławy i beczki', cost: [s('plank', 1500), s('ale', 1500)], work: 3500, bonus: { morale: 3 } },
      { namePl: 'Mosiężne krany', cost: [s('brass_bar', 500), s('dark_stout', 1500), s('glass', 800)], work: 7000, bonus: { morale: 5, migrants: 0.3 } },
      { namePl: 'Srebrne kufle', cost: [s('silver_bar', 300), s('feast_platter', 600), s('stone_block', 2000)], work: 10000, bonus: { morale: 8, migrants: 0.5 } },
    ],
  },
  {
    id: 'abyss_bridge', namePl: 'Most nad Otchłanią', nameEn: 'Bridge over the Abyss', tier: 3,
    descPl: 'Łuk rzucony nad najgłębszą rozpadliną grot — skrót, który skraca każdą trasę.',
    stages: [
      { namePl: 'Liny nośne', cost: [s('silk_rope', 600), s('fungal_board', 1500)], work: 4500, bonus: { logistics: 0.05 } },
      { namePl: 'Kratownica', cost: [s('steel_bar', 1000), s('rail', 1200)], work: 8500, bonus: { logistics: 0.1 } },
      { namePl: 'Parowe wagony', cost: [s('nickel_steel', 700), s('piston', 200), s('pressure_valve', 200)], work: 11000, bonus: { logistics: 0.18 } },
    ],
  },
  {
    id: 'archive_of_ages', namePl: 'Archiwum Wieków', nameEn: 'Archive of Ages', tier: 4,
    descPl: 'Kronika każdego krasnoluda, który żył w grodzie, wyryta w kamieniu.',
    stages: [
      { namePl: 'Półki', cost: [s('stone_block', 2000), s('parchment', 2500)], work: 5000, bonus: { research: 0.1 } },
      { namePl: 'Kodeksy', cost: [s('gold_bar', 60), s('crystal_tablet', 300), s('ink', 2000)], work: 9000, bonus: { research: 0.2 } },
      { namePl: 'Runy pamięci', cost: [s('rune_tablet', 120), s('relic', 6), s('stone_block', 3000)], work: 12000, bonus: { research: 0.35 } },
    ],
  },
  {
    id: 'crystal_dome', namePl: 'Kryształowa Kopuła', nameEn: 'Crystal Dome', tier: 5,
    descPl: 'Sztuczne słońce pod kilometrem skały. Rosną pod nim ogrody, a krasnoludy przypominają sobie niebo.',
    stages: [
      { namePl: 'Szkielet', cost: [s('cobalt_steel', 400), s('tempered_glass', 1200)], work: 6000, bonus: { food: 0.15 } },
      { namePl: 'Soczewki', cost: [s('lens', 900), s('glass', 3000), s('cut_sapphire', 40)], work: 9500, bonus: { food: 0.3, morale: 3 } },
      { namePl: 'Rdzeń światła', cost: [s('glimmersteel_bar', 40), s('crystal_heart', 6), s('tempered_glass', 2000)], work: 13000, bonus: { food: 0.5, morale: 6 } },
    ],
  },
  {
    id: 'star_forge', namePl: 'Gwiezdna Kuźnia', nameEn: 'Star Forge', tier: 6,
    descPl: 'Kowadło zasilane rzeką lawy. Wykute w niej przedmioty są lżejsze i trwalsze.',
    stages: [
      { namePl: 'Palenisko lawowe', cost: [s('obsidian', 2000), s('emberbronze_bar', 300), s('brick', 3000)], work: 7000, bonus: { craftSpeed: 0.1 } },
      { namePl: 'Kowadło gwiazd', cost: [s('heat_exchanger', 60), s('cobalt_steel', 600), s('steel_bar', 1500)], work: 10000, bonus: { craftSpeed: 0.2, durability: 0.2 } },
      { namePl: 'Płomień serca', cost: [s('adamant_bar', 80), s('magma_core', 20), s('emberbronze_bar', 600)], work: 14000, bonus: { craftSpeed: 0.35, durability: 0.5 } },
    ],
  },
  {
    id: 'beacon_of_the_deep', namePl: 'Latarnia Głębin', nameEn: 'Beacon of the Deep', tier: 7,
    descPl: 'Światło widoczne z każdego tunelu grodu. Groza przed nim cofa się jak cień przed świtem.',
    stages: [
      { namePl: 'Wieża', cost: [s('obsidian', 2500), s('adamant_bar', 40), s('stone_block', 3000)], work: 8000, bonus: { dreadRes: 0.2 } },
      { namePl: 'Soczewka', cost: [s('lens', 800), s('glimmersteel_bar', 40), s('tempered_glass', 1500)], work: 11000, bonus: { dreadRes: 0.4, light: 4 } },
      { namePl: 'Wieczny płomień', cost: [s('glimmersteel_bar', 80), s('guardian_sigil', 1), s('crystal_heart', 8)], work: 15000, bonus: { dreadRes: 0.8, light: 8 } },
    ],
  },
];
