/**
 * Build pipeline (owner: W1): DwarfSpec -> parts (anatomy + role gear) -> technique -> three LOD
 * meshes (welded skinned geometry + inverted hull, or instanced parts) -> DwarfModel with RigInput.
 * Deterministic: the same spec gives byte-identical buffers.
 */
import { BONE_COUNT, type RigInput } from '../../anim/types';
import { referenceJoints } from '../direction';
import { SLOT, type DwarfMesh, type DwarfModel, type DwarfSpec, type LodLevel, type PartMesh } from '../types';
import { bodyParts, makeFrame, type Frame } from './anatomy';
import { makeHull, MeshBuilder, partMesh, type VertexAttrs } from './mesh';
import { atLod, drawnAt, linearRgb, partMatrix, type ModelPart } from './part';
import { roleGear } from './roles';
import type { TechniqueImpl } from './techniques/common';

export interface Assembled {
  frame: Frame;
  parts: ModelPart[];
  rig: RigInput;
}

/** Parts and rig of one dwarf (technique-independent). */
export function assemble(spec: DwarfSpec): Assembled {
  const joints = referenceJoints(spec.proportions, new Float32Array(BONE_COUNT * 3));
  const frame = makeFrame(spec, joints);
  const gear = roleGear(frame);
  for (const [b, x, y, z] of gear.sockets) {
    joints[b * 3] = x;
    joints[b * 3 + 1] = y;
    joints[b * 3 + 2] = z;
  }
  const parts = [...bodyParts(frame), ...gear.parts];
  const rig: RigInput = {
    rest: joints,
    toolR: gear.toolR,
    toolL: gear.toolL,
    hold: gear.hold,
    back: gear.back,
    front: gear.front,
    lamp: gear.lamp,
    seed: spec.seed,
  };
  return { frame, parts, rig };
}

export function attrsOf(p: ModelPart, layer = 0): VertexAttrs {
  return {
    slot: p.slot,
    color: p.slot === SLOT.FIXED ? linearRgb(p.color ?? 0x808080) : [1, 1, 1],
    bone: p.bone,
    bone2: p.bone,
    weight: 1,
    emissive: p.emissive ?? 0,
    layer: p.layer ?? layer,
  };
}

function meshesFor(t: TechniqueImpl, parts: ModelPart[], lod: LodLevel, f: Frame) {
  const drawn = parts.filter((p) => drawnAt(p, lod)).map((p) => atLod(p, lod));
  const skinLod = t.skin && t.skin.lods.includes(lod);
  const hard = skinLod ? drawn.filter((p) => !p.skin) : drawn;
  if (t.meshAll) return { drawn, list: t.meshAll(hard, lod, f) };
  const list: { part: ModelPart; out: NonNullable<ReturnType<NonNullable<TechniqueImpl['mesh']>>> }[] = [];
  for (const p of hard) {
    const out = t.mesh!(p, lod, f);
    if (out) list.push({ part: p, out });
  }
  return { drawn, list };
}

function buildWelded(t: TechniqueImpl, parts: ModelPart[], lod: LodLevel, f: Frame): DwarfMesh {
  const b = new MeshBuilder();
  const { drawn, list } = meshesFor(t, parts, lod, f);
  for (const { part, out } of list) b.add(out.raw, out.space === 'local' ? partMatrix(part) : null, attrsOf(part, out.layer ?? 0));
  if (t.skin && t.skin.lods.includes(lod)) t.skin.build(drawn.filter((p) => p.skin), lod, f, b);
  const geometry = b.toGeometry();
  return { lod, mode: 'welded', geometry, hull: makeHull(geometry), parts: null, triangles: b.triangles };
}

function buildParts(t: TechniqueImpl, parts: ModelPart[], lod: LodLevel, f: Frame, rest: Float32Array): DwarfMesh {
  const { list } = meshesFor(t, parts, lod, f);
  const out: PartMesh[] = [];
  let tris = 0;
  for (const { part, out: m } of list) {
    const b = new MeshBuilder();
    const o: [number, number, number] = [rest[part.bone * 3]!, rest[part.bone * 3 + 1]!, rest[part.bone * 3 + 2]!];
    b.add(m.raw, m.space === 'local' ? partMatrix(part) : null, attrsOf(part, m.layer ?? 0), o);
    tris += b.triangles;
    out.push(partMesh(part.name, part.bone, part.slot, b, !part.name.startsWith('eye.')));
  }
  return { lod, mode: 'parts', geometry: null, hull: null, parts: out, triangles: tris };
}

/** Build a complete model with a technique. */
export function buildModel(variantId: string, viewYawDeg: number, t: TechniqueImpl, spec: DwarfSpec): DwarfModel {
  const a = assemble(spec);
  const parts = t.refine ? t.refine(a.parts, a.frame) : a.parts;
  const lods = ([0, 1, 2] as const).map((lod) =>
    t.mode === 'parts' ? buildParts(t, parts, lod, a.frame, a.rig.rest) : buildWelded(t, parts, lod, a.frame),
  ) as [DwarfMesh, DwarfMesh, DwarfMesh];
  return { variantId, spec, rig: a.rig, lods, viewYawDeg, parts };
}
