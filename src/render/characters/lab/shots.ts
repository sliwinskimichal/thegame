/**
 * Fixed shot list of the dwarf tournament (owner: W3 "Technical artist", dwarf team). Every variant renders
 * exactly these shots: positions come from the stand layout (world.ts), so they follow CHARACTER_SCALE and
 * the REFERENCE height (contract v2), never the variant.
 * Content per SHOT_IDS (contract types.ts) and the brief §4.6 / contract v2 §12.
 */
import { CARRY, type ClipId } from '../../anim/types';
import { MOTION } from '../direction';
import { Rng } from '../../../core/rng';
import { ROLE, SHOT_IDS, SOCIAL, type RoleId, type ShotDef, type ShotDwarf, type ShotId, type SocialId } from '../types';
import { rungY, type StandLayout } from './world';

/** Work clip of each role (contract v2 §12: the smith and the carpenter build, the others dig). */
export const WORK_CLIP: readonly ClipId[] = ['dig', 'build', 'dig', 'build'];

/** Dig cycle phases from the concept card timing (windup 0.35 → hold 0.08 → strike 0.15 → recovery 0.32). */
export const DIG_CYCLE_S = MOTION.digWindup + MOTION.digHold + MOTION.digStrike + MOTION.digRecover;
export const DIG_APEX = (MOTION.digWindup + MOTION.digHold * 0.5) / DIG_CYCLE_S;
export const DIG_HIT = (MOTION.digWindup + MOTION.digHold + MOTION.digStrike) / DIG_CYCLE_S;
/** Walk cycle of the card: 2 steps per 0.9 s. */
export const WALK_CYCLE_S = 2 / MOTION.walkStepsPerSecond;

/** The 8 key poses of the silhouette shots (rest, 4 walk phases, windup apex, hit, climb). */
export function silPoses(role: RoleId): { clip: ClipId; phase: number }[] {
  const work = WORK_CLIP[role]!;
  return [
    { clip: 'idle', phase: 0 },
    { clip: 'walk', phase: 0 },
    { clip: 'walk', phase: 0.25 },
    { clip: 'walk', phase: 0.5 },
    { clip: 'walk', phase: 0.75 },
    { clip: work, phase: DIG_APEX },
    { clip: work, phase: DIG_HIT },
    { clip: 'climb', phase: 0.25 },
  ];
}

/** Rows of seq30 (8 consecutive 30 fps frames): clip, role, start phase, cycle seconds. */
export const SEQ30_ROWS: readonly { clip: ClipId; role: RoleId; start: number; cycleS: number }[] = [
  { clip: 'walk', role: ROLE.MINER, start: 0, cycleS: WALK_CYCLE_S },
  { clip: 'dig', role: ROLE.MINER, start: DIG_APEX - 0.06, cycleS: DIG_CYCLE_S },
  { clip: 'walk', role: ROLE.PORTER, start: 0.5, cycleS: WALK_CYCLE_S },
  { clip: 'build', role: ROLE.SMITH, start: DIG_APEX - 0.06, cycleS: DIG_CYCLE_S },
];

const ROLES: readonly RoleId[] = [ROLE.MINER, ROLE.CARPENTER, ROLE.PORTER, ROLE.SMITH];
/** Social accent per role in scene shots: every accent colour appears (PLEDGED has none on purpose). */
const SOCIAL_OF: readonly SocialId[] = [SOCIAL.FREE_MINER, SOCIAL.CROWN, SOCIAL.FREE_MINER, SOCIAL.MASTER];

const dw = (role: RoleId, seed: number, x: number, y: number, facing: 1 | -1, clip: ClipId, phase: number, extra: Partial<ShotDwarf> = {}): ShotDwarf => ({
  role,
  social: SOCIAL_OF[role]!,
  seed,
  x,
  y,
  facing,
  clip,
  phase,
  ...extra,
});

/** Carry kind per role when carrying: the porter's frame, a sack in the hands otherwise. */
export function carryOf(role: RoleId): number {
  return role === ROLE.PORTER ? CARRY.BACK : CARRY.HANDS;
}

/** Build all shot definitions from the stand layout. */
export function buildShots(L: StandLayout): Record<ShotId, ShotDef> {
  const u = L.u;
  const h = L.refH;
  const night = 0.92;
  const shots = {} as Record<ShotId, ShotDef>;
  const add = (s: ShotDef) => (shots[s.id] = s);

  // ------------------------------------------------------------------ izba: 4 roles idle in the lamp pool
  {
    const xs = [-1.95, -0.65, 0.65, 1.95].map((o) => L.izba.torchX + o * u);
    const facing: (1 | -1)[] = [1, 1, -1, -1];
    add({
      id: 'izba',
      namePl: 'Izba: cztery role w plamie lampy',
      kind: 'scene',
      zoom: 'izba',
      x: L.izba.torchX,
      y: L.izba.floorY + h * 0.62,
      tod: night,
      dwarves: ROLES.map((r, i) => dw(r, 101 + i, xs[i]!, L.izba.floorY, facing[i]!, 'idle', 0.15 * i)),
      metrics: ['contrast', 'accent'],
    });
  }
  // ------------------------------------------------------------------ grod: work in and out of the pool
  {
    const g = L.grod;
    const fy = g.floorY;
    const climbY = rungY(fy + h * 1.15);
    add({
      id: 'grod',
      namePl: 'Gród: przodek, noszenie, drabina, chód',
      kind: 'scene',
      zoom: 'grod',
      x: g.centerX,
      y: fy + h * 1.15,
      tod: night,
      dwarves: [
        dw(ROLE.MINER, 201, g.faceX - 0.45 * u, fy, 1, 'dig', DIG_HIT, { carry: CARRY.NONE }),
        dw(ROLE.PORTER, 202, g.torchX + 3.4 * u, fy, 1, 'carry', 0.3, { carry: CARRY.BACK }),
        dw(ROLE.CARPENTER, 203, g.shaft.x, climbY, 1, 'climb', 0.4),
        dw(ROLE.SMITH, 204, g.torchX - 1.6 * u, fy, -1, 'walk', 0.6),
      ],
      metrics: ['contrast', 'accent'],
    });
  }
  // ------------------------------------------------------------------ okolica: ~60 dwarves at work
  {
    const rng = new Rng(4242);
    const dwarves: ShotDwarf[] = [];
    let seed = 1000;
    const n = L.net;
    for (const f of n.faces) dwarves.push({ ...dw(ROLE.MINER, seed++, f.x - f.dir * 0.95 * u, f.floorY, f.dir, 'dig', rng.next()), social: SOCIAL.FREE_MINER });
    for (const s of n.shafts) {
      const k = 1 + Math.floor(rng.next() * 2);
      for (let j = 0; j < k; j++) {
        const y = rungY(s.yBottom + (s.yTop - s.yBottom) * rng.range(0.15, 0.8));
        dwarves.push(dw(rng.pick(ROLES), seed++, s.x, y, 1, 'climb', rng.next()));
      }
    }
    for (const hall of n.halls) for (let j = 0; j < 3; j++) dwarves.push(dw(rng.pick(ROLES), seed++, rng.range(hall.x0 + 0.8, hall.x1 - 0.8), hall.floorY, rng.sign() as 1 | -1, rng.chance(0.5) ? 'idle' : WORK_CLIP[ROLE.SMITH]!, rng.next()));
    for (const t of n.tunnels) {
      while (dwarves.length < 60 * ((n.tunnels.indexOf(t) + 1) / n.tunnels.length)) {
        const role = rng.pick(ROLES);
        const carrying = rng.chance(0.35);
        dwarves.push(dw(role, seed++, rng.range(t.x0 + 1.2, t.x1 - 1.2), t.floorY, rng.sign() as 1 | -1, carrying ? 'carry' : 'walk', rng.next(), carrying ? { carry: carryOf(role) } : {}));
      }
    }
    add({ id: 'okolica', namePl: 'Okolica: ~60 krasnoludów w sieci', kind: 'crowd', zoom: 'okolica', x: n.centerX, y: n.centerY, tod: night, dwarves: dwarves.slice(0, 60), metrics: [] });
  }
  // ------------------------------------------------------------------ strips: 8 phases k/8, one role per row
  const strip = (id: ShotId, namePl: string, rows: readonly [RoleId, ClipId][], extra: (r: RoleId) => Partial<ShotDwarf> = () => ({})) => {
    const dwarves: ShotDwarf[] = [];
    rows.forEach(([role, clip], ri) => {
      L.strips.xs.forEach((x, k) => dwarves.push(dw(role, 300 + ri * 10 + k, x, L.strips.floors[ri]!, 1, clip, k / 8, extra(role))));
    });
    add({ id, namePl, kind: 'strip', zoom: 'grod', x: L.strips.centerX, y: (L.strips.floors[0] + L.strips.floors[1]) / 2 + h * 0.5, tod: night, dwarves, metrics: [] });
  };
  strip('walk8', 'Chód: 8 faz (hajer, tragarz)', [
    [ROLE.MINER, 'walk'],
    [ROLE.PORTER, 'walk'],
  ]);
  strip('dig8', 'Kopanie: 8 faz (hajer kopie, kowal kuje)', [
    [ROLE.MINER, 'dig'],
    [ROLE.SMITH, 'build'],
  ]);
  strip(
    'carry8',
    'Noszenie: 8 faz (hajer z workiem, tragarz z nosidłem)',
    [
      [ROLE.MINER, 'carry'],
      [ROLE.PORTER, 'carry'],
    ],
    (r) => ({ carry: carryOf(r) }),
  );
  // ------------------------------------------------------------------ climb8: 8 ladders
  {
    const c = L.climb;
    const span = c.floorY - c.topY; // negative (top is higher)
    const rowsY = [c.floorY - span * 0.68, c.floorY - span * 0.22].map(rungY);
    const dwarves: ShotDwarf[] = [];
    [ROLE.MINER, ROLE.PORTER].forEach((role, ri) => c.ladders.forEach((x, k) => dwarves.push(dw(role, 400 + ri * 10 + k, x, rowsY[ri]!, 1, 'climb', k / 8))));
    add({ id: 'climb8', namePl: 'Wspinaczka: 8 faz na 8 drabinach (hajer, tragarz)', kind: 'strip', zoom: 'grod', x: c.centerX, y: (rowsY[0]! + rowsY[1]!) / 2 + h * 0.55, tod: night, dwarves, metrics: [] });
  }
  // ------------------------------------------------------------------ swiatlo: core of the pool vs its edge
  {
    const s = L.swiatlo;
    const dwarves = [
      ...ROLES.map((r, i) => dw(r, 501 + i, s.core[i]!, s.floorY, 1, 'idle', 0.1 * i)),
      ...ROLES.map((r, i) => dw(r, 511 + i, s.edge[i]!, s.floorY, 1, 'idle', 0.1 * i)),
    ];
    add({ id: 'swiatlo', namePl: 'Światło: w rdzeniu plamy i na jej skraju', kind: 'scene', zoom: 'grod', x: s.centerX, y: s.floorY + h * 1.3, tod: night, dwarves, metrics: ['contrast', 'accent'] });
  }
  // ------------------------------------------------------------------ silhouettes (black on white, no world)
  const silShot = (id: ShotId, zoom: 'grod' | 'okolica', namePl: string) => {
    const dx = 2 * u;
    const dy = 2.2 * u;
    const cx = L.strips.centerX;
    const top = L.strips.floors[0]! + 3 * dy * 0.5;
    const dwarves: ShotDwarf[] = [];
    ROLES.forEach((role, ri) => silPoses(role).forEach((p, k) => dwarves.push(dw(role, 600 + ri * 10 + k, cx + (k - 3.5) * dx, top - ri * dy, 1, p.clip, p.phase))));
    add({ id, namePl, kind: 'sil', zoom, x: cx, y: top - 1.5 * dy + h * 0.5, tod: night, dwarves, metrics: ['silhouette'] });
  };
  silShot('sil75', 'grod', 'Sylwetki ~75 px: 4 role × 8 póz');
  silShot('sil24', 'okolica', 'Sylwetki ~24 px: 4 role × 8 póz');
  {
    const dx = 2 * u;
    const dy = 2.2 * u;
    const cx = L.strips.centerX;
    const top = L.strips.floors[0]! + 3 * dy * 0.5;
    const dwarves: ShotDwarf[] = [];
    SEQ30_ROWS.forEach((row, ri) => {
      for (let k = 0; k < 8; k++) dwarves.push(dw(row.role, 700 + ri * 10, cx + (k - 3.5) * dx, top - ri * dy, 1, row.clip, (row.start + k / 30 / row.cycleS) % 1));
    });
    add({ id: 'seq30', namePl: 'Stabilność: 8 kolejnych klatek 30 kl./s', kind: 'sil', zoom: 'grod', x: cx, y: top - 1.5 * dy + h * 0.5, tod: night, dwarves, metrics: ['stability'] });
  }
  for (const id of SHOT_IDS) if (!shots[id]) throw new Error(`shot "${id}" has no definition`);
  return shots;
}

/** AnimInput fields for a posed shot dwarf (work target: the tile in front of the feet, chest height). */
export function workTarget(d: ShotDwarf, refH: number): { workX: number; workY: number } {
  return { workX: d.x + d.facing * refH * 0.75, workY: d.y + refH * 0.45 };
}
