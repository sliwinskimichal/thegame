/**
 * The tournament variants of the dwarf model (owner: W1; ids are binding, brief §2). Every variant
 * builds the same parts (anatomy + role gear) with its technique and proportions, 4 roles × 3 LOD.
 */
import { PROPORTION_PRESETS } from '../direction';
import type { DwarfSpec, DwarfVariant, Proportions, Technique } from '../types';
import { buildModel } from './build';
import type { TechniqueImpl } from './techniques/common';
import { carvedTechnique } from './techniques/carved';
import { facetedTechnique } from './techniques/faceted';
import { latheTechnique } from './techniques/lathe';
import { outlineTechnique } from './techniques/outline';
import { papercutTechnique } from './techniques/papercut';
import { primitivesTechnique } from './techniques/primitives';

interface VariantDef {
  id: string;
  namePl: string;
  descPl: string;
  technique: Technique;
  proportions: Proportions;
  viewYawDeg: number;
  impl: () => TechniqueImpl;
}

function variant(d: VariantDef): DwarfVariant {
  let impl: TechniqueImpl | null = null;
  return {
    id: d.id,
    namePl: d.namePl,
    descPl: d.descPl,
    technique: d.technique,
    proportions: d.proportions,
    viewYawDeg: d.viewYawDeg,
    build(spec: DwarfSpec) {
      impl ??= d.impl();
      return buildModel(d.id, d.viewYawDeg, impl, spec);
    },
  };
}

const P = PROPORTION_PRESETS;

export const VARIANT_DEFS: readonly VariantDef[] = [
  {
    id: 'd01-karta',
    namePl: 'Karta',
    descPl: 'Wariant kontrolny: kule, kapsuły, prostopadłościany i stożki ściśle według tabeli karty konceptu, gładkie normalne.',
    technique: 'primitives',
    proportions: P.A,
    viewYawDeg: 40,
    impl: () => primitivesTechnique('welded'),
  },
  {
    id: 'd02-toczone',
    namePl: 'Toczone',
    descPl: 'Bryły toczone i wyciągane: tułów-beczka i spódnica ze splajnu, głowa-jajo, hełm, czapa i kaptur z profilu, kończyny z wybrzuszeniem mięśni, broda-kropla, buty z jednego profilu bocznego z zaokrągloną fazą — gładki obrys.',
    technique: 'lathe',
    proportions: P.A,
    viewYawDeg: 40,
    impl: () => latheTechnique(),
  },
  {
    id: 'd03-fasety',
    namePl: 'Fasety',
    descPl: 'Niska liczba segmentów (4–6), płaskie cieniowanie i lekkie „struganie” wierzchołków z seeda — rysunkowa faseta.',
    technique: 'faceted',
    proportions: P.A,
    viewYawDeg: 40,
    impl: () => facetedTechnique(),
  },
  {
    id: 'd04-wycinanka',
    namePl: 'Wycinanka',
    descPl: 'Płaskie karty 2.5D: profil każdej części (grubość 0,02–0,03) w trzech warstwach głębi — daleka, ciało, bliska; czysty profil (yaw 0°).',
    technique: 'papercut',
    proportions: P.A,
    viewYawDeg: 0,
    impl: () => papercutTechnique(),
  },
  {
    id: 'd05-drewno',
    namePl: 'Drewno',
    descPl: 'Figurka rzeźbiona: bryły z fazowanymi krawędziami, walce jako graniastosłupy 8-boczne z fazowanymi końcami, kule strugane w ośmiokąty — wszystko płasko cieniowane.',
    technique: 'carved',
    proportions: P.A,
    viewYawDeg: 40,
    impl: () => carvedTechnique(),
  },
  {
    id: 'd06-kontur',
    namePl: 'Kontur',
    descPl: 'Sylwetki części zaprojektowane jako kontury 2D i wyciągnięte przez ich głębię z mocnym zaokrąglonym fazowaniem od strony kamery („poduszki”).',
    technique: 'outline',
    proportions: P.A,
    viewYawDeg: 25,
    impl: () => outlineTechnique(),
  },
  {
    id: 'd07-czesci',
    namePl: 'Części',
    descPl: 'Te same bryły co d01, ale każda część to osobna siatka w przestrzeni kości (instancjonowanie części) — bliźniak kosztowy d01.',
    technique: 'parts',
    proportions: P.A,
    viewYawDeg: 40,
    impl: () => primitivesTechnique('parts'),
  },
  {
    id: 'd09-beczka',
    namePl: 'Beczka',
    descPl: 'Prymitywy w proporcjach B: 3,2 głowy, okrąglejszy tułów, krótsza broda (ryzyko słodkości).',
    technique: 'primitives',
    proportions: P.B,
    viewYawDeg: 40,
    impl: () => primitivesTechnique('welded'),
  },
  {
    id: 'd10-slup',
    namePl: 'Słup',
    descPl: 'Prymitywy w proporcjach C: 3,6 głowy, 1,40 wzrostu, węższe barki (ryzyko utraty krasnoludzkości).',
    technique: 'primitives',
    proportions: P.C,
    viewYawDeg: 40,
    impl: () => primitivesTechnique('welded'),
  },
  {
    id: 'd11-kowadlo',
    namePl: 'Kowadło+',
    descPl: 'Przerysowane kowadło: barki 0,68, dłonie 0,16, broda 0,40 (proporcje A+).',
    technique: 'primitives',
    proportions: P.A_PLUS,
    viewYawDeg: 40,
    impl: () => primitivesTechnique('welded'),
  },
  {
    id: 'd12-trzy-glowy',
    namePl: 'Trzy głowy',
    descPl: 'Dolna granica wizji: 3,0 głowy przy tym samym wzroście (większa głowa) — strażnik przeciw chibi.',
    technique: 'primitives',
    proportions: P.H3_0,
    viewYawDeg: 40,
    impl: () => primitivesTechnique('welded'),
  },
];

export const DWARF_VARIANTS: readonly DwarfVariant[] = VARIANT_DEFS.map(variant);
