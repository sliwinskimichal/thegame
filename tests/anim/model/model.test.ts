// W1 model: the "done" criteria of brief §2 (+ contract v2) for all variants × 4 roles × 3 LOD.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { BONE, BONE_COUNT, HOLD } from '../../../src/render/anim/types';
import { FIXED_COLORS, referenceJoints, totalHeight, VALUE_BANDS } from '../../../src/render/characters/direction';
import { DWARF_VARIANTS, makeSpec } from '../../../src/render/characters/model/index';
import { accentShare, meshTop, rasterize } from '../../../src/render/characters/model/inspect';
import { drawnAt, IDENT_GROUPS, type ModelPart } from '../../../src/render/characters/model/part';
import { LOD_BUDGET_HARD, LOD_TRIANGLE_BUDGET, MESH_ATTRIBUTES, ROLE, SLOT, SOCIAL, type DwarfMesh, type DwarfModel } from '../../../src/render/characters/types';

const IDS = [
  'd01-karta',
  'd02-toczone',
  'd03-fasety',
  'd04-wycinanka',
  'd05-drewno',
  'd06-kontur',
  'd07-czesci',
  'd08-glina',
  'd09-beczka',
  'd10-slup',
  'd11-kowadlo',
  'd12-trzy-glowy',
];
const ROLES = [0, 1, 2, 3] as const;
const SEED = 4242;
const models = new Map<string, DwarfModel[]>();

beforeAll(() => {
  for (const v of DWARF_VARIANTS) models.set(v.id, ROLES.map((r) => v.build(makeSpec(SEED, r, SOCIAL.FREE_MINER, v.proportions))));
});

function geometries(m: DwarfMesh): THREE.BufferGeometry[] {
  if (m.mode === 'welded') return [m.geometry!, m.hull!];
  return m.parts!.flatMap((p) => (p.hull ? [p.geometry, p.hull] : [p.geometry]));
}

/** FNV-1a over every attribute and index buffer of a model (all LODs). */
function hashModel(m: DwarfModel): number {
  let h = 0x811c9dc5;
  const eat = (arr: ArrayLike<number>) => {
    const b = new Uint8Array(new Float32Array(Array.from(arr)).buffer);
    for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i]!, 0x01000193);
  };
  for (const lod of m.lods)
    for (const g of geometries(lod)) {
      for (const a of MESH_ATTRIBUTES) eat((g.getAttribute(a) as THREE.BufferAttribute).array);
      eat(g.getIndex()!.array);
    }
  return h >>> 0;
}

describe('model variants: the list', () => {
  it('has exactly the 12 tournament ids with Polish names and the contract fields', () => {
    expect(DWARF_VARIANTS.map((v) => v.id)).toEqual(IDS);
    for (const v of DWARF_VARIANTS) {
      expect(v.namePl.length).toBeGreaterThan(2);
      expect(v.descPl.length).toBeGreaterThan(20);
      expect([0, 25, 40]).toContain(v.viewYawDeg);
    }
    const tech = Object.fromEntries(DWARF_VARIANTS.map((v) => [v.id, v.technique]));
    expect(tech).toMatchObject({ 'd01-karta': 'primitives', 'd02-toczone': 'lathe', 'd03-fasety': 'faceted', 'd04-wycinanka': 'papercut', 'd05-drewno': 'carved', 'd06-kontur': 'outline', 'd07-czesci': 'parts', 'd08-glina': 'sdf' });
    expect(DWARF_VARIANTS.find((v) => v.id === 'd04-wycinanka')!.viewYawDeg).toBe(0);
    expect(DWARF_VARIANTS.find((v) => v.id === 'd06-kontur')!.viewYawDeg).toBe(25);
  });
});

describe.each(IDS)('variant %s', (id) => {
  const v = () => DWARF_VARIANTS.find((x) => x.id === id)!;
  const ms = () => models.get(id)!;

  it('builds 4 roles × 3 LOD with every contract attribute, consistent and finite', () => {
    for (const m of ms()) {
      expect(m.variantId).toBe(id);
      expect(m.viewYawDeg).toBe(v().viewYawDeg);
      m.lods.forEach((lod, li) => {
        expect(lod.lod).toBe(li);
        expect(lod.mode).toBe(id === 'd07-czesci' ? 'parts' : 'welded');
        let tris = 0;
        for (const g of geometries(lod)) {
          const n = g.getAttribute('position').count;
          for (const a of MESH_ATTRIBUTES) {
            const attr = g.getAttribute(a);
            expect(attr, a).toBeDefined();
            expect(attr.count).toBe(n);
            expect((attr.array as Float32Array).every((x) => Number.isFinite(x)), a).toBe(true);
          }
          const idx = g.getIndex()!;
          expect((idx.array as Uint16Array).every((x) => x < n)).toBe(true);
          const slot = g.getAttribute('aSlot');
          const col = g.getAttribute('color');
          const bones = g.getAttribute('aBones');
          const w = g.getAttribute('aWeight');
          const lay = g.getAttribute('aLayer');
          const nrm = g.getAttribute('normal');
          const bad: string[] = [];
          for (let i = 0; i < n && bad.length < 5; i++) {
            const s = slot.getX(i);
            if (!(Number.isInteger(s) && s >= 0 && s <= 6)) bad.push(`slot ${s}`);
            if (s !== SLOT.FIXED && (col.getX(i) !== 1 || col.getY(i) !== 1 || col.getZ(i) !== 1)) bad.push(`colour of a variable slot`);
            for (const b of [bones.getX(i), bones.getY(i)]) if (!(Number.isInteger(b) && b >= 0 && b < BONE_COUNT)) bad.push(`bone ${b}`);
            if (w.getX(i) < 0.5 - 1e-6 || w.getX(i) > 1 + 1e-6) bad.push(`weight ${w.getX(i)}`);
            if (![-1, 0, 1].includes(lay.getX(i))) bad.push(`layer ${lay.getX(i)}`);
            if (Math.abs(Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i)) - 1) > 1e-3) bad.push('normal length');
          }
          expect(bad, `${id} role ${m.spec.role} LOD${li}`).toEqual([]);
        }
        if (lod.mode === 'welded') {
          tris = lod.geometry!.getIndex()!.count / 3;
          expect(lod.hull!.getAttribute('position').count).toBe(lod.geometry!.getAttribute('position').count);
        } else tris = lod.parts!.reduce((s, p) => s + p.geometry.getIndex()!.count / 3, 0);
        expect(lod.triangles).toBe(tris);
      });
    }
  });

  it('meets the triangle budgets (LOD1 <= 400 and LOD2 <= 60 hard, LOD0 soft and reported)', () => {
    for (const m of ms())
      m.lods.forEach((lod, li) => {
        if (LOD_BUDGET_HARD[li]) expect(lod.triangles, `${id} role ${m.spec.role} LOD${li}`).toBeLessThanOrEqual(LOD_TRIANGLE_BUDGET[li]!);
        else expect(lod.triangles).toBeLessThan(LOD_TRIANGLE_BUDGET[li]! * 1.6); // sanity cap on the soft budget
      });
  });

  it('is deterministic: the same spec gives identical buffers, another seed differs', () => {
    const vv = v();
    const role = (IDS.indexOf(id) % 4) as 0 | 1 | 2 | 3;
    const a = hashModel(vv.build(makeSpec(SEED, role, 0, vv.proportions)));
    const b = hashModel(vv.build(makeSpec(SEED, role, 0, vv.proportions)));
    const c = hashModel(vv.build(makeSpec(SEED + 977, role, 0, vv.proportions)));
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });

  it('body joints equal referenceJoints, sockets moved only by gear, rig info matches the role', () => {
    const body = [BONE.ROOT, BONE.PELVIS, BONE.SPINE, BONE.CHEST, BONE.HEAD, BONE.BEARD, BONE.BEARD2, BONE.ARM_R, BONE.FORE_R, BONE.HAND_R, BONE.ARM_L, BONE.FORE_L, BONE.HAND_L, BONE.THIGH_R, BONE.SHIN_R, BONE.FOOT_R, BONE.THIGH_L, BONE.SHIN_L, BONE.FOOT_L, BONE.TOOL_R, BONE.TOOL_L];
    for (const m of ms()) {
      const ref = referenceJoints(m.spec.proportions);
      expect(m.rig.rest.length).toBe(BONE_COUNT * 3);
      for (const b of body) for (let k = 0; k < 3; k++) expect(m.rig.rest[b * 3 + k]).toBeCloseTo(ref[b * 3 + k]!, 6);
      expect(m.rig.seed).toBe(SEED);
      expect(m.rig.lamp.radius).toBeCloseTo(2, 1);
      const role = m.spec.role;
      if (role === ROLE.MINER) {
        expect(m.rig.hold).toBe(HOLD.TOOL_SHOULDER);
        expect(m.rig.back).toBe('apron');
        expect(m.rig.lamp.bone).toBe(BONE.HEAD);
        expect(m.rig.toolR!.kind).toBe('pick');
        expect(m.rig.toolR!.length).toBeCloseTo(0.75);
        expect(m.rig.toolR!.gripL).toBeGreaterThan(0);
      } else expect(m.rig.lamp.bone).toBe(BONE.LANTERN);
      if (role === ROLE.CARPENTER) {
        expect(m.rig.hold).toBe(HOLD.BEAM_SHOULDER);
        expect(m.rig.back).toBe('beam');
        expect(m.rig.toolR!.kind).toBe('axe');
        expect(m.rig.toolR!.gripL).toBeGreaterThan(0);
      }
      if (role === ROLE.PORTER) {
        expect(m.rig.hold).toBe(HOLD.FRAME_STRAPS);
        expect(m.rig.back).toBe('frame');
        expect(m.rig.toolR).toBeNull();
      }
      if (role === ROLE.SMITH) {
        expect(m.rig.hold).toBe(HOLD.TWO_TOOLS);
        expect(m.rig.front).toBe('apron');
        expect(m.rig.toolR!.kind).toBe('hammer');
        expect(m.rig.toolL!.kind).toBe('tongs');
      }
      for (const t of [m.rig.toolR, m.rig.toolL]) {
        if (!t) continue;
        expect(t.head).toBeGreaterThan(0);
        expect(t.head).toBeLessThanOrEqual(t.length);
        expect(t.strike[1]).toBeGreaterThan(0);
      }
    }
  });

  it('is as tall as totalHeight(proportions) ± 0.06 (LOD0, rest pose)', () => {
    for (const m of ms()) {
      let top = meshTop(m.lods[0]);
      if (m.lods[0].mode === 'parts')
        for (const p of m.lods[0].parts!) {
          const pos = p.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i) + m.rig.rest[p.bone * 3 + 1]!);
        }
      expect(Math.abs(top - totalHeight(m.spec.proportions)), `role ${m.spec.role} top ${top}`).toBeLessThanOrEqual(0.06);
    }
  });

  it('every role carries headgear + tool/load + back element/apron as identity, and every identity group survives every LOD', () => {
    for (const m of ms()) {
      const parts = m.parts as readonly ModelPart[];
      const groups = (lod: number) => new Set(parts.filter((p) => p.identity && p.ident && drawnAt(p, lod)).map((p) => p.ident!));
      const g0 = groups(0);
      expect(g0.has('headgear')).toBe(true);
      expect(g0.has('tool') || g0.has('load')).toBe(true);
      expect(g0.has('back') || g0.has('apron')).toBe(true);
      for (const lod of [1, 2]) for (const g of g0) expect(groups(lod).has(g), `role ${m.spec.role} ${g} at LOD${lod}`).toBe(true);
      for (const p of parts) {
        if (p.ident) expect(IDENT_GROUPS).toContain(p.ident);
        expect(p.bone).toBeGreaterThanOrEqual(0);
        expect(p.bone).toBeLessThan(BONE_COUNT);
      }
      expect(new Set(parts.map((p) => p.name)).size).toBe(parts.length);
    }
  });

  it('the miner wears a lit kaganek at every LOD (emissive >= 2)', () => {
    const m = ms()[ROLE.MINER]!;
    for (const lod of [0, 1, 2]) {
      const lamp = (m.parts as readonly ModelPart[]).filter((p) => p.ident === 'lamp' && drawnAt(p, lod));
      expect(lamp.some((p) => (p.emissive ?? 0) >= 2 && p.color === FIXED_COLORS.lampFlame)).toBe(true);
    }
  });

  it('the social accent covers <= 10% of the silhouette (side view and the variant view, LOD0 and LOD1)', () => {
    for (const m of ms())
      for (const lod of [0, 1] as const)
        for (const yaw of [0, v().viewYawDeg]) {
          const r = rasterize(m.lods[lod], m, { width: 160, height: 180, ppu: 120, yawDeg: yaw, cy: 0.66 });
          expect(accentShare(r), `role ${m.spec.role} LOD${lod} yaw ${yaw}`).toBeLessThanOrEqual(VALUE_BANDS.accentMaxShare);
          expect(accentShare(r)).toBeGreaterThan(0); // the accent exists and is visible
        }
  });
});

describe('technique specifics', () => {
  it('d04 papercut: cards in three depth layers (aLayer -1 / 0 / +1)', () => {
    const g = models.get('d04-wycinanka')![0]!.lods[0].geometry!;
    const lay = new Set(Array.from((g.getAttribute('aLayer') as THREE.BufferAttribute).array));
    expect([...lay].sort()).toEqual([-1, 0, 1]);
  });

  it('d07 parts: the same shapes as d01, one geometry per part in bone-local space', () => {
    const p = models.get('d07-czesci')![0]!;
    const w = models.get('d01-karta')![0]!;
    for (const lod of [0, 1, 2] as const) {
      expect(p.lods[lod].geometry).toBeNull();
      expect(p.lods[lod].triangles).toBe(w.lods[lod].triangles);
      const box = new THREE.Box3();
      for (const part of p.lods[lod].parts!) {
        const pos = part.geometry.getAttribute('position');
        const o = new THREE.Vector3(p.rig.rest[part.bone * 3]!, p.rig.rest[part.bone * 3 + 1]!, p.rig.rest[part.bone * 3 + 2]!);
        for (let i = 0; i < pos.count; i++) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, i).add(o));
      }
      const wb = w.lods[lod].geometry!.boundingBox!;
      expect(box.min.distanceTo(wb.min)).toBeLessThan(1e-5);
      expect(box.max.distanceTo(wb.max)).toBeLessThan(1e-5);
    }
  });

  it('d08 clay: one smooth skin with two-bone weights at the joints (LOD0)', () => {
    const g = models.get('d08-glina')![0]!.lods[0].geometry!;
    const b = g.getAttribute('aBones') as THREE.BufferAttribute;
    const w = g.getAttribute('aWeight') as THREE.BufferAttribute;
    let blended = 0;
    const pairs = new Set<string>();
    for (let i = 0; i < b.count; i++)
      if (w.getX(i) < 0.99 && b.getX(i) !== b.getY(i)) {
        blended++;
        pairs.add([b.getX(i), b.getY(i)].sort().join('-'));
      }
    expect(blended).toBeGreaterThan(100);
    // elbows and knees blend their two bones
    expect(pairs.has([BONE.ARM_R, BONE.FORE_R].sort().join('-'))).toBe(true);
    expect(pairs.has([BONE.THIGH_R, BONE.SHIN_R].sort().join('-'))).toBe(true);
  });

  it('flat-shaded techniques get a welded hull (smooth normals differ from the facet normals)', () => {
    for (const id of ['d03-fasety', 'd05-drewno']) {
      const l = models.get(id)![0]!.lods[0];
      const a = l.geometry!.getAttribute('normal') as THREE.BufferAttribute;
      const b = l.hull!.getAttribute('normal') as THREE.BufferAttribute;
      let diff = 0;
      for (let i = 0; i < a.count; i++) if (Math.abs(a.getX(i) - b.getX(i)) + Math.abs(a.getY(i) - b.getY(i)) + Math.abs(a.getZ(i) - b.getZ(i)) > 0.05) diff++;
      expect(diff / a.count).toBeGreaterThan(0.5);
    }
  });
});
