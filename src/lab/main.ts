/**
 * Tournament lab: renders one lab world with one style from one fixed scenario.
 * URL: lab.html?style=<id>&scenario=<id>[&world=arena|gallery|tone][&seed=<uint>][&hud=0]
 *      [&mat=<variant>][&flood=1][&torch=r,g,b]
 * Unknown ids are errors (BUG-001): the HUD shows them, `window.__labError` is set and the
 * page throws instead of silently rendering another style or scenario.
 * Automation API on window.__lab (see scripts/tournament.mjs):
 *   styleId / style (id actually rendered), scenarioId, world, seed, styles, scenarios,
 *   setScenario(id, settleFrames) (rejects unknown ids), probes(), layout,
 *   frameMs (p50 of frames bracketed by gl.finish(), sampled after each scenario change;
 *   method in frameMethod), measure(frames, warmup) (timer query when available, BUG-002).
 */
import * as THREE from 'three';
import { daylightAt } from '../render/daylight';
import { WorldTex } from '../render/worldTex';
import { LightField } from '../world/lightfield';
import { SOLID } from '../world/materials';
import { CAV, FLUID, PROP, PROP_GLOW, TF } from '../world/world';
import { buildArena } from './arena';
import { measureFrames, summarizeFrames } from './frametime';
import { buildGallery } from './gallery';
import { applyMaterialVariant } from './materialVariants';
import { parseLabParams, type LabWorld } from './params';
import { GALLERY_SCENARIOS, SCENARIOS, TONE_SCENARIOS, type Scenario } from './scenarios';
import type { FrameState, StyleContext, StyleInstance } from './style';
import { STYLES } from './styles';
import { buildToneScenes } from './toneScenes';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const hud = document.getElementById('hud')!;
if (params.get('hud') === '0') hud.style.display = 'none';

function fail(msg: string): never {
  hud.style.display = 'block';
  hud.style.color = '#ff6b5a';
  hud.textContent = `BŁĄD laboratorium: ${msg}`;
  (window as unknown as { __labError: string }).__labError = msg;
  console.error(`[lab] ${msg}`);
  throw new Error(msg);
}

const SCEN_BY_WORLD: Record<LabWorld, readonly Scenario[]> = { arena: SCENARIOS, gallery: GALLERY_SCENARIOS, tone: TONE_SCENARIOS };
const P = parseLabParams(
  location.search,
  STYLES.map((s) => s.id),
  { arena: SCENARIOS.map((s) => s.id), gallery: GALLERY_SCENARIOS.map((s) => s.id), tone: TONE_SCENARIOS.map((s) => s.id) },
);
if (P.errors.length) fail(P.errors.join('; '));

try {
  applyMaterialVariant(params.get('mat'));
} catch (e) {
  fail((e as Error).message);
}
if (params.has('torch')) {
  const [r, g, b] = params.get('torch')!.split(',').map(Number);
  PROP_GLOW[PROP.TORCH] = [r!, g!, b!];
}
const arena = P.world === 'gallery' ? buildGallery(P.seed ?? 4242) : P.world === 'tone' ? buildToneScenes(P.seed ?? 1) : buildArena(P.seed ?? 777);
const SCEN = SCEN_BY_WORLD[P.world];
const world = arena.world;
const light = new LightField(world.w, world.h);
light.compute(world);
if (params.get('flood') === '1') {
  // neutral work light everywhere: judges the palette itself, not the lighting
  light.r.fill(0.9);
  light.g.fill(0.9);
  light.b.fill(0.9);
  light.pack();
}
const tex = new WorldTex(world, light);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const gl = renderer.getContext() as WebGL2RenderingContext;
const W = () => canvas.clientWidth || innerWidth;
const H = () => canvas.clientHeight || innerHeight;
renderer.setSize(W(), H(), false);
const camera = new THREE.PerspectiveCamera(30, W() / H(), 0.5, 1200);

let scenario: Scenario = P.scenarioId ? SCEN.find((s) => s.id === P.scenarioId)! : SCEN[0]!;
function placeCamera(s: Scenario): void {
  camera.position.set(s.x, s.y + s.d * 0.07, s.d);
  camera.lookAt(s.x, s.y, -0.5);
  camera.updateMatrixWorld();
}
placeCamera(scenario);

const styleDef = STYLES.find((s) => s.id === P.styleId)!;
const ctx: StyleContext = { renderer, camera, world, light, tex, arena, width: W(), height: H() };
const style: StyleInstance = styleDef.create(ctx);

const t0 = performance.now();
const state = (): FrameState => ({ time: (performance.now() - t0) / 1000, tod: scenario.t, day: daylightAt(scenario.t) });
let frames = 0;
let sinceChange = 0;
const samples: number[] = [];
function frame(): void {
  // synced samples (gl.finish around render) right after a scenario change, then every 4th frame
  const sample = sinceChange >= 2 && (sinceChange < 10 || sinceChange % 4 === 0);
  if (sample) {
    gl.finish();
    const ts = performance.now();
    style.render(state());
    gl.finish();
    samples.push(performance.now() - ts);
    if (samples.length > 30) samples.shift();
  } else style.render(state());
  frames++;
  sinceChange++;
  const ms = summarizeFrames(samples, 'gl.finish').p50;
  hud.textContent = `${styleDef.namePl} · ${scenario.namePl} · ${Number.isFinite(ms) ? ms.toFixed(1) : '…'} ms (gl.finish)`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/** Screen-space samples of tile categories for automated readability metrics. */
function probes(): { x: number; y: number; tx: number; ty: number; cat: string; mat: number }[] {
  const out: { x: number; y: number; tx: number; ty: number; cat: string; mat: number }[] = [];
  const v = new THREE.Vector3();
  const w = W();
  const h = H();
  for (let y = 0; y < world.h; y++)
    for (let x = 0; x < world.w; x++) {
      const i = world.idx(x, y);
      const solid = SOLID[world.mat[i]!] === 1;
      const explored = (world.flags[i]! & TF.EXPLORED) !== 0;
      let cat: string;
      if (!explored) cat = 'unexplored';
      else if (world.cav[i] === CAV.SKY) cat = 'sky';
      else if (world.fluidKind[i] === FLUID.WATER) cat = 'water';
      else if (world.fluidKind[i] === FLUID.LAVA) cat = 'lava';
      else if (solid) cat = 'solid';
      else cat = world.cav[i] === CAV.DUG ? 'dug' : 'cave';
      v.set(x + 0.5, -y - 0.5, solid || !explored ? 0 : -(world.depth[i]! / 32) * 0.5).project(camera);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (1 - (v.y * 0.5 + 0.5)) * h;
      if (sx < 2 || sy < 2 || sx > w - 2 || sy > h - 2) continue;
      out.push({ x: Math.round(sx), y: Math.round(sy), tx: x, ty: y, cat, mat: world.mat[i]! });
    }
  return out;
}

/**
 * Light-pool probes for the falloff guard (tournament #3 round 2): for every torch in view, the
 * screen position of the pool centre on the back wall (0.6 tiles under the flame) and of the back
 * wall 3 tiles to each side (only where that tile is open and explored).
 */
function lightProbes(): { x: number; y: number; side: { x: number; y: number }[] }[] {
  const out: { x: number; y: number; side: { x: number; y: number }[] }[] = [];
  const v = new THREE.Vector3();
  const w = W();
  const h = H();
  const scr = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(camera);
    return { x: Math.round((v.x * 0.5 + 0.5) * w), y: Math.round((1 - (v.y * 0.5 + 0.5)) * h) };
  };
  const open = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= world.w || y >= world.h) return false;
    const i = world.idx(x, y);
    return SOLID[world.mat[i]!] !== 1 && (world.flags[i]! & TF.EXPLORED) !== 0 && world.cav[i] !== CAV.SKY && !world.fluidKind[i];
  };
  for (const pr of world.props) {
    if (pr.type !== PROP.TORCH) continue;
    const cy = pr.y - 0.6;
    const ty = Math.floor(-cy);
    const c = scr(pr.x, cy, pr.z + 0.02);
    if (c.x < 4 || c.y < 4 || c.x > w - 4 || c.y > h - 4) continue;
    const side: { x: number; y: number }[] = [];
    for (const dx of [-3, 3]) {
      const tx = Math.floor(pr.x + dx);
      if (!open(tx, ty)) continue;
      const z = -(world.depth[world.idx(tx, ty)]! / 32) + 0.02;
      const s = scr(pr.x + dx, cy, z);
      if (s.x >= 4 && s.y >= 4 && s.x <= w - 4 && s.y <= h - 4) side.push(s);
    }
    if (side.length) out.push({ ...c, side });
  }
  return out;
}

(window as unknown as { __lab: unknown }).__lab = {
  lightProbes,
  styles: STYLES.map((s) => s.id),
  scenarios: SCEN.map((s) => s.id),
  styleId: styleDef.id,
  style: styleDef.id,
  world: P.world,
  seed: P.seed,
  mat: params.get('mat') ?? 'm13-designed',
  get scenarioId() {
    return scenario.id;
  },
  get frameMs() {
    return summarizeFrames(samples, 'gl.finish').p50;
  },
  frameMethod: 'gl.finish',
  measure: (n = 20, warmup = 5) => measureFrames(gl, () => style.render(state()), n, warmup),
  async setScenario(id: string, settleFrames = 4): Promise<void> {
    const next = SCEN.find((s) => s.id === id);
    if (!next) throw new Error(`[lab] nieznany scenariusz "${id}" w świecie "${P.world}"`);
    if (next !== scenario) {
      scenario = next;
      placeCamera(scenario);
      samples.length = 0;
      sinceChange = 0;
    }
    const start = frames;
    await new Promise<void>((res) => {
      const check = () => (frames - start >= settleFrames ? res() : requestAnimationFrame(check));
      check();
    });
  },
  probes,
  layout: 'swatches' in arena ? arena.swatches : null,
};
