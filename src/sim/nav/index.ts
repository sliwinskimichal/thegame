/**
 * Navigation with gravity for dwarves and monsters (see docs/design/ai/NAVIGATION.md).
 *
 *   const grid = new NavGrid(world, { profiles: [DWARF, GOBLIN] });
 *   grid.setInfraColumn(16, 10, 19, INFRA.LADDER);
 *   grid.addLift([topStop, bottomStop], { speed: 2.5, wait: 4000, capacity: 10 });
 *   const finder = new HpaStar(grid, grid.profileIndex('dwarf'), { cluster: 16 });
 *   const path = new Path();
 *   if (finder.find(start, [goal], path) === NAV.FOUND) ...
 *   const agent = new NavAgent(finder, start); agent.go([goal]); agent.tick(50);
 *
 * Every world change goes through `grid.sync()` (finders and agents call it).
 */
export * from './types';
export * from './profiles';
export { NavGrid, type NavListener, type NavGridOptions } from './grid';
export { Path, SearchScratch, scratchFor } from './search';
export { AStar, type PathFinder, type FindOptions, type AStarOptions } from './astar';
export { JumpTables } from './jump';
export { HpaStar, type HpaOptions } from './hpa';
export { NavAgent, NavPlanner, AGENT } from './follow';
export { workSpots } from './spots';
