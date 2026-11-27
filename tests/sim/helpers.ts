/** Synthetic worlds and event recorders for the sim tests. */
import { EventBus } from '../../src/core/events';
import type { SimEvents } from '../../src/sim/events';
import { M } from '../../src/world/materials';
import { CAV, TF, World } from '../../src/world/world';

/** w x h explored world: `sky` rows of open sky on top, then solid `rock` (bg = rock). */
export function slab(w: number, h: number, rock: number = M.LIMESTONE, sky = 0): World {
  const wd = new World(w, h, 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      wd.flags[i] = TF.EXPLORED;
      if (y < sky) {
        wd.mat[i] = wd.bg[i] = M.AIR;
        wd.cav[i] = CAV.SKY;
        wd.depth[i] = 255;
      } else {
        wd.mat[i] = wd.bg[i] = rock;
        wd.cav[i] = CAV.SOLID;
      }
    }
  for (let x = 0; x < w; x++) wd.surface[x] = sky;
  return wd;
}

/** Open the rectangle [x0, x1] x [y0, y1] as a dug (or natural) cavity, keeping bg as the back wall. */
export function carve(wd: World, x0: number, y0: number, x1: number, y1: number, cav: number = CAV.DUG): World {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * wd.w + x;
      if (!wd.bg[i]) wd.bg[i] = wd.mat[i]!;
      wd.mat[i] = M.AIR;
      wd.cav[i] = cav;
      wd.depth[i] = cav === CAV.NATURAL ? 64 : 32;
    }
  return wd;
}

export type Logged = { [K in keyof SimEvents]: { type: K; e: SimEvents[K] } }[keyof SimEvents];

/** Record every event of the listed types, in delivery order. */
export function record(bus: EventBus<SimEvents>, types: readonly (keyof SimEvents)[]) {
  const log: Logged[] = [];
  for (const t of types) bus.on(t, (e) => log.push({ type: t, e } as Logged));
  return {
    log,
    of<K extends keyof SimEvents>(t: K): SimEvents[K][] {
      return log.filter((l) => l.type === t).map((l) => l.e as SimEvents[K]);
    },
    clear() {
      log.length = 0;
    },
  };
}
