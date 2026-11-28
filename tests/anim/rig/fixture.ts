// Test fixture (W2): a RigInput built straight from referenceJoints, with stand-in tools per role
// (W1 delivers the real ones; the rig reads only RigInput, so the tests do not wait for the model).
import { HOLD, type RigInput, type ToolInfo } from '../../../src/render/anim/types';
import { BONE } from '../../../src/render/anim/types';
import { PROPORTION_PRESETS, referenceJoints } from '../../../src/render/characters/direction';
import type { Proportions } from '../../../src/render/characters/types';

export type RoleName = 'hajer' | 'ciesla' | 'tragarz' | 'kowal';

const PICK: ToolInfo = { kind: 'pick', length: 0.75, gripL: 0.32, head: 0.7, strike: [0.19, 0.7, 0] };
const AXE: ToolInfo = { kind: 'axe', length: 0.55, gripL: 0.24, head: 0.5, strike: [0.13, 0.5, 0] };
const HAMMER: ToolInfo = { kind: 'hammer', length: 0.45, gripL: 0, head: 0.4, strike: [0.09, 0.4, 0] };
const TONGS: ToolInfo = { kind: 'tongs', length: 0.42, gripL: 0, head: 0.38, strike: [0.03, 0.4, 0] };

/** Scale every length of a proportion set (the "world scales to the models" check). */
export function scaled(p: Proportions, k: number): Proportions {
  const o: Record<string, number> = {};
  for (const [key, val] of Object.entries(p)) o[key] = key === 'heads' ? val : val * k;
  return o as unknown as Proportions;
}

export function makeRig(role: RoleName = 'hajer', seed = 7, p: Proportions = PROPORTION_PRESETS.A): RigInput {
  const rest = referenceJoints(p);
  const crown = p.heads * p.headH;
  const chinY = rest[BONE.HEAD * 3 + 1]!;
  const lantern: [number, number, number] = [rest[BONE.LANTERN * 3]!, rest[BONE.LANTERN * 3 + 1]! - 0.08, rest[BONE.LANTERN * 3 + 2]!];
  const base = { rest, seed, front: 'none' as const, back: 'none' as const };
  switch (role) {
    case 'hajer':
      return {
        ...base,
        toolR: PICK,
        toolL: null,
        hold: HOLD.TOOL_SHOULDER,
        back: 'apron',
        lamp: { bone: BONE.HEAD, offset: [0.02 + p.headH * 0.45, crown - 0.03, 0], color: [1, 0.85, 0.56], radius: 2 },
      };
    case 'ciesla':
      return { ...base, toolR: AXE, toolL: null, hold: HOLD.BEAM_SHOULDER, back: 'beam', lamp: { bone: BONE.LANTERN, offset: lantern, color: [1, 0.85, 0.56], radius: 1.5 } };
    case 'tragarz':
      return { ...base, toolR: null, toolL: null, hold: HOLD.FRAME_STRAPS, back: 'frame', lamp: { bone: BONE.LANTERN, offset: lantern, color: [1, 0.85, 0.56], radius: 1.5 } };
    case 'kowal':
      return {
        ...base,
        toolR: HAMMER,
        toolL: TONGS,
        hold: HOLD.TWO_TOOLS,
        front: 'apron',
        lamp: { bone: BONE.LANTERN, offset: [lantern[0], lantern[1], lantern[2]], color: [1, 0.85, 0.56], radius: 1.5 },
      };
  }
  void chinY;
}

export const ROLES: readonly RoleName[] = ['hajer', 'ciesla', 'tragarz', 'kowal'];
