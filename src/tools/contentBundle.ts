/**
 * The real game content gathered into one ContentBundle for the validator
 * (src/tools/contentCheck.ts) and the data browser (tools.html).
 * The only place in src/tools that imports the data modules.
 */
import { BIOMES, HAZARDS } from '../content/biomes';
import { BUILDINGS, INFRASTRUCTURE, START_BUILDINGS, START_INFRA } from '../content/buildings';
import { GREAT_WORKS } from '../content/greatworks';
import { RECIPES, START_RECIPES } from '../content/recipes';
import { RESOURCES, START_DISCOVERED } from '../content/resources';
import { CREATURES, DEPOSITS, OBJECTS, ROCK_PICK_TIER } from '../content/sources';
import { RESEARCH_PACKS, TECH } from '../content/tech';
import { MATERIALS } from '../world/materials';
import type { ContentBundle } from './contentCheck';

export function realBundle(): ContentBundle {
  return {
    biomes: BIOMES,
    hazards: HAZARDS,
    resources: RESOURCES,
    deposits: DEPOSITS,
    objects: OBJECTS,
    creatures: CREATURES,
    buildings: BUILDINGS,
    infrastructure: INFRASTRUCTURE,
    recipes: RECIPES,
    tech: TECH,
    greatWorks: GREAT_WORKS,
    materials: MATERIALS,
    startBuildings: START_BUILDINGS,
    startRecipes: START_RECIPES,
    startInfra: START_INFRA,
    startDiscovered: START_DISCOVERED,
    researchPacks: RESEARCH_PACKS,
    rockPickTier: ROCK_PICK_TIER,
    // ordinary rock yields stone everywhere (mirrors src/content/analysis.ts)
    rockYield: 'stone',
  };
}
