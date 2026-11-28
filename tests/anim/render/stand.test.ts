// Dwarf station (owner: W3): LOD choice from the reference dwarf, the stand world and the fixed shot list.
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { CHARACTER_SCALE, lodForDwarfPx, refHeightTiles, ZOOMS } from '../../../src/render/characters/direction';
import { buildShots, DIG_APEX, DIG_HIT, silPoses } from '../../../src/render/characters/lab/shots';
import { buildStandWorld, LADDER_Z, RUNG_OFFSET, RUNG_SPACING, TUNNEL_Z } from '../../../src/render/characters/lab/world';
import { lodWithHysteresis, refDwarfPxAtDepth, viewDepth } from '../../../src/render/characters/render/lod';
import { cameraDistance, ROLE, SHOT_IDS, type ShotDef } from '../../../src/render/characters/types';
import { LightField } from '../../../src/world/lightfield';

const H = 540;
afterEach(() => {
  CHARACTER_SCALE.worldPerModel = 1;
});

function cameraFor(zoom: keyof typeof ZOOMS, x = 0, y = 0): THREE.PerspectiveCamera {
  const d = cameraDistance(ZOOMS[zoom].pxPerTile, H);
  const cam = new THREE.PerspectiveCamera(30, 960 / H, 0.5, 1200);
  cam.position.set(x, y + d * 0.07, d);
  cam.lookAt(x, y, -0.5);
  cam.updateMatrixWorld();
  return cam;
}

describe('LOD from the on-screen height of the reference dwarf', () => {
  for (const scale of [1, 1.6]) {
    it(`every zoom selects its own LOD and dwarf size (scale ${scale})`, () => {
      CHARACTER_SCALE.worldPerModel = scale;
      for (const z of ['izba', 'grod', 'okolica'] as const) {
        const cam = cameraFor(z);
        const px = refDwarfPxAtDepth(30, H, viewDepth(cam, 0, refHeightTiles() * 0.5, TUNNEL_Z));
        // the dwarf stands 0.45 behind the cut plane the zoom is defined on: within 8% of the target
        expect(px / ZOOMS[z].dwarfPx).toBeGreaterThan(0.9);
        expect(px / ZOOMS[z].dwarfPx).toBeLessThanOrEqual(1.0);
        expect(lodForDwarfPx(px)).toBe(ZOOMS[z].lod);
      }
    });
  }
  it('hysteresis keeps the previous level near a threshold, never two levels apart', () => {
    expect(lodWithHysteresis(131, 1)).toBe(1); // just above 129, previously LOD1
    expect(lodWithHysteresis(131, -1)).toBe(0);
    expect(lodWithHysteresis(160, 1)).toBe(0);
    expect(lodWithHysteresis(38, 1)).toBe(1); // just below 39
    expect(lodWithHysteresis(20, 1)).toBe(2);
    expect(lodWithHysteresis(20, 0)).toBe(2);
  });
});

describe('stand world', () => {
  it('is deterministic and follows the character scale', () => {
    const a = buildStandWorld(7);
    const b = buildStandWorld(7);
    expect(Buffer.from(a.world.mat).equals(Buffer.from(b.world.mat))).toBe(true);
    expect(JSON.stringify(a.layout)).toBe(JSON.stringify(b.layout));
    CHARACTER_SCALE.worldPerModel = 1.6;
    const big = buildStandWorld(7);
    expect(big.layout.refH).toBeCloseTo(refHeightTiles(), 6);
    expect(big.world.w).toBeGreaterThan(a.world.w);
    // a taller dwarf still fits the drift: the opening is at least 1.5 reference heights
    const g = big.layout.grod;
    let open = 0;
    for (let r = -g.floorY - 1; r > 0 && !big.world.isSolid(Math.floor(g.faceX - 2), r); r--) open++;
    expect(open).toBeGreaterThanOrEqual(Math.ceil(1.5 * big.layout.refH));
  });
  it('probe: floors, ladder rungs every 0.25 on 1-tile segments, play depth', () => {
    const s = buildStandWorld(7);
    const f = s.layout.izba;
    expect(s.probe.floorAt(f.centerX, f.floorY + 0.2)).toBe(f.floorY);
    expect(s.probe.ladder).toEqual({ rungSpacing: RUNG_SPACING, rungOffset: RUNG_OFFSET, z: LADDER_Z });
    expect(s.probe.playZ(-10)).toBe(TUNNEL_Z);
    const ladders = s.dressing.filter((d) => d.kind === 'ladder');
    expect(ladders.length).toBeGreaterThan(8 * 8);
    for (const l of ladders) {
      expect(Number.isInteger(l.y)).toBe(true); // segment base on a tile boundary
      expect(l.sy ?? 1).toBe(1);
      expect(l.z).toBe(LADDER_Z);
    }
  });
});

describe('shot list', () => {
  const stand = buildStandWorld(7);
  const shots = buildShots(stand.layout);
  const light = new LightField(stand.world.w, stand.world.h);
  light.compute(stand.world);
  const level = (x: number, y: number) => {
    const i = Math.floor(-(y + refHeightTiles() * 0.6)) * stand.world.w + Math.floor(x);
    return Math.max(light.r[i]!, light.g[i]!, light.b[i]!);
  };
  const roles = (s: ShotDef) => new Set(s.dwarves.map((d) => d.role));

  it('defines every SHOT_ID', () => {
    for (const id of SHOT_IDS) {
      expect(shots[id], id).toBeDefined();
      expect(shots[id].id).toBe(id);
      expect(shots[id].dwarves.length).toBeGreaterThan(0);
    }
  });
  it('izba, swiatlo and the silhouette shots carry all four roles', () => {
    for (const id of ['izba', 'swiatlo', 'sil75', 'sil24'] as const) expect(roles(shots[id]).size, id).toBe(4);
    expect(shots.izba.zoom).toBe('izba');
    expect(shots.izba.dwarves.every((d) => d.clip === 'idle')).toBe(true);
    expect(shots.sil75.dwarves).toHaveLength(32);
    expect(shots.sil24.zoom).toBe('okolica');
    for (const r of [ROLE.MINER, ROLE.CARPENTER, ROLE.PORTER, ROLE.SMITH]) {
      const poses = shots.sil75.dwarves.filter((d) => d.role === r).map((d) => `${d.clip}@${d.phase.toFixed(3)}`);
      expect(poses).toEqual(silPoses(r).map((p) => `${p.clip}@${p.phase.toFixed(3)}`));
    }
    expect(DIG_HIT).toBeGreaterThan(DIG_APEX);
  });
  it('swiatlo: four in the core of the pool, four at its edge', () => {
    const lv = shots.swiatlo.dwarves.map((d) => level(d.x, d.y));
    expect(lv.slice(0, 4).every((l) => l >= 1)).toBe(true);
    expect(lv.slice(4).every((l) => l < 1)).toBe(true);
  });
  it('grod: the miner digs at the dark edge, the carpenter is on the ladder', () => {
    const miner = shots.grod.dwarves.find((d) => d.role === ROLE.MINER)!;
    expect(miner.clip).toBe('dig');
    expect(level(miner.x, miner.y)).toBeLessThan(1);
    const carp = shots.grod.dwarves.find((d) => d.role === ROLE.CARPENTER)!;
    expect(carp.clip).toBe('climb');
    expect(Math.abs(((carp.y - RUNG_OFFSET) / RUNG_SPACING) % 1)).toBeLessThan(1e-6); // feet on a rung
  });
  it('strips: 8 phases k/8 per row, rows of one role; feet on the floor', () => {
    for (const id of ['walk8', 'dig8', 'carry8', 'climb8'] as const) {
      const ds = shots[id].dwarves;
      expect(ds).toHaveLength(16);
      for (let r = 0; r < 2; r++) {
        const row = ds.slice(r * 8, r * 8 + 8);
        expect(new Set(row.map((d) => d.role)).size).toBe(1);
        expect(row.map((d) => d.phase)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((k) => k / 8));
        if (id !== 'climb8') for (const d of row) expect(stand.probe.floorAt(d.x, d.y + 0.1)).toBe(d.y);
      }
    }
    expect(shots.dig8.dwarves.slice(8).every((d) => d.role === ROLE.SMITH && d.clip === 'build')).toBe(true);
    expect(roles(shots.walk8)).toEqual(new Set([ROLE.MINER, ROLE.PORTER]));
  });
  it('okolica: about 60 dwarves inside the Okolica frame; seq30: 30 fps steps', () => {
    const o = shots.okolica;
    expect(o.dwarves.length).toBeGreaterThanOrEqual(55);
    expect(o.dwarves.length).toBeLessThanOrEqual(60);
    const cam = cameraFor('okolica', o.x, o.y);
    for (const d of o.dwarves) {
      const v = new THREE.Vector3(d.x, d.y + 0.6, TUNNEL_Z).project(cam);
      expect(Math.abs(v.x)).toBeLessThan(1);
      expect(Math.abs(v.y)).toBeLessThan(1);
    }
    const walk = shots.seq30.dwarves.slice(0, 8).map((d) => d.phase);
    for (let k = 1; k < 8; k++) expect(walk[k]! - walk[k - 1]!).toBeCloseTo(1 / 30 / 0.9, 6);
  });
  it('is deterministic', () => {
    expect(JSON.stringify(buildShots(buildStandWorld(7).layout))).toBe(JSON.stringify(shots));
  });
});

describe('stand lighting and dressing (E1 review)', () => {
  const stand = buildStandWorld(7);
  const light = new LightField(stand.world.w, stand.world.h);
  light.compute(stand.world);
  const at = (x: number, y: number) => {
    const i = Math.floor(-y) * stand.world.w + Math.floor(x);
    return [light.r[i]!, light.g[i]!, light.b[i]!];
  };
  it('every dwarf of a strip and every ladder gets identical light (torch per dwarf, same offset)', () => {
    const L = stand.layout;
    for (const floor of L.strips.floors) {
      const ref = at(L.strips.xs[0]!, floor + 0.8);
      for (const x of L.strips.xs) expect(at(x, floor + 0.8)).toEqual(ref);
    }
    const midY = (L.climb.floorY + L.climb.topY) / 2;
    const ref = at(L.climb.ladders[0]!, midY);
    for (const x of L.climb.ladders) expect(at(x, midY)).toEqual(ref);
  });
  it('torches are sparse: drifts and the network ~7 tiles apart, the hall has 3', () => {
    const torches = stand.world.props.filter((p) => p.type === 13);
    const hall = torches.filter((p) => p.x >= stand.layout.izba.x0 && p.x <= stand.layout.izba.x1);
    expect(hall.length).toBe(3);
    const row0 = stand.layout.net.tunnels[0]!;
    const net = torches.filter((p) => p.x > row0.x0 && p.x < row0.x1 && Math.abs(p.y - (row0.floorY + 1.7)) < 0.6).map((p) => p.x).sort((a, b) => a - b);
    for (let k = 1; k < net.length; k++) expect(net[k]! - net[k - 1]!).toBeGreaterThanOrEqual(6);
  });
  it('hall furniture stands fully behind the figures (no prop cuts a hull)', () => {
    // the line-up of the izba shot (torch ± 3 tiles); the two foreground pieces stand at the hall's ends
    const c = stand.layout.izba.torchX;
    const behind = stand.dressing.filter((d) => Math.abs(d.x - c) < 3.2 && !['planks', 'beam'].includes(d.kind));
    expect(behind.length).toBeGreaterThan(8);
    for (const d of behind) expect(d.z, d.kind).toBeLessThanOrEqual(-0.84);
    for (const d of stand.dressing.filter((x) => x.kind === 'support')) expect(d.z).toBeLessThanOrEqual(-0.84);
  });
});
