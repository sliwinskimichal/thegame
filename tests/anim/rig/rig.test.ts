// W2: forward kinematics against three.js, two-bone IK, pelvis drop, slung tools.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Rig } from '../../../src/render/anim/rig';
import { AnimPose, setIK } from '../../../src/render/anim/pose';
import { BONE, BONE_COUNT, BONE_PARENT, IK } from '../../../src/render/anim/types';
import { Rng } from '../../../src/core/rng';
import { makeRig } from './fixture';

function threeBones(rest: Float32Array, p: AnimPose): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  for (let b = 0; b < BONE_COUNT; b++) {
    const par = BONE_PARENT[b]!;
    const t = new THREE.Vector3(
      rest[b * 3]! - (par >= 0 ? rest[par * 3]! : 0) + p.pos[b * 3]!,
      rest[b * 3 + 1]! - (par >= 0 ? rest[par * 3 + 1]! : 0) + p.pos[b * 3 + 1]!,
      rest[b * 3 + 2]! - (par >= 0 ? rest[par * 3 + 2]! : 0) + p.pos[b * 3 + 2]!,
    );
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rot[b * 3]!, p.rot[b * 3 + 1]!, p.rot[b * 3 + 2]!, 'ZYX'));
    const s = p.scale[b]!;
    const local = new THREE.Matrix4().compose(t, q, new THREE.Vector3(s, s, s));
    out.push(par >= 0 ? out[par]!.clone().multiply(local) : local);
  }
  return out;
}

const pos = (rig: Rig, b: number) => new THREE.Vector3(rig.W[b * 16 + 12], rig.W[b * 16 + 13], rig.W[b * 16 + 14]);

describe('rig: forward kinematics', () => {
  it('matches THREE.Matrix4 / Euler(ZYX) for random poses', () => {
    const input = makeRig('hajer');
    const rig = new Rig(input);
    const rng = new Rng(42);
    const p = new AnimPose();
    for (let trial = 0; trial < 25; trial++) {
      p.reset();
      for (let i = 0; i < p.rot.length; i++) p.rot[i] = (rng.next() - 0.5) * 2.4;
      for (let i = 0; i < p.pos.length; i++) p.pos[i] = (rng.next() - 0.5) * 0.1;
      for (let b = 0; b < BONE_COUNT; b++) p.scale[b] = 0.7 + rng.next() * 0.6;
      rig.solve(p);
      const ref = threeBones(input.rest, p);
      for (let b = 0; b < BONE_COUNT; b++) {
        const e = ref[b]!.elements;
        for (let k = 0; k < 16; k++) expect(Math.abs(rig.W[b * 16 + k]! - e[k]!)).toBeLessThan(1e-9);
      }
    }
  });

  it('rest pose puts every bone at its rest joint; scale 0 hides children', () => {
    const input = makeRig('kowal');
    const rig = new Rig(input);
    const p = new AnimPose();
    rig.solve(p);
    for (let b = 0; b < BONE_COUNT; b++) for (let k = 0; k < 3; k++) expect(rig.W[b * 16 + 12 + k]).toBeCloseTo(input.rest[b * 3 + k]!, 9);
    p.scale[BONE.HAND_R] = 0;
    rig.solve(p);
    // the tool under the hand collapses (zero basis)
    expect(Math.hypot(rig.W[BONE.TOOL_R * 16]!, rig.W[BONE.TOOL_R * 16 + 1]!, rig.W[BONE.TOOL_R * 16 + 2]!)).toBe(0);
  });
});

describe('rig: two-bone IK', () => {
  const input = makeRig('hajer');
  const rig = new Rig(input);
  const d = rig.d;
  const p = new AnimPose();

  it('hits reachable foot targets to 1e-4 with the knee forward, sole pitch honoured', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 40; i++) {
      p.reset();
      // inside 0.95 of the reach below the hip (no pelvis drop needed)
      const r = d.legReach * (0.55 + 0.4 * rng.next());
      const a0 = (rng.next() - 0.5) * 1.6;
      const tx = Math.sin(a0) * r;
      const ty = d.hipY - Math.cos(a0) * r;
      const tz = d.hipZ + (rng.next() - 0.5) * 0.04;
      const pitch = (rng.next() - 0.5) * 0.8;
      setIK(p, IK.FOOT_R, tx, ty, tz, pitch, 1);
      rig.solve(p);
      expect(rig.lastDrop).toBe(0);
      const a = pos(rig, BONE.FOOT_R);
      expect(a.distanceTo(new THREE.Vector3(tx, ty, tz))).toBeLessThan(1e-4);
      // knee in front of the hip-ankle line
      const hip = pos(rig, BONE.THIGH_R);
      const knee = pos(rig, BONE.SHIN_R);
      const mid = hip.clone().lerp(a, d.thigh / d.legReach);
      expect(knee.x).toBeGreaterThan(mid.x - 1e-9);
      // foot sole pitch: the foot's +X axis rotated by pitch in the side plane
      const fx = new THREE.Vector3(rig.W[BONE.FOOT_R * 16], rig.W[BONE.FOOT_R * 16 + 1], rig.W[BONE.FOOT_R * 16 + 2]);
      expect(Math.atan2(fx.y, fx.x)).toBeCloseTo(pitch, 6);
    }
  });

  it('straightens toward an unreachable target', () => {
    p.reset();
    // 1 leg length forward of the hip at hip height: unreachable, the pelvis drop is capped
    setIK(p, IK.FOOT_R, d.legReach * 1.6, d.hipY, d.hipZ, 0, 1);
    rig.solve(p);
    const hip = pos(rig, BONE.THIGH_R);
    const knee = pos(rig, BONE.SHIN_R);
    const ank = pos(rig, BONE.FOOT_R);
    expect(hip.distanceTo(ank)).toBeCloseTo(d.legReach, 4);
    // collinear: knee on the hip-ankle segment
    const t = d.thigh / d.legReach;
    expect(knee.distanceTo(hip.clone().lerp(ank, t))).toBeLessThan(1e-4);
  });

  it('drops the pelvis when a foot target is below reach', () => {
    p.reset();
    setIK(p, IK.FOOT_R, 0, d.ankleY - 0.05, d.hipZ, 0, 1);
    setIK(p, IK.FOOT_L, 0, d.ankleY, -d.hipZ, 0, 1);
    rig.solve(p);
    expect(rig.lastDrop).toBeGreaterThan(0.045);
    expect(pos(rig, BONE.FOOT_R).distanceTo(new THREE.Vector3(0, d.ankleY - 0.05, d.hipZ))).toBeLessThan(1e-4);
    expect(pos(rig, BONE.FOOT_L).distanceTo(new THREE.Vector3(0, d.ankleY, -d.hipZ))).toBeLessThan(1e-4);
  });

  it('puts the fist (tool socket) on a hand target with the hand pitch in root space; elbow back', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 40; i++) {
      p.reset();
      // inside 0.9 of the arm reach around the right shoulder, in front of it
      const r = d.armReach * (0.45 + 0.45 * rng.next());
      const az = (rng.next() - 0.5) * 2.6;
      const el = (rng.next() - 0.5) * 1.2;
      const tx = Math.cos(el) * Math.cos(az) * r * 0.9 + 0.02;
      const ty = d.shoulderY + Math.sin(az) * Math.cos(el) * r;
      const tz = d.shoulderZ + Math.sin(el) * r;
      const pitch = (rng.next() - 0.5) * 3;
      setIK(p, IK.HAND_R, tx, ty, tz, pitch, 1);
      rig.solve(p);
      const fist = pos(rig, BONE.TOOL_R);
      expect(fist.distanceTo(new THREE.Vector3(tx, ty, tz))).toBeLessThan(1e-4);
      const hy = new THREE.Vector3(rig.W[BONE.HAND_R * 16 + 4], rig.W[BONE.HAND_R * 16 + 5], rig.W[BONE.HAND_R * 16 + 6]);
      expect(Math.atan2(-hy.x, hy.y)).toBeCloseTo(pitch > Math.PI ? pitch - 2 * Math.PI : pitch, 5);
    }
  });

  it('slings the tool onto the back (child of the chest) and blends', () => {
    p.reset();
    p.attach[0] = 1;
    rig.solve(p);
    const t = pos(rig, BONE.TOOL_R);
    expect(t.x).toBeLessThan(-d.chestR * 0.9);
    // follows the chest
    p.rot[BONE.SPINE * 3 + 2] = -0.4;
    rig.solve(p);
    const t2 = pos(rig, BONE.TOOL_R);
    expect(t2.distanceTo(t)).toBeGreaterThan(0.05);
  });
});
