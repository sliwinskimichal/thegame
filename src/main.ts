/**
 * Entry point. Debug query params:
 *   ?seed=123  ?x=..&y=..&d=.. (camera)  ?t=0.5 (time of day)  ?reveal=1
 */
import { GameRenderer } from './render/gameRenderer';
import { LightField } from './world/lighting';
import { TF } from './world/world';
import { generateWorld } from './world/worldgen';

const params = new URLSearchParams(location.search);
const num = (k: string, d: number) => (params.has(k) ? Number(params.get(k)) : d);

function boot(): void {
  const seed = num('seed', 20261125);
  const { world } = generateWorld({ seed });
  if (params.get('reveal') === '1') {
    for (let i = 0; i < world.size; i++) world.flags[i] = world.flags[i]! | TF.EXPLORED;
    world.markAllDirty();
  }
  const lightField = new LightField(world.w, world.h);
  const torches = [];
  for (let k = 0; k < 6; k++) {
    // a few test torches near the spawn
    const x = world.spawnX - 6 + k * 3;
    const y = world.spawnY + 6;
    world.dig(x, y);
    world.dig(x + 1, y);
    world.dig(x + 2, y);
    world.dig(x, y - 1);
    torches.push({ x, y, r: 2.6, g: 1.35, b: 0.5 });
  }
  lightField.compute(world, torches);
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const gr = new GameRenderer(canvas, world, lightField);
  gr.terrain.buildAll();
  gr.cam.jumpTo(num('x', world.spawnX), num('y', -world.spawnY + 2), num('d', 40));
  const tod = num('t', 0.42);
  document.getElementById('boot')?.remove();
  let last = performance.now();
  const start = last;
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    gr.frame(dt, (now - start) / 1000, tod);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  (window as unknown as { __game: unknown }).__game = { world, gr, lightField };
}

boot();
