// Crowd renderer (owner: W3) in Node: buckets, draw calls, bone rows, instance data, lights, modes.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BONE_COUNT, type AnimInput, type AnimNotify, type DwarfAnimator, type RigInput } from '../../../src/render/anim/types';
import { referenceJoints, PROPORTIONS_A } from '../../../src/render/characters/direction';
import { readSkinMatrix } from '../../../src/render/characters/render/boneTexture';
import { CrowdRenderer, INSTANCE_STRIDE, type CrowdMemberEx } from '../../../src/render/characters/render/crowd';
import { buildFixture, fixtureSpec, FIXTURE_VARIANTS, partsForLod } from '../../../src/render/characters/render/fixture';
import { neutralStyleUniforms } from '../../../src/render/characters/render/materials';
import { MESH_ATTRIBUTES, ROLE, SOCIAL, type DwarfModel, type RoleId } from '../../../src/render/characters/types';

/** Minimal animator for renderer tests: rest pose, placement T(x, y, z) * S(facing, 1, 1). */
class RestAnim implements DwarfAnimator {
  state = 1;
  readonly bones = new Float32Array(BONE_COUNT * 16);
  readonly placement = new Float32Array(16);
  constructor(private rig: RigInput) {
    for (let b = 0; b < BONE_COUNT; b++) new THREE.Matrix4().makeTranslation(rig.rest[b * 3]!, rig.rest[b * 3 + 1]!, rig.rest[b * 3 + 2]!).toArray(this.bones, b * 16);
  }
  place(x: number, y: number, facing: 1 | -1): this {
    new THREE.Matrix4().makeTranslation(x, y, -0.45).multiply(new THREE.Matrix4().makeScale(facing, 1, 1)).toArray(this.placement);
    return this;
  }
  update(_i: AnimInput): void {}
  pose(_c: string, _p: number, i: AnimInput): void {
    this.place(i.x, i.y, i.facing);
  }
  drainNotifies(_o: AnimNotify[]): number {
    return 0;
  }
  canCancel(): boolean {
    return true;
  }
  lampWorld(out: Float32Array, o: number): boolean {
    const v = new THREE.Vector3(...this.rig.lamp.offset).applyMatrix4(new THREE.Matrix4().fromArray(this.placement));
    out[o] = v.x;
    out[o + 1] = v.y;
    out[o + 2] = v.z;
    return true;
  }
}

const roles: RoleId[] = [ROLE.MINER, ROLE.CARPENTER, ROLE.PORTER, ROLE.SMITH];
const templates = (mode: 'welded' | 'parts') => roles.map((r) => buildFixture('t', fixtureSpec(1 + r, r, SOCIAL.FREE_MINER), mode));
function members(models: DwarfModel[], n: number, x0 = 0): CrowdMemberEx[] {
  return Array.from({ length: n }, (_, k) => {
    const t = models[k % 4]!;
    const spec = fixtureSpec(100 + k, t.spec.role, SOCIAL.CROWN);
    const model = { ...t, spec, rig: { ...t.rig, seed: 100 + k } };
    return { model, anim: new RestAnim(model.rig).place(x0 + (k % 20) * 1.5, -Math.floor(k / 20) * 3, k % 3 ? 1 : -1), visible: true };
  });
}
function camera(z = 18): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 1200);
  c.position.set(14, -12, z);
  c.lookAt(14, -12, -0.5);
  c.updateMatrixWorld();
  return c;
}
const lights = () => ({ pos: Array.from({ length: 12 }, () => new THREE.Vector4()), col: Array.from({ length: 12 }, () => new THREE.Vector4()), count: { value: 0 } });

describe('fixture model (renderer stand-in)', () => {
  it('builds 4 roles x 3 LODs with the mesh attribute contract, deterministically', () => {
    for (const v of FIXTURE_VARIANTS) {
      for (const r of roles) {
        const a = v.build(fixtureSpec(5, r, SOCIAL.FREE_MINER));
        const b = v.build(fixtureSpec(5, r, SOCIAL.FREE_MINER));
        for (let l = 0; l < 3; l++) {
          const m = a.lods[l as 0 | 1 | 2];
          expect(m.triangles).toBeGreaterThan(0);
          if (m.mode === 'welded') {
            for (const name of MESH_ATTRIBUTES) expect(m.geometry!.getAttribute(name), name).toBeDefined();
            expect([...(m.geometry!.getAttribute('position')!.array as Float32Array)]).toEqual([...(b.lods[l as 0 | 1 | 2].geometry!.getAttribute('position')!.array as Float32Array)]);
            expect(m.hull).not.toBeNull();
          } else expect(m.parts!.length).toBeGreaterThan(10);
        }
        // body joints are the reference joints; identity parts survive in every LOD
        const ref = referenceJoints(PROPORTIONS_A);
        for (const k of [0, 1, 2, 3, 4, 7, 8, 9, 13, 14, 15]) expect(a.rig.rest[k * 3 + 1]).toBeCloseTo(ref[k * 3 + 1]!, 6);
        for (const l of [0, 1, 2] as const) expect(partsForLod(a.parts, l).filter((p) => p.identity).length).toBe(a.parts.filter((p) => p.identity).length);
      }
    }
  });
});

describe('crowd renderer', () => {
  it('200 dwarves of 4 roles at one LOD: one fill + one hull call per (role, LOD) bucket', () => {
    const r = new CrowdRenderer({ style: neutralStyleUniforms(960, 540), forceLod: 1, cull: false });
    r.sync(members(templates('welded'), 200), camera(), 540);
    expect(r.bucketCount).toBe(4);
    expect(r.stats.drawCalls).toBe(8);
    expect(r.stats.instances).toBe(200);
    r.sync(members(templates('welded'), 1), camera(), 540);
    expect(r.stats.drawCalls).toBe(2);
    r.setMode('sil');
    r.sync(members(templates('welded'), 200), camera(), 540);
    expect(r.stats.drawCalls).toBe(4); // no hulls in silhouette mode
    r.dispose();
  });
  it('MIRROR_SPLIT twin: buckets per facing', () => {
    const r = new CrowdRenderer({ style: neutralStyleUniforms(960, 540), forceLod: 1, cull: false, mirror: 'split' });
    r.sync(members(templates('welded'), 200), camera(), 540);
    expect(r.bucketCount).toBe(8);
    expect(r.stats.drawCalls).toBe(16);
    r.dispose();
  });
  it('instanced parts (d07 twin): draws per part, not per dwarf', () => {
    const t = templates('parts');
    const r = new CrowdRenderer({ style: neutralStyleUniforms(960, 540), forceLod: 1, cull: false });
    r.sync(members(t, 200), camera(), 540);
    const parts = t.reduce((s, m) => s + m.lods[1].parts!.length + m.lods[1].parts!.filter((p) => p.hull).length, 0);
    expect(r.stats.drawCalls).toBe(parts);
    expect(r.stats.instances).toBe(200);
    r.dispose();
  });
  it('uploads skin matrices per row and palettes / mirror sign per instance', () => {
    const t = templates('welded');
    const ms = members(t, 8);
    const r = new CrowdRenderer({ style: neutralStyleUniforms(960, 540), forceLod: 0, cull: false });
    r.sync(ms, camera(), 540);
    // row k = k-th visible member; check the head bone of member 5
    const m = ms[5]!;
    const head = 4;
    const expected = new THREE.Matrix4()
      .fromArray(m.anim.placement)
      .multiply(new THREE.Matrix4().fromArray(m.anim.bones, head * 16))
      .multiply(new THREE.Matrix4().makeTranslation(-m.model.rig.rest[head * 3]!, -m.model.rig.rest[head * 3 + 1]!, -m.model.rig.rest[head * 3 + 2]!));
    const got = readSkinMatrix(r.bones.data, r.bones.rowOffset(5), head);
    for (let i = 0; i < 16; i++) expect(got.elements[i]).toBeCloseTo(expected.elements[i]!, 5);
    // instance data of the bucket that holds member 5 (role = 5 % 4 = carpenter, second of its bucket)
    const bucketGeo = r.group.children.find((c) => (c as THREE.Mesh).geometry === undefined || ((c as THREE.Mesh).geometry as THREE.InstancedBufferGeometry).instanceCount === 2 && (c as THREE.Mesh).geometry.getAttribute('aSlot')?.count === t[1]!.lods[0].geometry!.getAttribute('aSlot')!.count) as THREE.Mesh;
    const buf = (bucketGeo.geometry.getAttribute('aInst') as THREE.InterleavedBufferAttribute).data.array as Float32Array;
    const o = 1 * INSTANCE_STRIDE;
    expect(buf[o]).toBe(5); // bone-texture row
    expect(buf[o + 1]).toBe(m.anim.placement[0]! < 0 ? -1 : 1); // mirror sign
    expect(buf[o + 2]).toBe(1); // lamp on
    const tunic = new THREE.Color(m.model.spec.palette.tunic);
    expect(buf[o + 4]).toBeCloseTo(tunic.r, 5);
    r.dispose();
  });
  it('feeds the lamps nearest to the frame centre into at most 12 dynamic lights', () => {
    const L = lights();
    const r = new CrowdRenderer({ style: neutralStyleUniforms(960, 540), lights: L, cull: false });
    const ms = members(templates('welded'), 60);
    r.sync(ms, camera(), 540);
    expect(L.count.value).toBe(12);
    const c = new THREE.Vector2(14, -12);
    const picked = L.pos.map((p) => new THREE.Vector2(p.x, p.y).distanceTo(c));
    const all = ms.map((m) => new THREE.Vector2(m.anim.placement[12]!, m.anim.placement[13]!).distanceTo(c)).sort((a, b) => a - b);
    expect(Math.max(...picked)).toBeLessThanOrEqual(all[13]! + 0.7); // lamp offsets move the points by < 0.7
    expect(L.col[0]!.x).toBeGreaterThan(0);
    r.dispose();
  });
  it('picks LOD from the distance and culls off-screen dwarves', () => {
    const r = new CrowdRenderer({ style: neutralStyleUniforms(960, 540) });
    const ms = members(templates('welded'), 4, 14 - 2);
    r.sync(ms, camera(5.6), 540);
    expect(ms.every((m) => r.lodOf(m.anim) === 0)).toBe(true);
    r.sync(ms, camera(17.5), 540);
    expect(ms.every((m) => r.lodOf(m.anim) === 1)).toBe(true);
    r.sync(ms, camera(55), 540);
    expect(ms.every((m) => r.lodOf(m.anim) === 2)).toBe(true);
    ms.forEach((m, k) => (m.anim as RestAnim).place(500 + k, 0, 1));
    r.sync(ms, camera(17.5), 540);
    expect(r.stats.instances).toBe(0);
    r.dispose();
  });
});
