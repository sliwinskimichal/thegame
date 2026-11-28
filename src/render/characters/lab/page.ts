/**
 * dwarves.html — tournament station of the dwarf team (owner: W3 "Technical artist").
 * URL: dwarves.html?variant=<id>&shot=<id>[&hud=0][&light=v1|<LIGHT_VARIANTS id>][&scale=<worldPerModel>]
 *      [&mirror=discard|split][&nobloom=1][&enginepx=<k>]
 * Unknown variant / shot / light = error (like BUG-001 of the lab): HUD in red, window.__dwarfError, throw.
 * Rendering is on demand (no RAF loop): every shot is deterministic (fixed uTime, posed clips).
 * Style: the game's illustrated style v1 (STYLE_ILLUSTRATED_V1 = i08 + L16: L12 light, ink over bloom,
 * lava from L14) through createIllustratedWith from the engine lab — the dwarves are extra meshes in the
 * same scene, so they get exactly the same light, bloom and ink restoration.
 * Frame semantics (contract v2, LAB_FRAME): 960×540 = 1:1 crop of a 1080p screen; dwarf lines use
 * ZOOMS.hullPx directly, every engine pixel width reachable through uniforms is multiplied by
 * LAB_FRAME.enginePxScale.
 * Automation: window.__dwarf (DwarfLabApi + extras), used by scripts/dwarf-tournament.mjs.
 */
import * as THREE from 'three';
import { animMetrics, createAnimator, MV, SIM, WORK } from '../../anim/index';
import type { AnimInput, AnimWorldProbe } from '../../anim/types';
import { daylightAt } from '../../daylight';
import { WorldTex } from '../../worldTex';
import { LightField } from '../../../world/lightfield';
import { createIllustratedWith, I08_DRAWING, illParams, LIGHT_VARIANTS, STYLE_ILLUSTRATED_V1, type IllParams } from '../../../lab/styles/illustrated';
import type { StyleContext, StyleInstance } from '../../../lab/style';
import { CHARACTER_SCALE, LAB_FRAME, refHeightTiles, ZOOMS } from '../direction';
import { canonicalSpec, DWARF_VARIANTS, makeSpec } from '../model/index';
import {
  cameraDistance,
  ROLE,
  SHOT_IDS,
  SOCIAL,
  type CostMetrics,
  type DwarfLabApi,
  type DwarfModel,
  type DwarfVariant,
  type MakeSpec,
  type RoleId,
  type ShotDef,
  type ShotDwarf,
  type ShotId,
  type ShotMetrics,
} from '../types';
import { FLOATS_PER_ROW, writeSkinRow } from '../render/boneTexture';
import { CrowdRenderer, mulAffine, type CrowdMemberEx } from '../render/crowd';
import { FIXTURE_VARIANTS, fixtureSpec } from '../render/fixture';
import { modelHeight, variantHeight } from '../render/lod';
import { DEFAULT_TONE, toneFromParams, type ToneParams } from '../render/materials';
import * as MX from './metrics';
import { buildShots } from './shots';
import { buildStandWorld, TUNNEL_Z } from './world';

type Box = { role: RoleId; x0: number; y0: number; x1: number; y1: number };
type ContrastEx = NonNullable<ShotMetrics['contrast']>[number] & { light: number; fillPx: number; ringPx: number };

/** Tone of the station (tuned on the fixture against the figure/ground and accent metrics; see the report). */
export const DWARF_TONE: ToneParams = { ...DEFAULT_TONE, ambK: 0.25, lightK: 0.35, lightCap: 1.0, figDesat: 0.7, selfLight: 0.1 };
const SHOT_TIME = 1.5; // fixed uTime of every shot (deterministic flicker, grain, dust)
const LAYER_WORLD = 0;
const LAYER_CROWD = 1;
const LAYER_OTHER = 2; // sky, transparent sheets: not occluders of the mask pass

export function startDwarfLab(): void {
  const params = new URLSearchParams(location.search);
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const hud = document.getElementById('hud')!;
  if (params.get('hud') === '0') hud.style.display = 'none';
  let failed = false;
  const fail = (msg: string): never => {
    failed = true;
    hud.style.display = 'block';
    hud.style.color = '#ff6b5a';
    hud.textContent = `BŁĄD stanowiska krasnoludów: ${msg}`;
    (window as unknown as { __dwarfError: string }).__dwarfError = msg;
    console.error(`[dwarves] ${msg}`);
    throw new Error(msg);
  };

  // ---- character scale (contract v2: set once at start-up for every variant)
  if (params.has('scale')) {
    const s = Number(params.get('scale'));
    if (!(s > 0.2 && s < 5)) fail(`nieprawidłowa skala "${params.get('scale')}" (0,2–5)`);
    CHARACTER_SCALE.worldPerModel = s;
  }
  const VARIANTS: readonly DwarfVariant[] = [...DWARF_VARIANTS, ...FIXTURE_VARIANTS];
  const variantIds = VARIANTS.map((v) => v.id);
  const wantVariant = params.get('variant') ?? variantIds[0]!;
  if (!variantIds.includes(wantVariant)) fail(`nieznany wariant "${wantVariant}" (znane: ${variantIds.join(', ')})`);
  const wantShot = (params.get('shot') ?? 'izba') as ShotId;
  if (!SHOT_IDS.includes(wantShot)) fail(`nieznane ujęcie "${wantShot}" (znane: ${SHOT_IDS.join(', ')})`);
  const lightId = params.get('light') ?? 'v1';
  let styleParams: IllParams;
  if (lightId === 'v1') styleParams = { ...STYLE_ILLUSTRATED_V1.params };
  else {
    const lv = LIGHT_VARIANTS.find((v) => v.id === lightId);
    if (!lv) fail(`nieznane światło "${lightId}" (v1 albo: ${LIGHT_VARIANTS.map((v) => v.id).join(', ')})`);
    styleParams = illParams({ ...I08_DRAWING, ...lv!.params });
  }
  const mirror = params.get('mirror') ?? 'discard';
  if (mirror !== 'discard' && mirror !== 'split') fail(`nieznany tryb lustra "${mirror}" (discard | split)`);
  const enginePx = params.has('enginepx') ? Number(params.get('enginepx')) : LAB_FRAME.enginePxScale;
  let tone: ToneParams = DEFAULT_TONE;
  try {
    tone = toneFromParams(params, DWARF_TONE);
  } catch (e) {
    fail((e as Error).message);
  }

  // ---- world, light field, GPU mirrors
  const stand = buildStandWorld(7);
  const world = stand.world;
  const light = new LightField(world.w, world.h);
  light.compute(world);
  const tex = new WorldTex(world, light);
  const shots = buildShots(stand.layout);

  // ---- renderer and camera (as the lab: FOV 30, ACES, pixel ratio 1)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const W = canvas.clientWidth || innerWidth;
  const H = canvas.clientHeight || innerHeight;
  renderer.setSize(W, H, false);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 1200);
  camera.layers.enable(LAYER_CROWD);
  camera.layers.enable(LAYER_OTHER);

  // ---- the style with the crowd as extra content
  let scene!: THREE.Scene;
  let u!: Record<string, THREE.IUniform>;
  const ctx: StyleContext = {
    renderer,
    camera,
    world,
    light,
    tex,
    arena: { world, dressing: stand.dressing, poi: {}, unexplored: { x0: 0, y0: 0, x1: -1, y1: -1 } },
    width: W,
    height: H,
  };
  const style: StyleInstance = createIllustratedWith(ctx, styleParams, (sc, uu) => {
    scene = sc;
    u = uu;
    scaleEngineWidths(sc, uu, enginePx);
    sc.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (o instanceof THREE.Mesh && mat && (mat.transparent || mat.depthWrite === false)) o.layers.set(LAYER_OTHER);
    });
  });
  const lights = { pos: u.uDynPos!.value as THREE.Vector4[], col: u.uDynCol!.value as THREE.Vector4[], count: u.uDynCount as THREE.IUniform<number> };
  const makeCrowd = () => {
    const c = new CrowdRenderer({ style: u, lights, layer: LAYER_CROWD, mirror: mirror as 'discard' | 'split', tone });
    scene.add(c.group);
    return c;
  };
  let crowd = makeCrowd();

  // ---- variants
  let variant: DwarfVariant = VARIANTS[0]!;
  let templates: DwarfModel[] = [];
  const specOf = (v: DwarfVariant): MakeSpec => (FIXTURE_VARIANTS.includes(v) ? fixtureSpec : makeSpec);
  const animProbe: AnimWorldProbe = stand.probe;
  const modelFor = (role: RoleId, seed: number, social: number): DwarfModel => {
    const t = templates[role]!;
    const spec = specOf(variant)(seed, role, social as ShotDwarf['social'], variant.proportions);
    return { ...t, spec, rig: { ...t.rig, seed } };
  };
  const makeMember = (d: ShotDwarf): CrowdMemberEx => {
    const model = modelFor(d.role, d.seed, d.social);
    const anim = createAnimator(model.rig, { viewYawDeg: model.viewYawDeg, worldPerModel: CHARACTER_SCALE.worldPerModel, probe: animProbe });
    return { model, anim, visible: true, lampOn: d.lampOn !== false };
  };

  async function setVariant(id: string): Promise<void> {
    const v = VARIANTS.find((x) => x.id === id);
    if (!v) throw new Error(`[dwarves] nieznany wariant "${id}"`);
    variant = v;
    const spec = specOf(v);
    // one geometry per (variant, role, LOD), built from the model team's canonical spec (contract v2 §5)
    const fixture = FIXTURE_VARIANTS.includes(v);
    templates = [ROLE.MINER, ROLE.CARPENTER, ROLE.PORTER, ROLE.SMITH].map((r) => v.build(fixture ? spec(11 + r, r, SOCIAL.FREE_MINER, v.proportions) : canonicalSpec(r, v.proportions)));
    crowd.dispose();
    scene.remove(crowd.group);
    crowd = makeCrowd();
    current = null;
  }

  // ---- shot staging
  interface Staged {
    shot: ShotDef;
    members: CrowdMemberEx[];
  }
  let current: Staged | null = null;

  const inputFor = (d: ShotDwarf): AnimInput => {
    const work = d.clip === 'dig' ? WORK.DIG : d.clip === 'build' ? WORK.BUILD : WORK.NONE;
    const sim = work ? SIM.WORK : d.clip === 'idle' ? SIM.IDLE : d.clip === 'flee' ? SIM.FLEE : d.clip === 'stunned' ? SIM.STUNNED : SIM.GOTO;
    const h = refHeightTiles();
    return {
      sim,
      x: d.x,
      y: d.y,
      facing: d.facing,
      edge: null,
      work,
      workX: work ? d.x + d.facing * h * 0.75 : Number.NaN,
      workY: work ? d.y + h * 0.45 : Number.NaN,
      carry: d.carry ?? 0,
      danger: 0,
    };
  };
  /** Pose failures of the animator (a clip it does not know yet) are recorded, never hidden: warning + idle. */
  const poseErrors: string[] = [];
  const poseMember = (m: CrowdMemberEx, d: ShotDwarf) => {
    try {
      m.anim.pose(d.clip, d.phase, inputFor(d));
    } catch (e) {
      const msg = `pose(${d.clip}, ${d.phase.toFixed(3)}): ${(e as Error).message}`;
      if (!poseErrors.includes(msg)) {
        poseErrors.push(msg);
        console.warn(`[dwarves] ${msg} — zastępczo idle`);
      }
      m.anim.pose('idle', d.phase, { ...inputFor(d), sim: SIM.IDLE, work: WORK.NONE });
    }
    if (d.z !== undefined) m.anim.placement[14] = d.z;
  };

  function placeCamera(s: ShotDef): void {
    const d = cameraDistance(ZOOMS[s.zoom].pxPerTile, H);
    camera.position.set(s.x, s.y + d * 0.07, d);
    camera.lookAt(s.x, s.y, -0.5);
    camera.updateMatrixWorld();
    (u.uCamPos!.value as THREE.Vector3).copy(camera.position);
  }

  function stage(id: ShotId): Staged {
    const shot = shots[id];
    const members = shot.dwarves.map((d) => {
      const m = makeMember(d);
      poseMember(m, d);
      return m;
    });
    placeCamera(shot);
    current = { shot, members };
    return current;
  }

  const WHITE = new THREE.Color(1, 1, 1);
  function renderColor(s: Staged): void {
    crowd.setMode('color');
    crowd.setTime(SHOT_TIME);
    crowd.sync(s.members, camera, H);
    camera.layers.set(LAYER_WORLD);
    camera.layers.enable(LAYER_CROWD);
    camera.layers.enable(LAYER_OTHER);
    style.render({ time: SHOT_TIME, tod: s.shot.tod, day: daylightAt(s.shot.tod) });
  }
  function renderSil(s: Staged, only = -1): void {
    s.members.forEach((m, i) => (m.visible = only < 0 || i === only));
    crowd.setMode('sil');
    crowd.sync(s.members, camera, H);
    const bg = scene.background;
    scene.background = WHITE;
    camera.layers.set(LAYER_CROWD);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    scene.background = bg;
    camera.layers.set(LAYER_WORLD);
    camera.layers.enable(LAYER_CROWD);
    camera.layers.enable(LAYER_OTHER);
    s.members.forEach((m) => (m.visible = true));
  }

  const readCanvas = (): MX.Rgba => {
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return { w: W, h: H, data: MX.flipRows(buf, W, H) };
  };

  // mask pass: world depth (occluders only), then the crowd in mask mode, into an offscreen target
  const maskRT = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true });
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  const prevClear = new THREE.Color();
  function renderMask(s: Staged, only: number): MX.Rgba {
    s.members.forEach((m, i) => (m.visible = only < 0 || i === only));
    crowd.setMode('mask');
    crowd.sync(s.members, camera, H);
    renderer.getClearColor(prevClear);
    const prevAlpha = renderer.getClearAlpha();
    const auto = renderer.autoClear;
    const tm = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(maskRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);
    renderer.autoClear = false;
    camera.layers.set(LAYER_WORLD);
    scene.overrideMaterial = depthOnly;
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.set(LAYER_CROWD);
    renderer.render(scene, camera);
    renderer.autoClear = auto;
    renderer.toneMapping = tm;
    renderer.setClearColor(prevClear, prevAlpha);
    const buf = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(maskRT, 0, 0, W, H, buf);
    renderer.setRenderTarget(null);
    camera.layers.set(LAYER_WORLD);
    camera.layers.enable(LAYER_CROWD);
    camera.layers.enable(LAYER_OTHER);
    s.members.forEach((m) => (m.visible = true));
    crowd.setMode('color');
    return { w: W, h: H, data: MX.flipRows(buf, W, H) };
  }

  // ---- screen boxes by CPU skinning of the drawn LOD (exact, padded by the outline)
  const skinTmp = new Float32Array(FLOATS_PER_ROW);
  const mTmp = new Float32Array(16);
  const v = new THREE.Vector3();
  function boxOf(m: CrowdMemberEx): Box {
    const lod = crowd.lodOf(m.anim);
    const mesh = m.model.lods[lod];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x: number, y: number, z: number) => {
      v.set(x, y, z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * W;
      const sy = (1 - (v.y * 0.5 + 0.5)) * H;
      if (sx < x0) x0 = sx;
      if (sx > x1) x1 = sx;
      if (sy < y0) y0 = sy;
      if (sy > y1) y1 = sy;
    };
    if (mesh.geometry) {
      writeSkinRow(m.anim.placement, m.anim.bones, m.model.rig.rest, skinTmp, 0);
      const pos = mesh.geometry.getAttribute('position')!;
      const bones = mesh.geometry.getAttribute('aBones')!;
      const wts = mesh.geometry.getAttribute('aWeight')!;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const w = wts.getX(i);
        let X = 0, Y = 0, Z = 0;
        for (const [b, ww] of [[bones.getX(i), w], [bones.getY(i), 1 - w]] as const) {
          if (ww <= 0) continue;
          const k = Math.round(b) * 12;
          X += ww * (skinTmp[k]! * px + skinTmp[k + 1]! * py + skinTmp[k + 2]! * pz + skinTmp[k + 3]!);
          Y += ww * (skinTmp[k + 4]! * px + skinTmp[k + 5]! * py + skinTmp[k + 6]! * pz + skinTmp[k + 7]!);
          Z += ww * (skinTmp[k + 8]! * px + skinTmp[k + 9]! * py + skinTmp[k + 10]! * pz + skinTmp[k + 11]!);
        }
        add(X, Y, Z);
      }
    } else {
      for (const p of mesh.parts ?? []) {
        mulAffine(m.anim.placement, m.anim.bones, p.bone * 16, mTmp, 0);
        const pos = p.geometry.getAttribute('position')!;
        for (let i = 0; i < pos.count; i++) {
          const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
          add(mTmp[0]! * px + mTmp[4]! * py + mTmp[8]! * pz + mTmp[12]!, mTmp[1]! * px + mTmp[5]! * py + mTmp[9]! * pz + mTmp[13]!, mTmp[2]! * px + mTmp[6]! * py + mTmp[10]! * pz + mTmp[14]!);
        }
      }
    }
    const pad = ZOOMS.izba.hullPx + 2;
    return { role: m.model.spec.role, x0: Math.floor(x0 - pad), y0: Math.floor(y0 - pad), x1: Math.ceil(x1 + pad), y1: Math.ceil(y1 + pad) };
  }

  // Frame cost: wall time of the frame bracketed by a 1-pixel readPixels of the canvas. Unlike gl.finish (a
  // flush in Chromium's command buffer), a readback blocks until the GPU (SwiftShader: the CPU) is done.
  const px1 = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);
  const timed = (fn: () => void): number => {
    sync();
    const t0 = performance.now();
    fn();
    sync();
    return performance.now() - t0;
  };

  async function shot(id: ShotId): Promise<{ boxes: Box[]; renderMs: number }> {
    if (!SHOT_IDS.includes(id)) throw new Error(`[dwarves] nieznane ujęcie "${id}"`);
    const s = stage(id);
    const sil = s.shot.kind === 'sil';
    // first frame compiles shaders; the measured frame is the second (same image)
    if (sil) renderSil(s);
    else renderColor(s);
    const renderMs = timed(() => (sil ? renderSil(s) : renderColor(s)));
    const boxes = s.members.map(boxOf);
    hudText(`${variant.namePl} · ${s.shot.namePl} · ${renderMs.toFixed(1)} ms`);
    return { boxes, renderMs };
  }

  /** Light-field level (max channel) at a dwarf's chest: >= 1.0 = in the pool, below = edge / dark. */
  const lightAtChest = (d: ShotDwarf): number => {
    const tx = Math.floor(d.x);
    const ty = Math.floor(-(d.y + refHeightTiles() * 0.6));
    if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return 0;
    const i = ty * world.w + tx;
    return Math.max(light.r[i]!, light.g[i]!, light.b[i]!);
  };

  async function analyze(id: ShotId): Promise<ShotMetrics> {
    const { boxes } = await shot(id);
    const s = current!;
    const res: ShotMetrics = { shot: id };
    if (s.shot.metrics.includes('contrast') || s.shot.metrics.includes('accent')) {
      const color = readCanvas();
      const union = renderMask(s, -1);
      const unionFig = MX.maskWhere(union, (r) => r > 60);
      const contrast: ContrastEx[] = [];
      const accent: { role: RoleId; share: number; shareRel: number }[] = [];
      s.members.forEach((m, i) => {
        const mask = renderMask(s, i);
        const fill = MX.maskWhere(mask, (r) => r > 200);
        const fig = MX.maskWhere(mask, (r) => r > 60);
        const others: MX.BinMask = { w: W, h: H, data: unionFig.data.map((x, k) => (x && !fig.data[k] ? 1 : 0)) };
        const c = MX.figureGround(color, fill, fig, others);
        const lightLvl = lightAtChest(s.shot.dwarves[i]!);
        contrast.push({ role: m.model.spec.role, fillL: c.fillL, ringL: c.ringL, dL: c.dL, lit: lightLvl >= 1.0, light: lightLvl, fillPx: c.fillPx, ringPx: c.ringPx });
        accent.push({ role: m.model.spec.role, share: MX.accentShare(color, fill), shareRel: MX.accentShare(color, fill, 30, 85, [c.ringA, c.ringB]) });
      });
      renderColor(s); // the canvas shows the colour frame again
      if (s.shot.metrics.includes('contrast')) res.contrast = contrast;
      if (s.shot.metrics.includes('accent')) res.accent = accent;
    }
    if (s.shot.metrics.includes('silhouette')) {
      const img = readCanvas();
      const black = MX.maskWhere(img, (r, g, b) => r + g + b < 384);
      const masks: MX.BinMask[][] = [[], [], [], []];
      s.members.forEach((m, i) => {
        const b = boxes[i]!;
        masks[m.model.spec.role]!.push(MX.cropMask(black, b.x0, b.y0, b.x1, b.y1));
      });
      const sm = MX.silhouetteMetrics(masks);
      res.silhouette = { px: ZOOMS[s.shot.zoom].dwarfPx, pairDistance: sm.pairDistance, minPair: sm.minPair, accuracy: sm.accuracy };
    }
    if (s.shot.metrics.includes('stability')) {
      // every frame rendered alone at the position of the row's first frame: the masks share one frame of reference
      const out: { clip: string; meanIoU: number; minIoU: number }[] = [];
      for (let r = 0; r < 4; r++) {
        const rowIdx = s.shot.dwarves.map((d, i) => ({ d, i })).filter((e) => Math.floor((e.i) / 8) === r);
        if (!rowIdx.length) continue;
        const x0 = rowIdx[0]!.d.x;
        const frames: MX.BinMask[] = [];
        let box: Box | null = null;
        for (const { d, i } of rowIdx) {
          poseMember(s.members[i]!, { ...d, x: x0 });
          renderSil(s, i);
          if (!box) {
            const b = boxOf(s.members[i]!);
            const pad = refHeightTiles() * ZOOMS[s.shot.zoom].pxPerTile * 0.45;
            box = { ...b, x0: b.x0 - pad, x1: b.x1 + pad, y0: b.y0 - pad * 0.5, y1: b.y1 + pad * 0.2 };
          }
          frames.push(MX.cropMask(MX.maskWhere(readCanvas(), (rr, g, b) => rr + g + b < 384), box.x0, box.y0, box.x1, box.y1));
          poseMember(s.members[i]!, d);
        }
        const st = MX.stability(frames);
        out.push({ clip: `${s.shot.dwarves[rowIdx[0]!.i]!.clip}:${['hajer', 'ciesla', 'tragarz', 'kowal'][rowIdx[0]!.d.role]}`, ...st });
      }
      res.stability = out;
      renderSil(s);
    }
    return res;
  }

  // ---- cost benchmark
  function benchMembers(n: number): { members: CrowdMemberEx[]; inputs: AnimInput[] } {
    const net = stand.layout.net;
    const members: CrowdMemberEx[] = [];
    const inputs: AnimInput[] = [];
    for (let k = 0; k < n; k++) {
      const t = net.tunnels[k % net.tunnels.length]!;
      const role = (k % 4) as RoleId;
      const span = t.x1 - t.x0 - 2;
      const x = t.x0 + 1 + ((k * 7.31) % span);
      const facing: 1 | -1 = k % 2 ? 1 : -1;
      const d: ShotDwarf = { role, social: SOCIAL.FREE_MINER, seed: 9000 + k, x, y: t.floorY, facing, clip: 'walk', phase: (k * 0.137) % 1 };
      const m = makeMember(d);
      members.push(m);
      const inp = inputFor(d);
      inp.sim = SIM.GOTO;
      inp.edge = { move: facing > 0 ? MV.WALK_R : MV.WALK_L, fromX: x, fromY: t.floorY, toX: x + facing, toY: t.floorY, t: 0, durationMs: 900, rows: 0 };
      inputs.push(inp);
    }
    return { members, inputs };
  }

  async function bench(n: number): Promise<CostMetrics & Record<string, number | number[] | string>> {
    const K = 9;
    const trianglesPerLod = [0, 1, 2].map((l) => templates.reduce((s, t) => s + t.lods[l as 0 | 1 | 2].triangles, 0) / templates.length) as [number, number, number];
    const { members, inputs } = benchMembers(n);
    const net = stand.layout.net;
    const benchShot = (zoom: 'grod' | 'okolica'): ShotDef => ({ id: 'okolica', namePl: 'bench', kind: 'crowd', zoom, x: net.centerX, y: net.centerY, tod: 0.92, dwarves: [], metrics: [] });
    const run = (zoom: 'grod' | 'okolica', list: CrowdMemberEx[], animate: boolean) => {
      placeCamera(benchShot(zoom));
      const frames: number[] = [];
      const anim: number[] = [];
      const upload: number[] = [];
      for (let f = 0; f < K + 2; f++) {
        const ta = performance.now();
        if (animate) {
          for (let i = 0; i < list.length; i++) {
            const inp = inputs[i]!;
            inp.edge!.t = (inp.edge!.t + 1 / 54) % 1;
            list[i]!.anim.update(inp, 1 / 60);
          }
        }
        crowd.setMode('color');
        crowd.sync(list, camera, H);
        const am = performance.now() - ta;
        const fm = timed(() => style.render({ time: SHOT_TIME + f / 60, tod: 0.92, day: daylightAt(0.92) }));
        if (f >= 2) {
          frames.push(fm);
          anim.push(am);
          upload.push(crowd.stats.uploadMs);
        }
      }
      return { frameMs: MX.median(frames), animMs: MX.median(anim), syncMs: MX.median(upload), drawCalls: crowd.stats.drawCalls, triangles: crowd.stats.triangles };
    };
    crowd.setCull(false);
    const one = run('grod', members.slice(0, 1), false);
    const zero = run('grod', [], false);
    const full = run('grod', members, true);
    const far = run('okolica', members, true);
    crowd.setCull(true);
    current = null;
    const heights = templates.map(modelHeight);
    return {
      variantId: variant.id,
      trianglesPerLod,
      drawCalls200: full.drawCalls,
      drawCalls1: one.drawCalls,
      frameMs0: zero.frameMs,
      frameMs200: full.frameMs,
      animMs200: full.animMs,
      // extras (metrics.json)
      n,
      triangles200: full.triangles,
      syncMs200: full.syncMs,
      animOnlyMs200: full.animMs - full.syncMs,
      frameMs200Okolica: far.frameMs,
      drawCalls200Okolica: far.drawCalls,
      animMs200Okolica: far.animMs,
      heightsModel: heights,
      heightModel: variantHeight(templates),
      heightTiles: variantHeight(templates) * CHARACTER_SCALE.worldPerModel,
      worldPerModel: CHARACTER_SCALE.worldPerModel,
      mirror,
      method: 'wall time bracketed by a 1-px readPixels (SwiftShader: relative only)',
    };
  }

  function hudText(t: string): void {
    if (!failed) hud.textContent = t;
  }

  const api: DwarfLabApi & Record<string, unknown> = {
    variants: variantIds,
    shots: SHOT_IDS,
    setVariant,
    shot,
    analyze,
    bench,
    anim: () => animMetrics(templates[ROLE.MINER]!.rig),
    get current() {
      return variant.id;
    },
    get shotId() {
      return current?.shot.id ?? null;
    },
    get scale() {
      return CHARACTER_SCALE.worldPerModel;
    },
    light: lightId,
    mirror,
    names: Object.fromEntries(VARIANTS.map((x) => [x.id, x.namePl])),
    shotNames: Object.fromEntries(SHOT_IDS.map((x) => [x, shots[x].namePl])),
    heights: () => ({ model: templates.map(modelHeight), median: variantHeight(templates), tiles: variantHeight(templates) * CHARACTER_SCALE.worldPerModel, refTiles: refHeightTiles() }),
    stats: () => ({ ...crowd.stats }),
    poseErrors: () => [...poseErrors],
    tone: () => ({ ...tone }),
    playZ: TUNNEL_Z,
  };
  (window as unknown as { __dwarf: unknown }).__dwarf = api;

  void (async () => {
    try {
      await setVariant(wantVariant);
      await shot(wantShot);
      (window as unknown as { __dwarfReady: boolean }).__dwarfReady = true;
    } catch (e) {
      fail((e as Error).message);
    }
  })();
}

/**
 * Contract v2 §11: engine widths are defined for a 540-tall canvas showing the whole screen; our frame is a
 * 1:1 crop of 1080p, so every engine pixel width reachable through uniforms is scaled (contour, hatching of
 * the unknown, shadow marks, prop hulls). The bloom radius (in px of the frame) cannot be — known deviation.
 */
export function scaleEngineWidths(scene: THREE.Scene, u: Record<string, THREE.IUniform>, k: number): void {
  if (k === 1) return;
  const inkW = u.uInkW?.value as THREE.Vector3 | undefined;
  if (inkW) {
    inkW.x *= k;
    inkW.z *= k;
  }
  if (u.uFogHatchPx) u.uFogHatchPx.value = (u.uFogHatchPx.value as number) * k;
  if (u.uMarkPx) u.uMarkPx.value = (u.uMarkPx.value as number) * k;
  const seen = new Set<THREE.IUniform>();
  scene.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
      const hu = (m as THREE.ShaderMaterial).uniforms?.uHullPx;
      if (hu && !seen.has(hu)) {
        seen.add(hu);
        hu.value = (hu.value as number) * k;
      }
    }
  });
}
