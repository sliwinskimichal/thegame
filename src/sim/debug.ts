/**
 * Text views of the world-change state for logs, tests and bug reports (no render dependency).
 *   #  solid rock        .  open          ~  water        ^  lava
 *   r  rubble            b  built tile    T  braced support   t  support without effect
 *   0-9 roof stress in tenths of capacity (9 = 90-100%)   !  failing roof (countdown running)
 *   X  tile being dug (a dig job)
 */
import { SOLID } from '../world/materials';
import { FLUID } from '../world/world';
import { TAG } from './world/mutate';
import type { WorldSim } from './worldsim';

export function asciiWorld(sim: WorldSim, x0 = 0, y0 = 0, x1 = sim.world.w - 1, y1 = sim.world.h - 1): string {
  const { world: w, structure: st, dig, mut } = sim;
  const lines: string[] = [];
  for (let y = Math.max(0, y0); y <= Math.min(w.h - 1, y1); y++) {
    let s = '';
    for (let x = Math.max(0, x0); x <= Math.min(w.w - 1, x1); x++) {
      const i = y * w.w + x;
      if (SOLID[w.mat[i]!]) {
        if (dig.jobAt(x, y)) s += 'X';
        else if (st.timer[i]) s += '!';
        else if (y + 1 < w.h && !SOLID[w.mat[i + w.w]!] && st.stress[i]) s += String(Math.min(9, Math.floor(st.stress[i]! / 10)));
        else if (mut.tag[i]! & TAG.RUBBLE) s += 'r';
        else if (mut.tag[i]! & TAG.BUILT) s += 'b';
        else s += '#';
      } else if (st.support[i]) s += st.supportStatus(x, y) === 'ok' ? 'T' : 't';
      else if (w.fluid[i]) s += w.fluidKind[i] === FLUID.LAVA ? '^' : '~';
      else s += '.';
    }
    lines.push(s);
  }
  return lines.join('\n');
}
