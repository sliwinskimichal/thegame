// Debug dump for W2's own visual checks (only runs with ANIM_DUMP=<file>).
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { Animator } from '../../../src/render/anim/machine';
import { baseInput } from '../../../src/render/anim/metrics';
import { BONE_COUNT, CARRY } from '../../../src/render/anim/types';
import { makeRig, ROLES } from './fixture';
const out = process.env.ANIM_DUMP;
it.runIf(!!out)('dump poses', () => {
  const clips = (process.env.ANIM_CLIPS ?? 'idle,walk,jog,carry').split(',');
  const yaw = Number(process.env.ANIM_YAW ?? 0);
  const res: any[] = [];
  for (const role of ROLES) {
    const rig = makeRig(role, 7);
    for (const c of clips) {
      for (let k = 0; k < 8; k++) {
        const a = new Animator(rig, { viewYawDeg: yaw });
        const inp = baseInput(0.5, -1);
        if (c === 'carry') inp.carry = role === 'tragarz' ? CARRY.BACK : CARRY.HANDS;
        a.pose(c, k / 8, inp);
        const W: number[][] = [];
        const m = a.placement;
        for (let b = 0; b < BONE_COUNT; b++) {
          const o = b * 16;
          const x = a.bones[o + 12]!, y = a.bones[o + 13]!, z = a.bones[o + 14]!;
          const ax = [a.bones[o + 4]!, a.bones[o + 5]!, a.bones[o + 6]!];
          const tw = (px: number, py: number, pz: number) => [m[0]! * px + m[4]! * py + m[8]! * pz + m[12]!, m[1]! * px + m[5]! * py + m[9]! * pz + m[13]!, m[2]! * px + m[6]! * py + m[10]! * pz + m[14]!];
          const s = Math.hypot(a.bones[o]!, a.bones[o + 1]!, a.bones[o + 2]!);
          W.push([...tw(x, y, z), ...tw(x + ax[0]!, y + ax[1]!, z + ax[2]!), s]);
        }
        res.push({ role, clip: c, k, bones: W, tool: rig.toolR, toolL: rig.toolL });
      }
    }
  }
  writeFileSync(out!, JSON.stringify(res));
});
