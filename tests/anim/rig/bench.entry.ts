// Benchmark entry (W2): bundled by tests/anim/rig/locomotion.test.ts with rolldown and run in a
// separate Node process, so the numbers are those of production-bundled code (Vitest's module
// transform adds a ~2x overhead to cross-module calls in hot loops). Prints one JSON line.
import { Animator } from '../../../src/render/anim/machine';
import { baseInput } from '../../../src/render/anim/metrics';
import { MV, SIM, WORK } from '../../../src/render/anim/types';
import { makeRig, ROLES } from './fixture';

const N = 200;
const anims = Array.from({ length: N }, (_, i) => new Animator(makeRig(ROLES[i % 4]!, i + 1), { viewYawDeg: 40 }));
// a mixed crowd: 2/3 walking, the rest idle or digging
const inputs = anims.map((_, i) => {
  const inp = baseInput(0.5 + i, -1);
  if (i % 3 !== 2) {
    inp.sim = SIM.GOTO;
    inp.edge = { move: MV.WALK_R, fromX: 0.5 + i, fromY: -1, toX: 1.5 + i, toY: -1, t: 0, durationMs: 900, rows: 0 };
  } else if (i % 2 === 0) {
    inp.sim = SIM.WORK;
    inp.work = WORK.DIG;
  }
  return inp;
});
const frame = (f: number) => {
  for (let i = 0; i < N; i++) {
    const e = inputs[i]!.edge;
    if (e) e.t = ((f + i) % 54) / 54;
    anims[i]!.update(inputs[i]!, 1 / 60);
  }
};
for (let f = 0; f < 600; f++) frame(f);
const runs: number[] = [];
for (let r = 0; r < 3; r++) {
  const ts: number[] = [];
  for (let f = 0; f < 300; f++) {
    const t0 = performance.now();
    frame(f);
    ts.push(performance.now() - t0);
  }
  ts.sort((a, b) => a - b);
  runs.push(ts[ts.length >> 1]!);
}
runs.sort((a, b) => a - b);
console.log(JSON.stringify({ median: runs[1], runs }));
