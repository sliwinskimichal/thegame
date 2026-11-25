/**
 * Procedural low-poly geometry for props and the placeholder dwarf, with
 * vertex colours (`color`) and per-vertex emission (`aEmissive`). Renderers
 * apply their own materials to these shared shapes.
 */
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { PROP, PROP_COUNT, type Mannequin, type World } from '../world/world';
import { flatColor } from './palette';

export class GeoBuilder {
  private parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, emissive = 0, m?: THREE.Matrix4): this {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()) as THREE.BufferGeometry;
    if (m) g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position!.count;
    const c = new THREE.Color(color);
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setAttribute('aEmissive', new THREE.BufferAttribute(new Float32Array(n).fill(emissive), 1));
    this.parts.push(g);
    return this;
  }

  build(): THREE.BufferGeometry {
    const names = ['position', 'normal', 'color', 'aEmissive'];
    const out = new THREE.BufferGeometry();
    for (const name of names) {
      const size = this.parts[0]!.attributes[name]!.itemSize;
      const total = this.parts.reduce((s, g) => s + g.attributes[name]!.count * size, 0);
      const arr = new Float32Array(total);
      let o = 0;
      for (const g of this.parts) {
        const a = g.attributes[name]!.array as Float32Array;
        arr.set(a, o);
        o += a.length;
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    out.computeBoundingSphere();
    return out;
  }
}

const T = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function roughen(geo: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position!;
  const rng = new Rng(seed);
  const map = new Map<string, number[]>();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)}|${p.getY(i).toFixed(3)}|${p.getZ(i).toFixed(3)}`;
    let o = map.get(k);
    if (!o) map.set(k, (o = [rng.range(-1, 1) * amount, rng.range(-1, 1) * amount, rng.range(-1, 1) * amount]));
    p.setXYZ(i, p.getX(i) + o[0]!, p.getY(i) + o[1]!, p.getZ(i) + o[2]!);
  }
  g.computeVertexNormals();
  return g;
}

/** Build the geometry of each prop type (index = PROP id). */
export function buildPropGeometries(): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = new Array(PROP_COUNT);
  geos[PROP.PINE] = new GeoBuilder()
    .add(new THREE.CylinderGeometry(0.06, 0.09, 0.7, 6), 0x5a3b22, 0, T(0, 0.35))
    .add(new THREE.ConeGeometry(0.55, 0.85, 7), 0x2f5a2a, 0, T(0, 0.75))
    .add(new THREE.ConeGeometry(0.42, 0.75, 7), 0x356a30, 0, T(0, 1.2, 0, 0, 0.4))
    .add(new THREE.ConeGeometry(0.28, 0.6, 7), 0x3e7a36, 0, T(0, 1.62, 0, 0, 0.9))
    .build();
  geos[PROP.BIRCH] = new GeoBuilder()
    .add(new THREE.CylinderGeometry(0.045, 0.06, 1.5, 6), 0xe8e2d6, 0, T(0, 0.75))
    .add(new THREE.CylinderGeometry(0.047, 0.047, 0.05, 6), 0x2a2522, 0, T(0, 0.5))
    .add(new THREE.CylinderGeometry(0.047, 0.047, 0.05, 6), 0x2a2522, 0, T(0, 0.95))
    .add(roughen(new THREE.IcosahedronGeometry(0.42, 0), 0.06, 1), 0x8fae3a, 0, T(0, 1.55))
    .add(roughen(new THREE.IcosahedronGeometry(0.33, 0), 0.05, 2), 0x7ea033, 0, T(0.25, 1.3, 0.1))
    .add(roughen(new THREE.IcosahedronGeometry(0.3, 0), 0.05, 3), 0x9bb845, 0, T(-0.22, 1.35, -0.1))
    .build();
  geos[PROP.BUSH] = new GeoBuilder()
    .add(roughen(new THREE.IcosahedronGeometry(0.28, 0), 0.05, 4), 0x3f6b2a, 0, T(0, 0.2))
    .add(roughen(new THREE.IcosahedronGeometry(0.22, 0), 0.05, 5), 0x4a7a30, 0, T(0.2, 0.15, 0.05))
    .add(new THREE.SphereGeometry(0.04, 5, 4), 0xc0283a, 0.2, T(0.12, 0.33, 0.15))
    .add(new THREE.SphereGeometry(0.04, 5, 4), 0xc0283a, 0.2, T(-0.1, 0.28, 0.2))
    .build();
  {
    const b = new GeoBuilder();
    for (let i = 0; i < 6; i++) {
      const h = 0.14 + (i % 3) * 0.06;
      const blade = new THREE.PlaneGeometry(0.04, h, 1, 2);
      blade.translate(0, h / 2, 0);
      b.add(blade, i % 2 ? 0x5b8a2f : 0x6f9a35, 0, T((i - 2.5) * 0.04, 0, (i % 2) * 0.03, 0, i * 1.1, (i - 2.5) * 0.12));
    }
    geos[PROP.GRASS] = b.build();
  }
  geos[PROP.FLOWER] = new GeoBuilder()
    .add(new THREE.CylinderGeometry(0.008, 0.01, 0.22, 4), 0x4f7f2a, 0, T(0, 0.11))
    .add(new THREE.OctahedronGeometry(0.05, 0), 0xffffff, 0.15, T(0, 0.24))
    .build();
  geos[PROP.BOULDER] = new GeoBuilder().add(roughen(new THREE.DodecahedronGeometry(0.32, 0), 0.06, 6), 0x7a7570, 0, T(0, 0.18, 0, 0, 0, 0, 1.2, 0.7, 1)).build();
  {
    const g = new THREE.ConeGeometry(0.12, 0.8, 6);
    g.rotateX(Math.PI);
    g.translate(0, -0.4, 0);
    geos[PROP.STALACTITE] = new GeoBuilder().add(roughen(g, 0.02, 7), 0xd0c8bc).build();
  }
  {
    const g = new THREE.ConeGeometry(0.14, 0.6, 6);
    g.translate(0, 0.3, 0);
    geos[PROP.STALAGMITE] = new GeoBuilder().add(roughen(g, 0.02, 8), 0xd0c8bc).build();
  }
  geos[PROP.GLOW_SHROOM] = new GeoBuilder()
    .add(new THREE.CylinderGeometry(0.025, 0.035, 0.18, 5), 0xd8e0d0, 0.15, T(0, 0.09))
    .add(new THREE.SphereGeometry(0.12, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x5ff2d0, 1.6, T(0, 0.16, 0, 0, 0, 0, 1, 0.7, 1))
    .add(new THREE.CylinderGeometry(0.018, 0.025, 0.12, 5), 0xd8e0d0, 0.15, T(0.09, 0.06, 0.03))
    .add(new THREE.SphereGeometry(0.07, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), 0x6fe8ff, 1.6, T(0.09, 0.11, 0.03, 0, 0, 0, 1, 0.7, 1))
    .build();
  {
    const b = new GeoBuilder()
      .add(new THREE.CylinderGeometry(0.18, 0.26, 2.6, 8), 0xcdd6c4, 0.08, T(0, 1.3))
      .add(new THREE.SphereGeometry(1.25, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x2f9f8c, 0.35, T(0, 2.45, 0, 0, 0, 0, 1, 0.42, 1))
      .add(new THREE.CylinderGeometry(1.22, 0.3, 0.12, 12), 0x1d5a50, 0.6, T(0, 2.4));
    const rng = new Rng(99);
    for (let i = 0; i < 10; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(0.2, 0.95);
      b.add(new THREE.SphereGeometry(0.07, 5, 4), 0xa8fff0, 2.4, T(Math.cos(a) * r, 2.45 + 0.42 * Math.sqrt(1 - r * r) * 1.2, Math.sin(a) * r));
    }
    geos[PROP.GIANT_SHROOM] = b.build();
  }
  {
    const b = new GeoBuilder();
    const rng = new Rng(11);
    for (let i = 0; i < 6; i++) {
      const h = rng.range(0.25, 0.6);
      const g = new THREE.CylinderGeometry(0, rng.range(0.05, 0.09), h, 6);
      g.translate(0, h / 2, 0);
      b.add(g, 0x7ee4ff, 1.8, T(rng.range(-0.12, 0.12), 0, rng.range(-0.1, 0.1), rng.range(-0.5, 0.5), rng.range(0, 3), rng.range(-0.5, 0.5)));
    }
    geos[PROP.CRYSTAL_CLUSTER] = b.build();
  }
  {
    const b = new GeoBuilder();
    for (let i = 0; i < 3; i++) {
      const g = new THREE.CylinderGeometry(0.012, 0.03, 0.75, 4, 3);
      g.translate(0, -0.37, 0);
      b.add(roughen(g, 0.03, 20 + i), 0x5a4030, 0, T((i - 1) * 0.12, 0, (i % 2) * 0.05, 0.1 * i, 0, (i - 1) * 0.15));
    }
    geos[PROP.ROOTS] = b.build();
  }
  geos[PROP.BONES] = new GeoBuilder()
    .add(new THREE.SphereGeometry(0.1, 7, 5), 0xe8e0cc, 0, T(0, 0.09))
    .add(new THREE.CapsuleGeometry(0.025, 0.35, 2, 5), 0xd8d0bc, 0, T(0.2, 0.03, 0.05, 0, 0.3, Math.PI / 2))
    .add(new THREE.CapsuleGeometry(0.025, 0.28, 2, 5), 0xd8d0bc, 0, T(-0.15, 0.03, -0.05, 0, -0.6, Math.PI / 2))
    .build();
  geos[PROP.TORCH] = new GeoBuilder()
    .add(new THREE.CylinderGeometry(0.025, 0.03, 0.38, 5), 0x4a3020, 0, T(0, 0, 0.05, 0.5))
    .add(new THREE.ConeGeometry(0.06, 0.18, 6), 0xffb050, 4, T(0, 0.24, 0.14, 0.5))
    .add(new THREE.SphereGeometry(0.045, 6, 4), 0xfff0c0, 6, T(0, 0.19, 0.12))
    .build();
  return geos;
}

/** Placeholder dwarf (≈0.85 tiles tall) used to judge character readability. */
export function buildMannequin(pose: Mannequin['pose'], seed = 1): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const tunic = rng.pick([0x7a3b2a, 0x2f5a7a, 0x5a6a2a, 0x6a3a6a]);
  const beard = rng.pick([0xc0602a, 0x5a3a22, 0x2a1e18, 0xd8d0c0]);
  const b = new GeoBuilder()
    .add(new THREE.CylinderGeometry(0.15, 0.2, 0.38, 8), tunic, 0, T(0, 0.36))
    .add(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 8), 0x3a2a1a, 0, T(0, 0.3))
    .add(new THREE.SphereGeometry(0.135, 10, 8), 0xe0b08a, 0, T(0, 0.64))
    .add(new THREE.SphereGeometry(0.04, 6, 5), 0xd09070, 0, T(0.1, 0.62, 0.06))
    .add(new THREE.ConeGeometry(0.15, 0.34, 8), beard, 0, T(0.04, 0.47, 0.02, 0, 0, Math.PI))
    .add(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x9a9a9a, 0, T(0, 0.67))
    .add(new THREE.ConeGeometry(0.035, 0.12, 5), 0xe8e0d0, 0, T(0.1, 0.78, 0, 0, 0, -1.0))
    .add(new THREE.ConeGeometry(0.035, 0.12, 5), 0xe8e0d0, 0, T(-0.1, 0.78, 0, 0, 0, 1.0));
  const legA = pose === 'walk' ? 0.35 : 0;
  b.add(new THREE.CylinderGeometry(0.055, 0.06, 0.2, 6), 0x3a2c22, 0, T(0.07, 0.1, 0, 0, 0, legA));
  b.add(new THREE.CylinderGeometry(0.055, 0.06, 0.2, 6), 0x3a2c22, 0, T(-0.07, 0.1, 0, 0, 0, -legA));
  b.add(new THREE.BoxGeometry(0.12, 0.05, 0.16), 0x2a1e16, 0, T(0.08 + legA * 0.1, 0.02, 0.02));
  b.add(new THREE.BoxGeometry(0.12, 0.05, 0.16), 0x2a1e16, 0, T(-0.08 - legA * 0.1, 0.02, 0.02));
  const armUp = pose === 'dig' ? -2.4 : -0.2;
  b.add(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 6), tunic, 0, T(0.17, 0.4, 0, 0, 0, armUp * 0.5));
  b.add(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 6), tunic, 0, T(-0.17, 0.4, 0, 0, 0, 0.2));
  // pick
  const px = pose === 'dig' ? 0.32 : 0.24;
  const py = pose === 'dig' ? 0.72 : 0.36;
  b.add(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5), 0x6a4a2a, 0, T(px, py, 0.05, 0, 0, pose === 'dig' ? -0.6 : 0.15));
  b.add(new THREE.BoxGeometry(0.34, 0.05, 0.05), 0xb8bcc4, 0.05, T(px + (pose === 'dig' ? 0.13 : -0.04), py + 0.22, 0.05, 0, 0, pose === 'dig' ? -0.6 : 0.15));
  // lantern on the belt
  b.add(new THREE.BoxGeometry(0.07, 0.09, 0.07), 0xffd080, 3, T(-0.16, 0.27, 0.08));
  return b.build();
}

export interface PropInstances {
  type: number;
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
}

/** Group the world's props by type with instance transforms and tints. */
export function collectProps(world: World): PropInstances[] {
  const out: PropInstances[] = [];
  for (let t = 0; t < PROP_COUNT; t++) out.push({ type: t, matrices: [], colors: [] });
  const rng = new Rng(world.seed ^ 0x51);
  for (const p of world.props) {
    const g = out[p.type]!;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, p.y, p.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.type === PROP.TORCH ? 0 : p.rot, 0)),
      new THREE.Vector3(p.scale, p.scale, p.scale),
    );
    g.matrices.push(m);
    let c = new THREE.Color(1, 1, 1);
    if (p.type === PROP.STALACTITE || p.type === PROP.STALAGMITE) {
      const bg = world.bg[p.anchor] || world.mat[p.anchor]!;
      c = flatColor(bg).multiplyScalar(2.2);
    } else if (p.type === PROP.FLOWER) c = new THREE.Color(rng.pick([0xff7ab0, 0xffd84a, 0x8ab4ff, 0xffffff, 0xff9a40]));
    else if (p.type === PROP.GLOW_SHROOM || p.type === PROP.CRYSTAL_CLUSTER) c = new THREE.Color().setHSL(rng.range(0.45, 0.58), 0.8, 0.6).multiplyScalar(1.6);
    g.colors.push(c);
  }
  return out;
}
