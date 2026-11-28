/**
 * The dwarf animator (owner: W2): state machine + rig + secondary motion, allocation-free per update.
 *
 * Inputs come from the simulation as world values (tiles) and are divided by `worldPerModel`
 * before they reach clips and IK; the placement multiplies back (contract v2: the world scales to
 * the models). Per update:
 *   events -> latches · decide state · transition (snapshot blend) · root motion along the edge ·
 *   phase (distance / ladder lattice / edge t / time) · clip sample · layers (carry, pick-up, look up,
 *   danger glance) · finalize (beard scale, load, hidden) · placement · floor probe for planted
 *   feet · IK + FK · secondary springs · notifies.
 */
import { CHARACTER_SCALE, MOTION } from '../characters/direction';
import { CLIPS, type StrikeClip } from './clips/index';
import { breathPeriod } from './clips/idle';
import { carryStanding, carryType } from './clips/locomotion';
import { climbStandoff } from './clips/climb';
import type { AnimCtx } from './clips/common';
import { bump, easeInOut, frac } from './curves';
import { edgeRoot, isClimbMove, isDropMove, isLedgeMove, isStairMove, isWalkMove } from './edge';
import { AnimPose } from './pose';
import { Rig } from './rig';
import type { RigData } from './rigdata';
import { Secondary } from './secondary';
import {
  AS,
  BONE,
  BONE_COUNT,
  CARRY,
  IK,
  MV,
  NOTIFY,
  SIM,
  WORK,
  type AnimClip,
  type AnimEvent,
  type AnimInput,
  type AnimNotify,
  type AnimatorOptions,
  type AnimWorldProbe,
  type DwarfAnimator,
  type RigInput,
} from './types';

/** How a state advances its clip phase. */
const DRIVE = { TIME: 0, DIST: 1, LATTICE: 2, EDGE: 3 } as const;

/** Transition (blend) time into each state, seconds. Exported for the tests and the report. */
export const TRANSITION_IN: Readonly<Record<number, number>> = {
  [AS.HIDDEN]: 0,
  [AS.IDLE]: 0.22,
  [AS.WALK]: 0.2,
  [AS.CLIMB]: 0.2,
  [AS.LEDGE]: 0.12,
  [AS.STAIRS]: 0.15,
  [AS.DROP]: 0.1,
  [AS.LAND]: 0.05,
  [AS.DIG]: 0.15,
  [AS.BUILD]: 0.15,
  [AS.FLEE]: 0.08,
  [AS.STUNNED]: 0.12,
  [AS.RIDE]: 0.25,
};
/** Mirror turn when the facing changes (X scale through ~0, cos profile). */
export const TURN_SECONDS = 0.16;
/** Walk phase a walk starts from (left foot near mid-stance = close to the idle stance). */
const WALK_ENTRY_PHASE = 0.85;
const PICK_SECONDS = 0.42;
const PICK_BOTTOM = 0.16;
const LOOK_SECONDS = 1.6;
const NOTIFY_CAP = 32;

export interface StateInfo {
  clip: string;
  drive: number;
}

/** State -> clip and phase drive (the clip may be refined per frame: carry, flee). */
export const STATE_CLIP: Readonly<Record<number, StateInfo>> = {
  [AS.HIDDEN]: { clip: 'idle', drive: DRIVE.TIME },
  [AS.IDLE]: { clip: 'idle', drive: DRIVE.TIME },
  [AS.WALK]: { clip: 'walk', drive: DRIVE.DIST },
  [AS.CLIMB]: { clip: 'climb', drive: DRIVE.LATTICE },
  [AS.LEDGE]: { clip: 'ledge', drive: DRIVE.EDGE },
  [AS.STAIRS]: { clip: 'walk', drive: DRIVE.DIST },
  [AS.DROP]: { clip: 'drop', drive: DRIVE.EDGE },
  [AS.LAND]: { clip: 'land', drive: DRIVE.TIME },
  [AS.DIG]: { clip: 'dig', drive: DRIVE.TIME },
  [AS.BUILD]: { clip: 'build', drive: DRIVE.TIME },
  [AS.FLEE]: { clip: 'flee', drive: DRIVE.DIST },
  [AS.STUNNED]: { clip: 'stunned', drive: DRIVE.TIME },
  [AS.RIDE]: { clip: 'idle', drive: DRIVE.TIME },
};

/** Clip id -> the state pose() reports. */
const CLIP_STATE: Readonly<Record<string, number>> = {
  idle: AS.IDLE,
  walk: AS.WALK,
  jog: AS.WALK,
  carry: AS.WALK,
  flee: AS.FLEE,
  dig: AS.DIG,
  build: AS.BUILD,
  climb: AS.CLIMB,
  stunned: AS.STUNNED,
  ledge: AS.LEDGE,
  drop: AS.DROP,
  land: AS.LAND,
  cower: AS.FLEE,
};

function clipOr(id: string, fallback = 'idle'): AnimClip {
  return CLIPS[id] ?? CLIPS[fallback]!;
}

export class Animator implements DwarfAnimator {
  state: number = AS.IDLE;
  readonly bones = new Float32Array(BONE_COUNT * 16);
  readonly placement = new Float32Array(16);
  readonly rig: Rig;
  readonly d: RigData;
  /** World tiles per model unit. */
  readonly k: number;
  readonly viewYaw: number;
  readonly probe: AnimWorldProbe | null;
  /** Constant per-seed beard scale (crowd variety, ±10%). */
  readonly beardScale: number;

  private readonly sec: Secondary;
  private readonly ctx: AnimCtx;
  private readonly cur = new AnimPose();
  private readonly from = new AnimPose();
  /** The pose that was solved last (what is shown). */
  readonly out = new AnimPose();
  private clip: AnimClip;
  private drive: number = DRIVE.TIME;
  phase = 0;
  private prevPhase = 0;
  private blendT = 1;
  private blendDur = 0;
  private time = 0;
  // root (world)
  private wx = Number.NaN;
  private wy = 0;
  private wz = 0;
  private prevWx = Number.NaN;
  private prevWy = 0;
  /** Smoothed travel speed (model units / s). */
  speed = 0;
  private sx = 1;
  private turnFrom = 1;
  private turnT = 1;
  private facing: 1 | -1 = 1;
  // latches and layers
  private hiddenLatch = false;
  private digLatch = false;
  private digFinishing = false;
  private digStop = false;
  private landT = -1;
  private landRows = 0;
  private lastDropRows = 0;
  private stunT = 0;
  private lookT = -1;
  private pickT = -1;
  private pickKind: number = NOTIFY.PICK_UP;
  private pickFired = false;
  private crack = 0;
  private landPending = false;
  private carrying = 0;
  // notifies ring: kind, side, x, y, z, strength
  private readonly nq = new Float64Array(NOTIFY_CAP * 6);
  private nCount = 0;
  private readonly tmp = new Float64Array(8);

  constructor(input: RigInput, opts: AnimatorOptions) {
    this.rig = new Rig(input);
    this.d = this.rig.d;
    this.k = opts.worldPerModel ?? CHARACTER_SCALE.worldPerModel;
    this.viewYaw = (opts.viewYawDeg * Math.PI) / 180;
    this.probe = opts.probe ?? null;
    this.beardScale = 0.9 + 0.2 * this.d.seedC;
    this.sec = new Secondary(this.rig);
    this.ctx = {
      rig: input,
      speed: 0,
      carry: 0,
      aimX: Number.NaN,
      aimY: Number.NaN,
      probe: this.probe,
      viewYaw: this.viewYaw,
      danger: 0,
      time: 0,
      worldPerModel: this.k,
      slope: 0,
      rows: 0,
      rd: this.d,
    };
    this.clip = clipOr('idle');
    this.phase = this.d.seedA;
  }

  // ---------------------------------------------------------------------------------------------- public API
  update(input: AnimInput, dt: number, events?: readonly AnimEvent[]): void {
    if (!(dt >= 0)) dt = 0;
    this.time += dt;
    if (events) for (let i = 0; i < events.length; i++) this.onEvent(events[i]!);
    const target = this.decide(input);
    if (target !== this.state) this.enter(target, input);
    this.trackRoot(input, dt);
    this.advance(input, dt);
    this.cur.reset();
    this.clip.sample(this.ctx, this.phase, this.cur);
    this.layers(input, dt);
    if (this.blendT < this.blendDur) {
      this.out.lerp(this.from, this.cur, easeInOut(this.blendT / this.blendDur));
      this.blendT += dt;
    } else this.out.copy(this.cur);
    this.finalize(this.out);
    this.place(this.out);
    this.floorProbe(this.out);
    this.rig.solve(this.out);
    const jumped = Math.abs(this.wx - this.prevWx) > 0.5 || Math.abs(this.wy - this.prevWy) > 0.5;
    if (jumped || this.state === AS.HIDDEN) this.sec.reset();
    else this.sec.step(this.placement, this.out, dt);
    this.rig.write(this.bones);
    this.fireNotifies(dt);
    this.prevPhase = this.phase;
  }

  pose(clipId: string, phase: number, input: AnimInput): void {
    const clip = CLIPS[clipId];
    if (!clip) throw new Error(`pose: unknown clip '${clipId}'`);
    this.clip = clip;
    this.state = input.sim === SIM.BURIED || input.sim === SIM.DEAD ? AS.HIDDEN : (CLIP_STATE[clipId] ?? AS.IDLE);
    this.drive = clip.drive === 'distance' ? (clipId === 'climb' ? DRIVE.LATTICE : DRIVE.DIST) : DRIVE.TIME;
    this.facing = input.facing;
    this.sx = input.facing;
    this.turnT = 1;
    this.blendT = this.blendDur = 0;
    this.fillCtx(input);
    const ctx = this.ctx;
    ctx.speed = 0; // every clip uses its default speed in lab poses
    if (clipId === 'flee') ctx.danger = Math.max(ctx.danger, 1);
    if (clipId === 'carry') ctx.carry = carryType(ctx);
    this.carrying = clipId === 'carry' ? ctx.carry : 0;
    const len = clip.length(ctx);
    // root: given position (edges are ignored in lab poses), lattice snap for the ladder
    const baseX = input.x;
    let baseY = input.y;
    if (this.drive === DRIVE.LATTICE) baseY = this.latticeY(input.y, phase);
    const playZ = this.probe ? this.probe.playZ(baseY) : -0.45;
    this.wz = clipId === 'climb' ? this.ladderZ() : playZ;
    // pre-roll the springs over the previous 0.75 cycle so the beard and aprons lag like in motion
    const travelling = this.drive !== DRIVE.TIME;
    const cycleS = travelling ? len / Math.max(1e-6, this.clipSpeed(clipId)) : len;
    const N = 36;
    const span = 0.75;
    const dtS = (cycleS * span) / N;
    this.sec.reset();
    for (let i = N; i >= 0; i--) {
      const ph = phase - (span * i) / N;
      const back = len * span * (i / N) * this.k; // world distance behind (distance / lattice clips)
      if (this.drive === DRIVE.LATTICE) {
        this.wx = baseX;
        this.wy = baseY - back;
      } else if (travelling) {
        this.wx = baseX - this.facing * back;
        this.wy = baseY;
      } else {
        this.wx = baseX;
        this.wy = baseY;
      }
      ctx.time = (ph - Math.floor(ph)) * (travelling ? cycleS : len);
      this.phase = travelling || clip.loop ? frac(ph) : Math.max(0, ph);
      if (i === 0) this.phase = phase;
      this.cur.reset();
      clip.sample(ctx, this.phase, this.cur);
      if (clipId === 'idle' && input.carry > CARRY.NONE) carryStanding(ctx, this.cur);
      this.out.copy(this.cur);
      this.finalize(this.out);
      this.place(this.out);
      this.floorProbe(this.out);
      this.rig.solve(this.out);
      this.sec.step(this.placement, this.out, i === N ? 0 : dtS);
    }
    this.rig.write(this.bones);
    this.prevPhase = this.phase;
    this.prevWx = this.wx;
    this.prevWy = this.wy;
  }

  drainNotifies(out: AnimNotify[]): number {
    const n = this.nCount;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      const q = this.nq;
      let e = out[i];
      if (!e) {
        e = { kind: 0, side: 0, x: 0, y: 0, z: 0, strength: 0 };
        out[i] = e;
      }
      e.kind = q[o]!;
      e.side = q[o + 1]!;
      e.x = q[o + 2]!;
      e.y = q[o + 3]!;
      e.z = q[o + 4]!;
      e.strength = q[o + 5]!;
    }
    this.nCount = 0;
    return n;
  }

  canCancel(): boolean {
    if (this.state === AS.HIDDEN) return true;
    const w = this.clip.cancel;
    const p = this.phase;
    for (let i = 0; i < w.length; i++) if (p >= w[i]![0] && p < w[i]![1]) return true;
    return false;
  }

  lampWorld(out: Float32Array, o: number): boolean {
    if (this.state === AS.HIDDEN) return false;
    const l = this.d.input.lamp;
    const b = l.bone;
    const W = this.rig.W;
    if (Math.hypot(W[b * 16]!, W[b * 16 + 1]!, W[b * 16 + 2]!) < 1e-6) return false;
    const r = this.d.rest;
    const t = this.tmp;
    this.rig.point(b, l.offset[0] - r[b * 3]!, l.offset[1] - r[b * 3 + 1]!, l.offset[2] - r[b * 3 + 2]!, t, 0);
    const m = this.placement;
    out[o] = m[0]! * t[0]! + m[4]! * t[1]! + m[8]! * t[2]! + m[12]!;
    out[o + 1] = m[1]! * t[0]! + m[5]! * t[1]! + m[9]! * t[2]! + m[13]!;
    out[o + 2] = m[2]! * t[0]! + m[6]! * t[1]! + m[10]! * t[2]! + m[14]!;
    return true;
  }

  /** World position of a model-space point under the current placement (tests, notifies). */
  toWorld(x: number, y: number, z: number, out: Float64Array, o: number): void {
    const m = this.placement;
    out[o] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    out[o + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    out[o + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
  }

  get clipId(): string {
    return this.clip.id;
  }

  // ---------------------------------------------------------------------------------------------- events and states
  private onEvent(ev: AnimEvent): void {
    switch (ev.type) {
      case 'digStart':
        this.digLatch = false;
        this.digFinishing = false;
        this.digStop = false;
        break;
      case 'digCrack':
        this.crack = ev.stage;
        break;
      case 'digDone':
        if (this.state === AS.DIG || this.state === AS.BUILD) this.digFinishing = true;
        else this.digLatch = true;
        break;
      case 'digBlocked':
        this.digStop = true;
        break;
      case 'caveInWarning':
        this.lookT = 0;
        break;
      case 'fell':
        // the landing starts when the fall edge ends (or now, if the dwarf is not on a drop edge)
        this.landRows = ev.rows;
        if (this.state !== AS.DROP) this.landT = 0;
        break;
      case 'buried':
        this.hiddenLatch = true;
        break;
      case 'rescued':
        this.hiddenLatch = false;
        this.stunT = 1.5;
        break;
      case 'pickUp':
        this.pickT = 0;
        this.pickKind = NOTIFY.PICK_UP;
        this.pickFired = false;
        break;
      case 'putDown':
        this.pickT = 0;
        this.pickKind = NOTIFY.PUT_DOWN;
        this.pickFired = false;
        break;
    }
  }

  /** Target state from the sim input and the latches (priority order). */
  decide(input: AnimInput): number {
    const sim = input.sim;
    if (this.hiddenLatch || sim === SIM.BURIED || sim === SIM.DEAD) return AS.HIDDEN;
    if (sim === SIM.STUNNED || this.stunT > 0) return AS.STUNNED;
    const e = input.edge;
    if (e && isDropMove(e.move)) {
      this.lastDropRows = e.rows;
      return AS.DROP;
    }
    if (this.state === AS.DROP) {
      this.landT = 0;
      this.landRows = Math.max(this.landRows, this.lastDropRows);
    }
    if (this.landT >= 0 && this.landT < this.landSeconds()) return AS.LAND;
    if (e) {
      if (isWalkMove(e.move)) return sim === SIM.FLEE ? AS.FLEE : AS.WALK;
      if (isClimbMove(e.move)) return AS.CLIMB;
      if (isLedgeMove(e.move)) return AS.LEDGE;
      if (isStairMove(e.move)) return AS.STAIRS;
      if (e.move === MV.LINK) return AS.RIDE;
      return AS.WALK;
    }
    if (sim === SIM.FLEE) return AS.FLEE;
    // a strike in progress finishes (last hit + recovery) before anything calmer takes over
    if ((this.state === AS.DIG || this.state === AS.BUILD) && (this.digFinishing || this.digStop) && sim !== SIM.FLEE) return this.state;
    if (sim === SIM.WORK && !this.digLatch) {
      if (input.work === WORK.DIG) return AS.DIG;
      if (input.work === WORK.BUILD || input.work === WORK.CRAFT) return AS.BUILD;
    }
    return AS.IDLE;
  }

  private landSeconds(): number {
    return 0.28 + 0.07 * Math.min(4, Math.max(0, this.landRows));
  }

  private enter(s: number, input: AnimInput): void {
    const prev = this.state;
    this.from.copy(this.out);
    this.blendDur = prev === AS.HIDDEN ? 0 : (TRANSITION_IN[s] ?? 0.18);
    this.blendT = 0;
    this.state = s;
    const info = STATE_CLIP[s]!;
    this.clip = clipOr(info.clip);
    this.drive = this.clip.id === info.clip ? info.drive : DRIVE.TIME;
    if (s === AS.WALK || s === AS.FLEE || s === AS.STAIRS) {
      if (prev !== AS.WALK && prev !== AS.FLEE && prev !== AS.STAIRS) this.phase = WALK_ENTRY_PHASE;
    } else if (s === AS.IDLE) this.phase = frac(this.time / (2 * breathPeriod(this.d.input)) + this.d.seedA);
    else if (s === AS.DIG || s === AS.BUILD) {
      this.phase = 0; // digStart begins with the windup
      this.digFinishing = false;
      this.digStop = false;
    } else if (s === AS.LAND) {
      this.phase = 0;
      this.landPending = true;
    }
    else if (s === AS.STUNNED) this.phase = 0;
    else if (s === AS.HIDDEN) this.sec.reset();
    if (prev === AS.LAND) {
      this.landT = -1;
      this.landRows = 0;
    }
    void input;
    this.prevPhase = this.phase;
  }

  // ---------------------------------------------------------------------------------------------- root and phase
  private trackRoot(input: AnimInput, dt: number): void {
    const t = this.tmp;
    let tx = input.x;
    let ty = input.y;
    let edgeSpeed = 0;
    const e = input.edge;
    if (e) {
      edgeRoot(e, t);
      tx = t[0]!;
      ty = t[1]!;
      const len = Math.hypot(e.toX - e.fromX, e.toY - e.fromY);
      edgeSpeed = e.durationMs > 0 ? len / (e.durationMs / 1000) : 0;
      if (e.toX !== e.fromX) this.setFacing(e.toX > e.fromX ? 1 : -1);
    } else this.setFacing(input.facing);
    const first = Number.isNaN(this.wx);
    this.prevWx = first ? tx : this.wx;
    this.prevWy = first ? ty : this.wy;
    this.wx = tx;
    this.wy = ty;
    const zt = this.state === AS.CLIMB ? this.ladderZ() : this.probe ? this.probe.playZ(ty) : -0.45;
    this.wz = first || dt <= 0 ? zt : this.wz + (zt - this.wz) * (1 - Math.exp(-dt / 0.08));
    // speed (model units / s): the edge's nominal speed. Not smoothed on purpose: the stride follows
    // the speed, and a stride that changed during a stance would drag the planted foot.
    this.speed = edgeSpeed / this.k;
    // facing turn
    if (this.turnT < 1) {
      this.turnT = Math.min(1, this.turnT + dt / TURN_SECONDS);
      const c = this.turnFrom * Math.cos(Math.PI * this.turnT);
      this.sx = (c < 0 ? -1 : 1) * Math.max(0.12, Math.abs(c));
      if (this.turnT >= 1) this.sx = this.facing;
    }
  }

  private setFacing(f: 1 | -1): void {
    if (f === this.facing) return;
    this.facing = f;
    this.turnFrom = this.sx >= 0 ? 1 : -1;
    this.turnT = 0;
  }

  private advance(input: AnimInput, dt: number): void {
    this.fillCtx(input);
    const clip = this.clip;
    const s = this.state;
    this.drive = s === AS.CLIMB && clip.id === 'climb' ? DRIVE.LATTICE : (s === AS.LEDGE || s === AS.DROP) && clip.id !== 'idle' ? DRIVE.EDGE : clip.drive === 'distance' ? DRIVE.DIST : DRIVE.TIME;
    const len = clip.length(this.ctx);
    if (this.drive === DRIVE.DIST) {
      const dist = Math.abs(this.wx - this.prevWx) / this.k;
      this.phase = frac(this.phase + dist / Math.max(1e-6, len));
    } else if (this.drive === DRIVE.LATTICE) {
      this.phase = this.latticePhase(this.wy);
    } else if (this.drive === DRIVE.EDGE) {
      this.phase = input.edge ? Math.min(1, Math.max(0, input.edge.t)) : 1;
    } else if (s === AS.LAND) {
      this.landT += dt;
      this.phase = Math.min(1, this.landT / this.landSeconds());
    } else {
      let p = this.phase + dt / Math.max(1e-6, len);
      if (s === AS.DIG || s === AS.BUILD) {
        if (p >= 1 && (this.digFinishing || this.digStop)) {
          // the last strike and its recovery are done: hold the end, the next decide() leaves
          this.digLatch = true;
          this.digFinishing = false;
          this.digStop = false;
          p = 1;
        } else {
          if (p >= 1) p = frac(p);
          if (this.digStop && this.inCancel(p)) {
            this.digLatch = true;
            this.digStop = false;
          }
        }
      } else p = clip.loop ? frac(p) : Math.min(1, p);
      this.phase = p;
    }
    if (this.stunT > 0) this.stunT = Math.max(0, this.stunT - dt);
    if (this.lookT >= 0) {
      this.lookT += dt;
      if (this.lookT > LOOK_SECONDS) this.lookT = -1;
    }
    if (this.pickT >= 0) {
      this.pickT += dt;
      if (this.pickT > PICK_SECONDS) this.pickT = -1;
    }
  }

  private inCancel(p: number): boolean {
    const w = this.clip.cancel;
    for (let i = 0; i < w.length; i++) if (p >= w[i]![0] && p < w[i]![1]) return true;
    return false;
  }

  /** Ladder lattice: the climb phase is the root height over a rung (cycle = 2 rungs). */
  private rungSp(): number {
    return this.probe ? this.probe.ladder.rungSpacing : MOTION.rungSpacing;
  }
  private rungOff(): number {
    return this.probe ? this.probe.ladder.rungOffset : 0;
  }
  private latticePhase(wy: number): number {
    return frac((wy - this.rungOff()) / (2 * this.rungSp()));
  }
  private latticeY(y: number, phase: number): number {
    const sp = this.rungSp();
    const off = this.rungOff();
    // the cycle starts on the lattice point nearest to y, the phase climbs from it (strips rise steadily)
    const n = Math.round((y - off) / (2 * sp));
    return off + (n + phase) * 2 * sp;
  }
  private ladderZ(): number {
    const z = this.probe ? this.probe.ladder.z : -0.85;
    return z + climbStandoff(this.d) * this.k;
  }

  private clipSpeed(clipId: string): number {
    const c = this.ctx;
    if (clipId === 'climb') return (1 / 0.9) / this.k;
    if (clipId === 'jog' || clipId === 'flee') return 2.5 / this.k;
    return c.speed > 0 ? c.speed : 1.1 / this.k;
  }

  private fillCtx(input: AnimInput): void {
    const c = this.ctx;
    c.speed = this.speed;
    c.carry = input.carry;
    c.danger = input.danger;
    c.time = this.time;
    c.slope = 0;
    const e = input.edge;
    if (e && isStairMove(e.move) && e.toX !== e.fromX) c.slope = (e.toY - e.fromY) / Math.abs(e.toX - e.fromX);
    c.rows = e && isDropMove(e.move) ? Math.max(1, e.rows) : this.landRows;
    const rx = Number.isNaN(this.wx) ? input.x : this.wx;
    const ry = Number.isNaN(this.wx) ? input.y : this.wy;
    if (Number.isNaN(input.workX) || Number.isNaN(input.workY)) {
      c.aimX = 1 / this.k;
      c.aimY = 0.5 / this.k;
    } else {
      c.aimX = ((input.workX - rx) * this.facing) / this.k;
      c.aimY = (input.workY - ry) / this.k;
    }
    // walking clips: carry and flee flavours
    if (this.state === AS.WALK || this.state === AS.STAIRS || this.state === AS.FLEE) {
      const want = input.carry > CARRY.NONE ? 'carry' : this.state === AS.FLEE ? 'flee' : 'walk';
      if (this.clip.id !== want && this.clip.drive === 'distance' && CLIPS[want]) this.clip = CLIPS[want]!;
      if (this.state === AS.FLEE && !input.edge && CLIPS.cower) this.clip = CLIPS.cower;
    }
    this.carrying = input.carry;
  }

  // ---------------------------------------------------------------------------------------------- layers and output
  private layers(input: AnimInput, dt: number): void {
    const p = this.cur;
    const ctx = this.ctx;
    void dt;
    // standing with a load: carry layer over idle
    if (this.state === AS.IDLE && input.carry > CARRY.NONE) carryStanding(ctx, p);
    // pick up / put down: a short bend, the notify at the bottom
    if (this.pickT >= 0) {
      const w = bump(this.pickT / PICK_SECONDS, PICK_BOTTOM / PICK_SECONDS);
      const u = this.d.legUnit;
      p.pos[BONE.PELVIS * 3 + 1] -= 0.05 * u * w;
      p.rot[BONE.SPINE * 3 + 2] -= 0.3 * w;
      p.rot[BONE.CHEST * 3 + 2] -= 0.15 * w;
      p.rot[BONE.ARM_R * 3 + 2] += 0.5 * w;
      p.rot[BONE.ARM_L * 3 + 2] += 0.5 * w;
    }
    // look up at a cracking roof (event) or nervous glances with danger
    let look = 0;
    if (this.lookT >= 0) look = bump(this.lookT / LOOK_SECONDS, 0.25);
    else if (input.danger > 0.2 && this.state !== AS.FLEE) look = input.danger * bump(frac(this.time / 3.2 + this.d.seedA), 0.3) * 0.7;
    if (look > 0) {
      p.rot[BONE.HEAD * 3 + 2] += 0.5 * look;
      p.rot[BONE.CHEST * 3 + 2] += 0.1 * look;
      p.rot[BONE.SPINE * 3 + 2] += 0.04 * look;
    }
  }

  private finalize(p: AnimPose): void {
    p.scale[BONE.BEARD] *= this.beardScale;
    // the load is shown only while carried (pick-up: from the bottom of the bend; put-down: until it)
    let load = this.carrying > CARRY.NONE ? 1 : 0;
    if (this.pickT >= 0 && this.pickT < PICK_BOTTOM) load = this.pickKind === NOTIFY.PICK_UP ? 0 : 1;
    p.scale[BONE.LOAD] = load;
    if (this.state === AS.HIDDEN) p.scale[BONE.ROOT] = 0;
  }

  /** placement = T(world root + k M offset) · S(k) · M(sx) · Ry(root yaw - view yaw). */
  private place(p: AnimPose): void {
    const k = this.k;
    const yaw = p.root[3]! - this.viewYaw;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const m = this.placement;
    const sx = this.sx;
    m[0] = k * sx * c;
    m[1] = 0;
    m[2] = -k * s;
    m[3] = 0;
    m[4] = 0;
    m[5] = k;
    m[6] = 0;
    m[7] = 0;
    m[8] = k * sx * s;
    m[9] = 0;
    m[10] = k * c;
    m[11] = 0;
    m[12] = this.wx + k * sx * p.root[0]!;
    m[13] = this.wy + k * p.root[1]!;
    m[14] = this.wz + k * p.root[2]!;
    m[15] = 1;
  }

  /** Planted feet follow the floor under them (steps, uneven ground) when a probe is given. */
  private floorProbe(p: AnimPose): void {
    const pr = this.probe;
    const st = this.state;
    if (!pr || st === AS.CLIMB || st === AS.DROP || st === AS.LEDGE || st === AS.HIDDEN || st === AS.STAIRS) return;
    const k = this.k;
    const m = this.placement;
    const lim = 0.32 * this.d.unit;
    for (let s = 0; s < 2; s++) {
      const e = s === 0 ? IK.FOOT_R : IK.FOOT_L;
      if (p.ikW[e]! <= 0) continue;
      // probe under the middle of the sole (ankle + half the boot, along the toe-out)
      const yaw = p.rot[(s === 0 ? BONE.FOOT_R : BONE.FOOT_L) * 3 + 1]!;
      const half = 0.5 * (this.d.heelX + this.d.toeX);
      const px = p.ik[e * 4]! + half * Math.cos(yaw);
      const pz = p.ik[e * 4 + 2]! - half * Math.sin(yaw);
      const wx = m[0]! * px + m[8]! * pz + m[12]!;
      const f = pr.floorAt(wx, this.wy);
      if (Number.isNaN(f)) continue;
      let dy = (f - this.wy) / k - p.root[1]!;
      if (dy > lim) dy = lim;
      if (dy < -lim) dy = -lim;
      p.ik[e * 4 + 1] += dy;
      p.pivot[s * 3 + 1] += dy;
    }
  }

  private emit(kind: number, side: number, x: number, y: number, z: number, strength: number): void {
    if (this.nCount >= NOTIFY_CAP) return;
    const o = this.nCount * 6;
    const q = this.nq;
    q[o] = kind;
    q[o + 1] = side;
    q[o + 2] = x;
    q[o + 3] = y;
    q[o + 4] = z;
    q[o + 5] = strength;
    this.nCount++;
  }

  private fireNotifies(dt: number): void {
    const t = this.tmp;
    if (this.pickT >= PICK_BOTTOM && !this.pickFired) {
      this.pickFired = true;
      this.rig.point(BONE.LOAD, 0, 0, 0, t, 0);
      this.toWorld(t[0]!, t[1]!, t[2]!, t, 0);
      this.emit(this.pickKind, 0, t[0]!, t[1]!, t[2]!, 0.6);
    }
    if (this.landPending) {
      this.landPending = false;
      this.toWorld(0, 0, 0, t, 0);
      this.emit(NOTIFY.LAND, 0, t[0]!, t[1]!, t[2]!, Math.min(1, Math.max(0.2, this.landRows / 4)));
    }
    if (dt <= 0) return;
    const a = this.prevPhase;
    const b = this.phase;
    if (a === b) return;
    const list = this.clip.notifies;
    const backward = this.drive === DRIVE.LATTICE && frac(b - a) > 0.5;
    for (let i = 0; i < list.length; i++) {
      const n = list[i]!;
      const ph = n.phase;
      let hit: boolean;
      if (!backward) hit = a <= b ? ph > a && ph <= b : ph > a || ph <= b;
      else hit = b <= a ? ph >= b && ph < a : ph >= b || ph < a;
      // a dig that just ended at phase 1 fires its hit only once
      if (hit) this.notifyAt(n.kind, n.side);
    }
  }

  private notifyAt(kind: number, side: number): void {
    const t = this.tmp;
    const p = this.out;
    let strength = 0.6;
    if (kind === NOTIFY.FOOT_DOWN) {
      if (this.state === AS.CLIMB) {
        const e = side === 0 ? IK.FOOT_R : IK.FOOT_L;
        this.toWorld(p.ik[e * 4]!, p.ik[e * 4 + 1]! - this.d.ankleY, p.ik[e * 4 + 2]!, t, 0);
      } else this.toWorld(p.pivot[side * 3]!, p.pivot[side * 3 + 1]!, p.pivot[side * 3 + 2]!, t, 0);
      strength = Math.min(1, 0.45 + (this.carrying > 0 ? 0.3 : 0) + 0.25 * Math.min(1, this.speed * this.k / 2.5));
    } else if (kind === NOTIFY.RUNG_GRAB) {
      const e = side === 0 ? IK.HAND_R : IK.HAND_L;
      this.toWorld(p.ik[e * 4]!, p.ik[e * 4 + 1]!, p.ik[e * 4 + 2]!, t, 0);
      strength = 0.4;
    } else if (kind === NOTIFY.DIG_HIT) {
      const c = this.clip as Partial<StrikeClip>;
      if (c.strike) c.strike(this.ctx, t);
      else this.rig.point(BONE.TOOL_R, 0, 0, 0, t, 0);
      this.toWorld(t[0]!, t[1]!, t[2]!, t, 0);
      strength = this.digFinishing || this.digLatch ? 1 : 0.7 + 0.1 * Math.min(3, this.crack);
    } else {
      this.rig.point(BONE.TOOL_R, 0, 0, 0, t, 0);
      this.toWorld(t[0]!, t[1]!, t[2]!, t, 0);
      strength = 0.5;
    }
    this.emit(kind, side, t[0]!, t[1]!, t[2]!, strength);
  }
}

