import { it } from 'vitest';
import { measureSlip, seamJump } from '../../../src/render/anim/metrics';
import { conceptSpeed } from '../../../src/render/anim/gait';
import { rigData } from '../../../src/render/anim/rigdata';
import { Animator } from '../../../src/render/anim/machine';
import { baseInput } from '../../../src/render/anim/metrics';
import { MV, SIM } from '../../../src/render/anim/types';
import { makeRig } from './fixture';
it('probe', () => {
  const rig = makeRig('hajer');
  console.log('concept', conceptSpeed(rigData(rig)));
  for (const v of [0.3, 0.62, 1.1, 1.6, 2.0, 2.5]) {
    const r = measureSlip(rig, v);
    // pelvis drop stats
    const a = new Animator(rig, { viewYawDeg: 40 });
    const input = baseInput(); input.sim = SIM.GOTO; const tileMs = 1000 / v;
    const edge = { move: MV.WALK_R, fromX: 0.5, fromY: -1, toX: 1.5, toY: -1, t: 0, durationMs: tileMs, rows: 0 }; input.edge = edge;
    let maxDrop = 0;
    for (let i = 0; i < 600; i++) { const ms = i * 1000 / 120; const st = Math.floor(ms / tileMs); edge.fromX = 0.5 + st; edge.toX = 1.5 + st; edge.t = (ms - st * tileMs) / tileMs; a.update(input, 1 / 120); if (i > 120) maxDrop = Math.max(maxDrop, a.rig.lastDrop); }
    console.log(v, 'slip', r.slip.toFixed(4), 'stride', r.stride.toFixed(3), 'steps/s', r.stepsPerSecond.toFixed(2), 'footDowns', r.footDowns, 'cycles', r.cycles.toFixed(2), 'maxDrop', maxDrop.toFixed(4));
  }
  console.log(JSON.stringify(seamJump(rig)));
});
